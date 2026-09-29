const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class DeveloperWorkspace {
  constructor({ root = path.join(os.tmpdir(), 'localmind-developer-workspaces') } = {}) {
    this.root = root;
    fs.mkdirSync(root, { recursive: true });
  }
  create() {
    const id = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const dir = path.join(this.root, id);
    fs.mkdirSync(dir, { recursive: true });
    return { id, path: dir };
  }
  write(workspace, relativePath, content) {
    const target = this.safePath(workspace, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return target;
  }
  read(workspace, relativePath) {
    return fs.readFileSync(this.safePath(workspace, relativePath), 'utf8');
  }
  safePath(workspace, relativePath) {
    const base = path.resolve(workspace.path);
    const target = path.resolve(base, relativePath);
    if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('Workspace path escape blocked');
    return target;
  }
  remove(workspace) { fs.rmSync(workspace.path, { recursive: true, force: true }); }
}
module.exports = { DeveloperWorkspace };
