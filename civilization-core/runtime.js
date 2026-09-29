const { GovernanceController } = require('./governance/governance-controller');
const { PolicyEngine } = require('./governance/policy-engine');
const { AuditSystem } = require('./governance/audit-system');
const { AICouncil } = require('./governance/ai-council');
const { ConflictResolver } = require('./governance/conflict-resolver');
const { DecisionHistory } = require('./governance/decision-history');

function createCivilizationRuntime(options = {}) {
  const policies = new PolicyEngine();
  const audit = new AuditSystem();
  const council = new AICouncil();
  const conflicts = new ConflictResolver();
  const decisions = new DecisionHistory();

  const governance = new GovernanceController({
    council,
    policyEngine: policies,
    conflictResolver: conflicts,
    auditSystem: audit
  });

  return {
    ...options,
    governance: {
      controller: governance,
      council,
      policies,
      audit,
      conflicts,
      decisions
    },
    bootstrap() {
      return this.getState();
    },
    getState() {
      return {
        version: '9.3',
        governance: {
          policies: policies.count(),
          audits: audit.history().length,
          councilMembers: council.members.length
        }
      };
    }
  };
}

module.exports = { createCivilizationRuntime };
