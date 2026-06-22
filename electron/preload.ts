import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; content: string } | null>
  saveFile: (content: string, filePath?: string) => Promise<string | null>
  onNewFile: (callback: () => void) => () => void
  onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => () => void
  onSaveFile: (callback: () => void) => () => void
  onSaveAs: (callback: () => void) => () => void
  removeAllListeners: (channel: string) => void
}

const electronAPI: ElectronAPI = {
  openFile: () => ipcRenderer.invoke('dialog-open-file'),
  saveFile: (content: string, filePath?: string) =>
    ipcRenderer.invoke('dialog-save-file', { content, filePath }),
  onNewFile: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu-new-file', handler)
    return () => ipcRenderer.removeListener('menu-new-file', handler)
  },
  onFileOpened: (callback) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('file-opened', handler)
    return () => ipcRenderer.removeListener('file-opened', handler)
  },
  onSaveFile: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu-save-file', handler)
    return () => ipcRenderer.removeListener('menu-save-file', handler)
  },
  onSaveAs: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('menu-save-as', handler)
    return () => ipcRenderer.removeListener('menu-save-as', handler)
  },
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
