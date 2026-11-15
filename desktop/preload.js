// Bridge between the page and the desktop shell: only the manual update actions.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resonaDesktop', {
  version: () => ipcRenderer.invoke('upd:version'),
  check: () => ipcRenderer.invoke('upd:check'),          // never downloads by itself
  download: () => ipcRenderer.invoke('upd:download'),
  install: () => ipcRenderer.invoke('upd:install'),      // restarts the app
  openDownloads: () => ipcRenderer.invoke('upd:open'),
  onStatus: (cb) => ipcRenderer.on('upd:status', (_e, st) => cb(st))
});
