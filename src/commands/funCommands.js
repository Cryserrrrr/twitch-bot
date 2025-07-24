class FunCommands {
  constructor() {}

  async dice() {
    const result = Math.floor(Math.random() * 100) + 1;
    return `Vous avez obtenu ${result} sur 100!`;
  }

  async flip() {
    const result = Math.random() < 0.5 ? "Pile" : "Face";
    return `The result is: ${result}!`;
  }
}

module.exports = FunCommands;
