const fs = require('fs');
const path = require('path');
const { dialog, shell, ipcMain, app } = require('electron');
const { AIProviderManager } = require('./ai/provider-manager');
const { searchWeb } = require('./web-search');

class DesktopStorage {
  constructor({ dataDir, getMainWindow } = {}) {
    this.dataDir = dataDir;
    this.getMainWindow = getMainWindow || (() => null);
    this.stateFile = path.join(dataDir, 'desktop-storage.json');
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(this.stateFile)) this.writeState({ projectPath: '', storagePath: path.join(dataDir, 'files') });
    this.registerAIIPC();
  }
  readState() { try { return JSON.parse(fs.readFileSync(this.stateFile, 'utf8')); } catch { return { projectPath: '', storagePath: path.join(this.dataDir, 'files') }; } }
  writeState(value) { fs.mkdirSync(this.dataDir, { recursive: true }); fs.writeFileSync(this.stateFile, JSON.stringify(value, null, 2)); }
  safe(root, relative = '') { const base = path.resolve(root); const target = path.resolve(base, relative); if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('Доступ за пределами хранилища запрещён'); return target; }
  registerAIIPC() {
    if (DesktopStorage.aiRegistered) return;
    DesktopStorage.aiRegistered = true;
    const settingsFile = path.join(app.getPath('userData'), 'localmind', 'settings.json');
    const memoryFile = path.join(app.getPath('userData'), 'localmind', 'memory.json');
    const readSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { return { provider: 'auto', internet: true, autoLearn: true }; } };
    const writeSettings = value => { fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify(value, null, 2)); };
    const readMemory = () => { try { return JSON.parse(fs.readFileSync(memoryFile, 'utf8')).memories || []; } catch { return []; } };
    const manager = new AIProviderManager({ getSettings: readSettings, ollamaInstalled: () => { const candidates = [path.join(process.env.LOCALAPPDATA || '', 'Programs','Ollama','ollama.exe'),path.join(process.env.LOCALAPPDATA || '', 'Ollama','ollama.exe'),path.join(process.env.ProgramFiles || 'C:\\Program Files','Ollama','ollama.exe')]; return candidates.some(p => fs.existsSync(p)); } });
    ipcMain.handle('providers:get', () => ({ selected: readSettings().provider || 'auto', providers: manager.config(), order: manager.order(readSettings().provider || 'auto'), lastProvider: manager.lastProvider }));
    ipcMain.handle('providers:set', (_, provider) => {
      const allowed = ['auto','openai','gemini','claude','openrouter','lmstudio','ollama'];
      if (!allowed.includes(provider)) throw new Error('Неизвестный AI-провайдер');
      const current = readSettings(); current.provider = provider; writeSettings(current);
      return { selected: provider, providers: manager.config(), order: manager.order(provider) };
    });
    ipcMain.handle('chat:universal', async (event, payload) => {
      const s = readSettings();
      let web = '';
      if (s.internet !== false && payload.allowWeb !== false) { try { web = await searchWeb(payload.message || ''); } catch {} }
      const memory = readMemory().slice(-100).join('\n- ');
      const project = this.state();
      const system = `You are LocalMind AI, a desktop assistant. Use the supplied research when present and distinguish evidence from uncertainty. Do not claim to know facts that are not supported.\n\nMEMORY:\n- ${memory || '(empty)'}\n\nPROJECT:\n${project.projectPath || '(not selected)'}\n\nWEB RESEARCH:\n${web || '(none)'}`;
      const messages = [{ role:'system', content:system }, ...(payload.history || []), { role:'user', content:payload.message || '' }];
      return manager.generate(messages, { provider: s.provider || 'auto', onStatus: msg => event.sender.send('bootstrap:progress', msg) });
    });
    ipcMain.handle('test:universal', async (event) => manager.generate([{ role: 'user', content: 'Reply with OK.' }], { provider: readSettings().provider || 'auto', onStatus: msg => event.sender.send('bootstrap:progress', msg) }));
  }
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
