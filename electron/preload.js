const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
});

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => {
    const validSendChannels = ['update-proxy-settings'];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  invoke: async (channel, data) => {
    const validInvokeChannels = ['resolve-proxy'];
    if (validInvokeChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
    throw new Error(`Unauthorized IPC invoke channel: ${channel}`);
  },
});
