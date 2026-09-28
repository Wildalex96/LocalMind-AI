const crypto = require('crypto');

class AgentIdentity {
  constructor({ name, role }) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.role = role;
    this.reputation = 0;
    this.createdAt = new Date().toISOString();
  }

  increaseTrust(value = 1) {
    this.reputation += value;
  }
}

module.exports = { AgentIdentity };
