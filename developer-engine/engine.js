const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DeveloperWorkspace } = require('./sandbox');

class DeveloperEngine {
  constructor({ permissionManager, workspace = new DeveloperWorkspace(), root = process.cwd() } = {}) { this.permissions = permissionManager; this.workspace = workspace; this.root = root; }
  inspect() {
    const files = [];
    const walk = (dir, depth = 0) => { if (depth > 3) return; for (const name of fs.readdirSync(dir)) { if (['node_modules','.git','dist'].includes(name)) continue; const full=path.join(dir,name); const stat=fs.statSync(full); if(stat.isDirectory()) walk(full,depth+1); else files.push(path.relative(this.root,full)); } };
    walk(this.root); return { root:this.root, files:files.slice(0,2000) };
  }
  plan(task) { return { task, stages:['analyze','design','implement','test','quality','security','build'], safety:{isolatedWorkspace:true,permissionGate:true,productionChanges:false} }; }
  validate(options={}) { const target=options.workspacePath||this.root; return {workspace:target,checks:[{name:'path-safety',passed:fs.existsSync(target)},{name:'git-diff-check',command:'git diff --check'},{name:'tests',command:'npm test'}]}; }
  request(capability,details) { if(!this.permissions) throw new Error('Permission manager unavailable'); return this.permissions.request(capability,details); }
  async run(task,{build=false}={}) {
    const gate=this.request('filesystemWrite',{action:'developer:workspace-write',task});
    if(gate.status!=='allowed') return {status:'permission_required',permission:gate};
    const workspace=this.workspace.create();
    try {
      const result={status:'workspace_ready',workspace,task,steps:[this.plan(task),this.validate({workspacePath:workspace.path})]};
      if(build){ const execGate=this.request('codeExecution',{action:'developer:test-and-build',workspace:workspace.path}); if(execGate.status!=='allowed') return {...result,status:'permission_required',permission:execGate}; result.build=await this.runApprovedCommand(workspace,'npm',['test']); if(result.build.code!==0)return {...result,status:'test_failed'}; }
      result.status='ready_for_patch'; return result;
    } finally { this.workspace.remove(workspace); }
  }
  runApprovedCommand(workspace,command,args=[],timeoutMs=120000){ if(command!=='npm') throw new Error(`Command blocked: ${command}`); return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:workspace.path,windowsHide:true,shell:false});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(new Error('Developer command timeout'));},timeoutMs);child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});}); }
}
module.exports={DeveloperEngine};
