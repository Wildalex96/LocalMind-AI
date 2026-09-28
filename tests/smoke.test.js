const test=require("node:test");const assert=require("node:assert/strict");const{IntelligenceCycle}=require("../agent/intelligence-cycle");const{PermissionPolicy}=require("../permissions/policy");const{PermissionManager}=require("../permissions/manager");
test("intelligence cycle has seven stages",async()=>{const state=await new IntelligenceCycle().run("test task");assert.equal(state.proposals.length,7);});
test("code execution requires confirmation by default",()=>{const pm=new PermissionManager(new PermissionPolicy());assert.equal(pm.request("codeExecution").status,"pending");});
