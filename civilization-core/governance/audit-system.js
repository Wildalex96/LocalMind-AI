class AuditSystem {
  constructor() {
    this.logs = [];
  }

  record(event) {
    this.logs.push(event);
  }

  history() {
    return this.logs;
  }
}

module.exports = { AuditSystem };
