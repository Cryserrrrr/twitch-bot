"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const config = require("../core/config");

const SECRET_FILE = path.join(config.dataDir, "session-secret");
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Stateless dashboard sessions.
 *
 * Sessions used to be a Map keyed by Math.random(), lost on every restart and
 * guessable. They are now HMAC-signed tokens: nothing to store, they survive a
 * restart, and forging one requires the secret file.
 */
function loadSecret() {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
      if (secret.length >= 32) return secret;
    }
  } catch {
    // Falls through to generating a new secret.
  }

  const secret = crypto.randomBytes(48).toString("hex");
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
}

function create(user) {
  const payload = encode({
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    avatar: user.avatar,
    role: user.role,
    exp: Date.now() + TTL_MS,
  });

  return `${payload}.${sign(payload)}`;
}

function verify(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);

  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Short-lived signed value protecting the OAuth round trip. */
function createState(data) {
  const payload = encode({ ...data, exp: Date.now() + 10 * 60 * 1000 });
  return `${payload}.${sign(payload)}`;
}

function verifyState(state) {
  return verify(state);
}

module.exports = { create, verify, createState, verifyState };
