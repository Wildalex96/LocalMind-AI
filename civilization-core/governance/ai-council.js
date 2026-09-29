class AICouncil {
  constructor() {
    this.members = [];
  }

  add(agent) {
    this.members.push(agent);
  }

  async vote(problem) {
    const votes = await Promise.all(
      this.members.map(agent =>
        typeof agent.analyze === 'function'
          ? agent.analyze(problem)
          : { agent: agent.id, decision: 'abstain' }
      )
    );

    return {
      problem,
      decision: 'reviewed',
      votes
    };
  }
}

module.exports = { AICouncil };
