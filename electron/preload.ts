import { contextBridge, ipcRenderer } from 'electron'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface ElectronAPI {
  openFile: () => Promise<{ filePath: string; content: string } | null>
  openFolder: () => Promise<string | null>
  saveFile: (content: string, filePath?: string) => Promise<string | null>
  getInitialFile: () => Promise<{ filePath: string; content: string } | null>
  readDirectory: (dirPath: string) => Promise<FileEntry[]>
  readFileContent: (filePath: string) => Promise<{ filePath: string; content: string } | null>
  onNewFile: (callback: () => void) => () => void
  onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => () => void
  onFolderOpened: (callback: (folderPath: string) => void) => () => void
  onSaveFile: (callback: () => void) => () => void
  onSaveAs: (callback: () => void) => () => void
  removeAllListeners: (channel: string) => void
}

const electronAPI: ElectronAPI = {
  openFile: () => ipcRenderer.invoke('dialog-open-file'),
  openFolder: () => ipcRenderer.invoke('dialog-open-folder'),
  saveFile: (content: string, filePath?: string) =>
    ipcRenderer.invoke('dialog-save-file', { content, filePath }),
  getInitialFile: () => ipcRenderer.invoke('get-initial-file'),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('read-directory', dirPath),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
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
  onFolderOpened: (callback) => {
    const handler = (_: any, folderPath: string) => callback(folderPath)
    ipcRenderer.on('folder-opened', handler)
    return () => ipcRenderer.removeListener('folder-opened', handler)
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
