const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DeveloperWorkspace } = require('./sandbox');

const IGNORE = new Set(['node_modules', '.git', 'dist', 'release', '.idea', '.vscode']);
const ALLOWED_COMMANDS = new Set(['npm']);

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

function safeJoin(root, relativePath) {
  const base = path.resolve(root);
  const target = path.resolve(base, relativePath);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('Path escape blocked');
  if (path.isAbsolute(relativePath)) throw new Error('Absolute paths are blocked');
  return target;
}

function runCommand(command, args, cwd, timeoutMs = 180000) {
  if (!ALLOWED_COMMANDS.has(command)) throw new Error(`Command blocked: ${command}`);
  return new Promise(resolve => {
    const child = spawn(process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command, args, { cwd, windowsHide: true, shell: false });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {} resolve({ ok: false, code: null, stdout, stderr: 'Command timed out' }); }, timeoutMs);
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => { clearTimeout(timer); resolve({ ok: false, code: null, stdout, stderr: e.message }); });
    child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, code, stdout: stdout.slice(-20000), stderr: stderr.slice(-20000) }); });
  });
}

class DeveloperEngine {
  constructor({ permissionManager, workspace = new DeveloperWorkspace(), root = process.cwd() } = {}) {
    this.permissions = permissionManager;
    this.workspace = workspace;
    this.root = path.resolve(root);
  }

  inspect(root = this.root) {
    const files = [];
    const walk = (dir, depth = 0) => {
      if (depth > 5) return;
      for (const name of fs.readdirSync(dir)) {
        if (IGNORE.has(name)) continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, depth + 1); else files.push(path.relative(root, full));
      }
    };
    walk(root);
    return { root, files: files.slice(0, 4000) };
  }

  plan(task) {
    return {
      engine: 'Developer Engine 2.0', task: String(task || '').trim(),
      stages: ['analyze', 'design', 'implement', 'test', 'quality', 'security', 'build', 'review'],
      safety: { isolatedWorkspace: true, permissionGate: true, productionChanges: false, maxRepairLoops: 3 }
    };
  }

  request(capability, details) {
    if (!this.permissions) throw new Error('Permission manager unavailable');
    return this.permissions.request(capability, details);
  }

  createWorkspace() {
    const ws = this.workspace.create();
    copyTree(this.root, ws.path);
    return ws;
  }

  applyChanges(ws, changes) {
    if (!changes || typeof changes !== 'object') throw new Error('No changes supplied');
    for (const [relativePath, content] of Object.entries(changes)) {
      const target = safeJoin(ws.path, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, String(content), 'utf8');
    }
    return Object.keys(changes);
  }

  async validate(ws, { build = false } = {}) {
    const results = [];
    results.push({ step: 'tests', ...(await runCommand('npm', ['test'], ws.path, 180000)) });
    results.push({ step: 'diff-check', ...(await runCommand('npm', ['run', 'lint'], ws.path, 180000)) });
    if (build) results.push({ step: 'build', ...(await runCommand('npm', ['run', 'build:win'], ws.path, 600000)) });
    return { ok: results.every(r => r.ok), results };
  }

  async autonomousCycle({ task, changes, build = false } = {}) {
    const writeGate = this.request('filesystemWrite', { action: 'developer:apply-generated-changes', task });
    if (writeGate.status !== 'allowed') return { status: 'permission_required', permission: writeGate };

    const ws = this.createWorkspace();
    try {
      const applied = this.applyChanges(ws, changes || {});
      const executionGate = this.request('codeExecution', { action: 'developer:test-repair-build', workspace: ws.path, files: applied });
      if (executionGate.status !== 'allowed') return { status: 'permission_required', permission: executionGate, workspace: ws.id };

      const attempts = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const validation = await this.validate(ws, { build });
        attempts.push({ attempt, validation });
        if (validation.ok) return { status: 'validated_in_sandbox', workspace: ws.id, attempts, changedFiles: applied, requiresReview: true };
        if (attempt === 3) return { status: 'repair_limit_reached', workspace: ws.id, attempts, changedFiles: applied, requiresReview: true };
        // A repair request is returned to the AI/UI. No automatic mutation is performed here.
        return { status: 'repair_required', workspace: ws.id, attempts, changedFiles: applied, errors: validation.results.filter(r => !r.ok), nextAction: 'generate_repair_and_call_autonomousCycle_again' };
      }
    } finally {
      this.workspace.remove(ws);
    }
  }

  async promote(_workspaceId) {
    throw new Error('Production promotion is intentionally disabled. Review the sandbox diff and explicitly apply approved changes through a separate privileged flow.');
  }
}

module.exports = { DeveloperEngine };
