const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const IGNORE = new Set(['.git','node_modules','dist','release','.idea','.vscode']);
const SOURCE_EXT = new Set(['.js','.cjs','.mjs','.ts','.tsx','.jsx','.json','.css','.html','.py','.go','.rs','.java','.cs','.cpp','.c','.h','.hpp','.md']);

function walk(root, maxFiles = 2000) {
  const out = [];
  function visit(dir) {
    if (out.length >= maxFiles) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (SOURCE_EXT.has(path.extname(entry.name).toLowerCase())) out.push(path.relative(root, full));
    }
  }
  visit(root);
  return out;
}

function runCommand(command, args, cwd, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false });
    let stdout = '', stderr = '', timer;
    const finish = (result) => { if (timer) clearTimeout(timer); resolve(result); };
    child.stdout?.on('data', d => { stdout += d.toString(); });
    child.stderr?.on('data', d => { stderr += d.toString(); });
    child.on('error', e => finish({ ok: false, code: null, stdout, stderr: e.message }));
    child.on('close', code => finish({ ok: code === 0, code, stdout: stdout.slice(-20000), stderr: stderr.slice(-20000) }));
    timer = setTimeout(() => { try { child.kill(); } catch {} finish({ ok: false, code: null, stdout, stderr: 'Command timed out.' }); }, timeoutMs);
  });
}

class DeveloperEngine {
  constructor({ permissionManager, workspace = process.cwd(), journal = console } = {}) {
    this.permissions = permissionManager;
    this.workspace = path.resolve(workspace);
    this.journal = journal;
  }

  inspect() {
    const files = walk(this.workspace);
    const byExtension = {};
    for (const file of files) {
      const ext = path.extname(file).toLowerCase() || '(none)';
      byExtension[ext] = (byExtension[ext] || 0) + 1;
    }
    let pkg = null;
    try { pkg = JSON.parse(fs.readFileSync(path.join(this.workspace, 'package.json'), 'utf8')); } catch {}
    return {
      workspace: this.workspace,
      fileCount: files.length,
      files: files.slice(0, 500),
      byExtension,
      package: pkg ? { name: pkg.name, version: pkg.version, scripts: pkg.scripts || {} } : null
    };
  }

  plan(task) {
    const inspection = this.inspect();
    const scripts = inspection.package?.scripts || {};
    return {
      engine: 'Developer Engine 2.0',
      task: String(task || '').trim(),
      workspace: inspection.workspace,
      phases: [
        { id: 'analyze', action: 'inspect repository and identify affected files' },
        { id: 'design', action: 'produce an implementation plan and acceptance criteria' },
        { id: 'implement', action: 'make scoped code changes only after write permission is granted' },
        { id: 'test', action: scripts.test ? 'run npm test' : 'run available project tests' },
        { id: 'quality', action: 'run syntax/static checks and git diff --check' },
        { id: 'security', action: 'review changed code for secrets, unsafe process execution and permission bypasses' },
        { id: 'build', action: scripts['build:win'] ? 'run npm run build:win' : 'run the project build command when available' },
        { id: 'release', action: 'prepare a reviewable commit/PR; production changes require explicit approval' }
      ],
      acceptance: ['tests pass', 'no whitespace errors', 'no secrets added', 'no permission policy bypass', 'build succeeds when requested']
    };
  }

  async validate({ build = false } = {}) {
    const results = [];
    const scripts = this.inspect().package?.scripts || {};
    if (scripts.test) results.push({ step: 'tests', ...(await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], this.workspace)) });
    results.push({ step: 'diff-check', ...(await runCommand('git', ['diff', '--check'], this.workspace, 60000)) });
    if (build && scripts['build:win']) results.push({ step: 'build:win', ...(await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:win'], this.workspace, 600000)) });
    return { ok: results.every(r => r.ok), results };
  }

  async run(task, options = {}) {
    return { plan: this.plan(task), validation: await this.validate(options) };
  }
}

module.exports = { DeveloperEngine };
