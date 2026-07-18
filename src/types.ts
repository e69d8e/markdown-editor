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
  onCheckDirty: (handler: () => boolean) => void
  setDirty: (dirty: boolean) => void
  onSaveFileDirect: (handler: () => Promise<void>) => void
  onNewFile: (callback: () => void) => () => void
  onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => () => void
  onFolderOpened: (callback: (folderPath: string) => void) => () => void
  onSaveFile: (callback: () => void) => () => void
  onSaveAs: (callback: () => void) => () => void
}
