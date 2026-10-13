'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const IN = ['pet:init', 'pet:pose', 'pet:say', 'pet:hideBubble', 'pet:view', 'viewer:data', 'memo:init', 'memo:place', 'memo:bad', 'pick:init', 'pick:planned', 'pick:busy', 'color:init'];
const OUT = ['pet:hit', 'pet:dragStart', 'pet:dragEnd', 'pet:menu', 'pet:bubbleDone', 'viewer:close', 'memo:save', 'memo:close', 'memo:size', 'memo:draft', 'pet:dropHover', 'pet:drop', 'pick:plan', 'pick:go', 'pick:close', 'color:ready', 'color:pick', 'color:cancel'];
contextBridge.exposeInMainWorld('TP', {
  on: (ch, cb) => { if (IN.includes(ch)) ipcRenderer.on(ch, (e, d) => cb(d)); },
  send: (ch, d) => { if (OUT.includes(ch)) ipcRenderer.send(ch, d); },
  pathsOf: (files) => Array.from(files || []).map((f) => { try { return webUtils.getPathForFile(f); } catch (e) { return ''; } }),
});
