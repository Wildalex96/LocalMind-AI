class CivilizationController {
  constructor({ memory, agents = [], companies = [] } = {}) {
    this.memory = memory;
    this.agents = agents;
    this.companies = companies;
    this.createdAt = new Date().toISOString();
  }

  registerAgent(agent) {
    this.agents.push(agent);
    return agent;
  }

  registerCompany(company) {
    this.companies.push(company);
    return company;
  }

  getState() {
    return {
      version: '9.0',
      agents: this.agents.length,
      companies: this.companies.length,
      memory: this.memory ? this.memory.stats() : null,
      createdAt: this.createdAt
    };
  }
}

module.exports = { CivilizationController };
