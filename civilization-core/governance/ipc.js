function registerGovernanceIPC(ipcMain, civilization) {
  ipcMain.handle('governance:get-state', () => {
    return civilization?.governance?.controller?.state?.() || {
      policies: 0,
      audits: 0
    };
  });

  ipcMain.handle('governance:evaluate', (_, action) => {
    return civilization.governance.controller.evaluate(action);
  });

  ipcMain.handle('governance:history', () => {
    return civilization.governance.audit.history();
  });

  ipcMain.handle('council:vote', (_, proposal) => {
    return civilization.governance.council.vote(proposal);
  });

  ipcMain.handle('conflict:resolve', (_, conflict) => {
    return civilization.governance.conflicts.resolve(conflict);
  });
}

module.exports = { registerGovernanceIPC };
