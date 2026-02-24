/**
 * Preload: expõe de forma segura as funções do main process para a janela (renderer).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('datago', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  checkForUpdatesNow: () => ipcRenderer.invoke('check-for-updates-now'),
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
  onUpdateCheckStarted: (fn) => {
    ipcRenderer.on('update-check-started', () => fn());
  },
  onUpdateNotAvailable: (fn) => {
    ipcRenderer.on('update-not-available', () => fn());
  },
  onUpdateAvailable: (fn) => {
    ipcRenderer.on('update-available', (_e, data) => fn(data));
  },
  onUpdateError: (fn) => {
    ipcRenderer.on('update-error', (_e, data) => fn(data));
  },
  onUpdateStatus: (fn) => {
    ipcRenderer.on('update-status', (_e, data) => fn(data));
  },
});
