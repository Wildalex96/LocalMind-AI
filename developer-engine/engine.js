const { spawn } = require('child_process');
const { DeveloperWorkspace } = require('./sandbox');

class DeveloperEngine {
  constructor({ permissionManager, workspace = new DeveloperWorkspace(), root = process.cwd() } = {}) {
    this.permissions = permissionManager;
    this.workspace = workspace;
    this.root = root;
  }
  async inspect() {
    const fs = require('fs');
    const path = require('path');
    const files = [];
    const walk = (dir, depth = 0) => {
      if (depth > 3) return;
      for (const name of fs.readdirSync(dir)) {
        if (['node_modules', '.git', 'dist'].includes(name)) continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, depth + 1); else files.push(path.relative(this.root, full));
      }
    };
    walk(this.root);
    return { root: this.root, files: files.slice(0, 2000) };
  }
  async requestApproval(action, details) {
    const id = `developer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (!this.permissions) throw new Error('Developer permission manager is unavailable');
    const pending = this.permissions.request ? this.permissions.request({ id, action, details }) : null;
    if (pending) return pending;
    const list = this.permissions.listPending();
    if (!list.some(x => x.id === id)) throw new Error('Developer action blocked: permission gate unavailable');
    return { id, status: 'pending' };
  }
  async runApprovedCommand(workspace, command, args = [], timeoutMs = 120000) {
    const allowed = new Set(['npm']);
    if (!allowed.has(command)) throw new Error(`Command blocked: ${command}`);
    const cwd = workspace.path;
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
      let stdout = '', stderr = '', timer;
      timer = setTimeout(() => { child.kill(); reject(new Error('Developer command timeout')); }, timeoutMs);
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });
      child.on('error', e => { clearTimeout(timer); reject(e); });
      child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    });
  }
  async createWorkspace() { return this.workspace.create(); }
  async cleanupWorkspace(workspace) { this.workspace.remove(workspace); return true; }
}
module.exports = { DeveloperEngine };
