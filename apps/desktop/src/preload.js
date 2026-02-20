const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('gratonite', {
  platform: process.platform,
  versions: process.versions,
});
