"use strict";

const config = require("../core/config");
const logger = require("../core/logger").child("web");
const session = require("./session");

const ROLES = { moderator: 1, broadcaster: 2 };

/** Reads the bearer token and attaches the session to the request. */
function authenticate(req, res, next) {
  if (!config.web.authEnabled) {
    req.user = {
      id: "0",
      login: config.bot.channel,
      displayName: config.bot.channel,
      role: "broadcaster",
    };
    return next();
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const user = token ? session.verify(token) : null;

  if (!user) {
    return res.status(401).json({ error: "authentication_required" });
  }

  req.user = user;
  return next();
}

function requireRole(minimum) {
  return (req, res, next) => {
    if ((ROLES[req.user?.role] || 0) < ROLES[minimum]) {
      return res.status(403).json({ error: "insufficient_permissions" });
    }
    return next();
  };
}

/** Wraps an async handler so rejections become clean 500 responses. */
function route(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function errorHandler(error, req, res, _next) {
  const status = error.status || error.response?.status || 500;
  const message =
    error.response?.data?.message || error.message || "internal_error";

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed`, error);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }

  res.status(status).json({ error: message });
}

module.exports = { authenticate, requireRole, route, errorHandler, ROLES };
