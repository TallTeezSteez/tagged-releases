const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('taggedDesktop', {
  version: ipcRenderer.sendSync('app-version'),
  theme: (dark) => ipcRenderer.send('theme', !!dark),
  glass: (percent) => ipcRenderer.send('glass', Number(percent) || 0),
  retry: () => ipcRenderer.send('retry'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAutoUpdate: () => ipcRenderer.invoke('get-auto-update'),
  setAutoUpdate: (on) => ipcRenderer.send('set-auto-update', !!on),
  restartToUpdate: () => ipcRenderer.send('restart-to-update'),
  // Calls back with the current update news right away, then whenever it changes.
  onUpdateStatus: (cb) => {
    const listener = (_e, s) => cb(s);
    ipcRenderer.on('update-status', listener);
    cb(ipcRenderer.sendSync('update-status-sync'));
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});
