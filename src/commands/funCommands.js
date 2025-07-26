class FunCommands {
  constructor() {}

  async dice() {
    const result = Math.floor(Math.random() * 100) + 1;
    return `${result} on 100!`;
  }

  async flip() {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    return `${result}!`;
  }
}

module.exports = FunCommands;
