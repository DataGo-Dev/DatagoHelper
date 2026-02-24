/**
 * Preload: expõe de forma segura as funções do main process para a janela (renderer).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('datago', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getExecutionHistory: () => ipcRenderer.invoke('get-execution-history'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  runPullNow: () => ipcRenderer.invoke('run-pull-now'),
  abortPull: (password) => ipcRenderer.invoke('abort-pull', password),
  onPullStart: (fn) => {
    ipcRenderer.on('pull-start', (_e, data) => fn(data));
  },
  onPullProgress: (fn) => {
    ipcRenderer.on('pull-progress', (_e, data) => fn(data));
  },
  onPullResult: (fn) => {
    ipcRenderer.on('pull-result', (_e, data) => fn(data));
  },
});
