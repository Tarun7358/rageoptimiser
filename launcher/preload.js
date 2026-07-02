const { contextBridge, ipcRenderer } = require('electron');

// Expose safe Electron API to the splash screen renderer
contextBridge.exposeInMainWorld('launcher', {
  // Listen for startup step updates
  onStep: (callback) => ipcRenderer.on('startup:step', (_, data) => callback(data)),
  onProgress: (callback) => ipcRenderer.on('startup:progress', (_, pct) => callback(pct)),
  onError: (callback) => ipcRenderer.on('startup:error', (_, data) => callback(data)),
  onComplete: (callback) => ipcRenderer.on('startup:complete', (_, data) => callback(data)),
  onLog: (callback) => ipcRenderer.on('startup:log', (_, msg) => callback(msg)),

  // Actions from splash screen
  retry: () => ipcRenderer.send('startup:retry'),
  exit: () => ipcRenderer.send('app:exit'),

  // Health status updates
  onHealthStatus: (callback) => ipcRenderer.on('health:status', (_, data) => callback(data)),
  onProcessEvent: (callback) => ipcRenderer.on('process:event', (_, data) => callback(data)),
});
