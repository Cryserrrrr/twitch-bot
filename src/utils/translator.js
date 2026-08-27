"use strict";

const config = require("../core/config");

const LANGUAGES = {
  fr: { code: "fr", name: "Français" },
  en: { code: "en", name: "English" },
};

const FALLBACK = "en";

/** Resolves a dotted key inside a nested object. */
function resolve(source, parts) {
  let value = source;
  for (const part of parts) {
    if (value === null || typeof value !== "object" || !(part in value)) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

function interpolate(template, variables) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    variables[name] !== undefined ? String(variables[name]) : match
  );
}

class Translator {
  constructor(language = config.language) {
    this.translations = {
      fr: require("../locales/fr"),
      en: require("../locales/en"),
    };
    this.language = this.translations[language] ? language : FALLBACK;
  }

  getLanguage() {
    return this.language;
  }

  setLanguage(language) {
    if (this.translations[language]) this.language = language;
    return this.language;
  }

  static available() {
    return Object.values(LANGUAGES);
  }

  /**
   * Translates a key. Arrays are treated as message pools and one entry is
   * picked at random, which is how event announcements stay varied.
   */
  t(key, variables = {}) {
    const parts = key.split(".");
    let value = resolve(this.translations[this.language], parts);

    if (value === undefined && this.language !== FALLBACK) {
      value = resolve(this.translations[FALLBACK], parts);
    }

    if (value === undefined) return key;

    if (Array.isArray(value)) {
      value = value[Math.floor(Math.random() * value.length)];
    }

    return typeof value === "string" ? interpolate(value, variables) : value;
  }
}

module.exports = Translator;
module.exports.LANGUAGES = LANGUAGES;
