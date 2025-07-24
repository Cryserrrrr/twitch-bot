const fs = require("fs");
const path = require("path");

class Translator {
  constructor() {
    this.currentLanguage = process.env.LANGUAGE || "en";
    this.translations = {};
    this.loadTranslations();
  }

  loadTranslations() {
    const localesPath = path.join(__dirname, "../locales");
    const files = fs.readdirSync(localesPath);

    files.forEach((file) => {
      if (file.endsWith(".js")) {
        const langCode = file.replace(".js", "");
        const translation = require(path.join(localesPath, file));
        this.translations[langCode] = translation;
      }
    });
  }

  getLanguage() {
    return this.currentLanguage;
  }

  t(key, variables = {}) {
    const keys = key.split(".");
    let translation = this.translations[this.currentLanguage];

    // Navigate through the translation object
    for (const k of keys) {
      if (translation && translation[k] !== undefined) {
        translation = translation[k];
      } else {
        // Fallback to English if translation not found
        translation = this.translations["en"];
        for (const fallbackKey of keys) {
          if (translation && translation[fallbackKey] !== undefined) {
            translation = translation[fallbackKey];
          } else {
            return key; // Return the key if no translation found
          }
        }
        break;
      }
    }

    // If translation is an array, return a random element
    if (Array.isArray(translation)) {
      translation = translation[Math.floor(Math.random() * translation.length)];
    }

    // Replace variables in the translation
    if (typeof translation === "string") {
      return translation.replace(/\{(\w+)\}/g, (match, variable) => {
        return variables[variable] !== undefined ? variables[variable] : match;
      });
    }

    return translation || key;
  }

  // Helper method for getting random messages from arrays
  getRandom(key, variables = {}) {
    const translation = this.t(key, variables);
    if (Array.isArray(translation)) {
      const randomIndex = Math.floor(Math.random() * translation.length);
      return translation[randomIndex];
    }
    return translation;
  }
}

module.exports = Translator;
