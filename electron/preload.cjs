const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
};

contextBridge.exposeInMainWorld('pitwall', {
  onFrame: (callback) => subscribe('pitwall:frame', callback),
  onConfig: (callback) => subscribe('pitwall:config', callback),
  getConfig: () => ipcRenderer.invoke('pitwall:config'),
  setListener: (host, port) => ipcRenderer.invoke('pitwall:setListener', { host, port }),
});
