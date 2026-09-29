class DecisionHistory {
  constructor() {
    this.entries = [];
  }

  add(entry) {
    this.entries.push({
      ...entry,
      timestamp: new Date().toISOString()
    });
  }

  list() {
    return this.entries;
  }
}

module.exports = { DecisionHistory };
