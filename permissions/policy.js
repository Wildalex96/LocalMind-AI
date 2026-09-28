const DEFAULT_POLICY = Object.freeze({network:"ask",filesystemRead:"ask",filesystemWrite:"ask",codeExecution:"ask",processExecution:"deny",installSoftware:"deny",systemChanges:"deny"});
class PermissionPolicy { constructor(overrides={}) { this.values={...DEFAULT_POLICY,...overrides}; } get(capability){return this.values[capability]??"deny";} allows(capability){return this.get(capability)==="allow";} }
module.exports={PermissionPolicy,DEFAULT_POLICY};
