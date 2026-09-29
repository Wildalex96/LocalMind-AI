class PolicyEngine {
  constructor() {
    this.rules = new Map();
  }

  add(action, rule) {
    this.rules.set(action, rule);
  }

  check(action) {
    const rule = this.rules.get(action);
    return rule ? rule.allowed : false;
  }

  count() {
    return this.rules.size;
  }
}

module.exports = { PolicyEngine };
