const { CivilizationController } = require('./civilization-controller');
const { AgentIdentity } = require('./agent-identity');
const { GlobalMemory } = require('./global-memory');

function createCivilizationRuntime() {
  const memory = new GlobalMemory();
  const civilization = new CivilizationController({ memory });

  return {
    civilization,
    memory,
    registerAgent(name, role) {
      const agent = new AgentIdentity(name, role);
      civilization.registerAgent(agent);
      return agent;
    },
    getState() {
      return civilization.getState();
    }
  };
}

module.exports = { createCivilizationRuntime };
