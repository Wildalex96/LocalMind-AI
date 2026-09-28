const STAGES = ["source","substrate","field","unified","meta","genesis","origin"];

class IntelligenceCycle {
  constructor({ journal = console } = {}) { this.journal = journal; }
  async run(task, hooks = {}) {
    const state = { task, iteration: 1, proposals: [], observations: [] };
    for (const stage of STAGES) {
      const proposal = hooks[stage] ? await hooks[stage](state) : await this.stage(stage, state);
      state.proposals.push(proposal); this.journal.info?.(`[LocalMind cycle] ${stage}`);
    }
    return state;
  }
  async stage(stage, state) {
    const definitions = {
      source: ["decompose_goal", "derive capabilities and constraints"],
      substrate: ["represent", "build a stable internal task representation"],
      field: ["expand", "explore models, tools and approaches"],
      unified: ["select", "merge candidates into one plan"],
      meta: ["critique", "check correctness, security, cost and reversibility"],
      genesis: ["construct", "generate artifacts in an isolated workspace"],
      origin: ["learn", "extract reusable lessons without changing safety policy"]
    };
    const [operation, rationale] = definitions[stage];
    return { stage, operation, rationale, goal: state.task };
  }
}
module.exports = { IntelligenceCycle, STAGES };
