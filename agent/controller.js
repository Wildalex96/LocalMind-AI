const { IntelligenceCycle } = require("./intelligence-cycle");
const { WindowsSandboxRunner } = require("../sandbox/windows-sandbox-runner");
class AgentController {
  constructor({ permissionManager, journal = console }) { this.permissions = permissionManager; this.cycle = new IntelligenceCycle({ journal }); this.sandbox = process.platform === "win32" ? new WindowsSandboxRunner({ permissionManager }) : null; }
  plan(task) { return this.cycle.run(task); }
  executePython(code, options = {}) { if (!this.sandbox) return Promise.resolve({status:"error",error:"Windows Sandbox backend is only available on Windows."}); return this.sandbox.runPython(code, options); }
}
module.exports = { AgentController };
