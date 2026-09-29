const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');

class DesktopStorage {
  constructor({ dataDir, getMainWindow } = {}) {
    this.dataDir = dataDir;
    this.getMainWindow = getMainWindow || (() => null);
    this.stateFile = path.join(dataDir, 'desktop-storage.json');
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(this.stateFile)) this.writeState({ projectPath: '', storagePath: path.join(dataDir, 'files') });
  }
  readState() { try { return JSON.parse(fs.readFileSync(this.stateFile, 'utf8')); } catch { return { projectPath: '', storagePath: path.join(this.dataDir, 'files') }; } }
  writeState(value) { fs.mkdirSync(this.dataDir, { recursive: true }); fs.writeFileSync(this.stateFile, JSON.stringify(value, null, 2)); }
  safe(root, relative = '') { const base = path.resolve(root); const target = path.resolve(base, relative); if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('Доступ за пределами хранилища запрещён'); return target; }
  async chooseProject() { const result = await dialog.showOpenDialog(this.getMainWindow(), { title: 'Открыть проект из Проводника', properties: ['openDirectory'] }); if (result.canceled || !result.filePaths[0]) return null; const projectPath = path.resolve(result.filePaths[0]); const state = this.readState(); state.projectPath = projectPath; this.writeState(state); return { path: projectPath, name: path.basename(projectPath) }; }
  async chooseStorage() { const result = await dialog.showOpenDialog(this.getMainWindow(), { title: 'Выбрать файловое хранилище', properties: ['openDirectory', 'createDirectory'] }); if (result.canceled || !result.filePaths[0]) return null; const storagePath = path.resolve(result.filePaths[0]); const state = this.readState(); state.storagePath = storagePath; this.writeState(state); return { path: storagePath }; }
  state() { const s = this.readState(); return { ...s, projectExists: !!s.projectPath && fs.existsSync(s.projectPath), storageExists: !!s.storagePath && fs.existsSync(s.storagePath) }; }
  async reveal(target) { const p = path.resolve(target); if (!fs.existsSync(p)) throw new Error('Файл или папка не найдены'); return shell.openPath(p); }
  list() { const root = this.readState().storagePath; if (!root || !fs.existsSync(root)) return []; return fs.readdirSync(root, { withFileTypes: true }).map(e => ({ name: e.name, path: path.join(root, e.name), type: e.isDirectory() ? 'directory' : 'file' })); }
  saveText(relativePath, content) { const root = this.readState().storagePath; if (!root) throw new Error('Хранилище не выбрано'); fs.mkdirSync(root, { recursive: true }); const target = this.safe(root, relativePath); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, String(content), 'utf8'); return target; }
  async importFiles() { const root = this.readState().storagePath; if (!root) throw new Error('Хранилище не выбрано'); fs.mkdirSync(root, { recursive: true }); const result = await dialog.showOpenDialog(this.getMainWindow(), { title: 'Добавить файлы в хранилище', properties: ['openFile', 'multiSelections'] }); if (result.canceled) return []; const copied = []; for (const source of result.filePaths) { const target = this.safe(root, path.basename(source)); fs.copyFileSync(source, target); copied.push(target); } return copied; }
  async openItem(relativePath) { const root = this.readState().storagePath; const target = this.safe(root, relativePath); if (!fs.existsSync(target)) throw new Error('Файл не найден'); return shell.openPath(target); }
}
module.exports = { DesktopStorage };
