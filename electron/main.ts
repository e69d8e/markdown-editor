import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join, isAbsolute, resolve } from 'path'
import { readFile, writeFile, stat, readdir } from 'fs/promises'

const isDev = !app.isPackaged

app.name = 'Markdown Editor'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Markdown Editor',
    icon: join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev
    }
  })

  // 开发模式加载 Vite 开发服务器
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createMenu()

  // macOS Dock 图标
  if (process.platform === 'darwin') {
    try {
      const iconPath = join(__dirname, '..', '..', 'build', 'icon.png')
      app.dock.setIcon(iconPath)
    } catch (_) {
      // icon.png 不存在时忽略
    }
  }
}

function createMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = []

  // macOS 应用菜单
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  template.push(
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu-new-file')
        },
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile()
        },
        {
          label: '打开文件夹',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => handleOpenFolder()
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu-save-file')
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' }
            ]
          : [])
      ]
    }
  )

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

async function handleOpenFile() {
  if (!mainWindow) return

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    mainWindow.webContents.send('file-opened', { filePath, content })
  }
}

async function handleOpenFolder() {
  if (!mainWindow) return

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0]
    mainWindow.webContents.send('folder-opened', folderPath)
  }
}

// IPC 处理
ipcMain.handle('dialog-open-file', async () => {
  if (!mainWindow) return null

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    return { filePath, content }
  }
  return null
})

ipcMain.handle('dialog-open-folder', async () => {
  if (!mainWindow) return null

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('read-directory', async (_, dirPath: string) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const result = entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: join(dirPath, e.name),
        isDirectory: e.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    return result
  } catch (error) {
    console.error(`Failed to read directory: ${dirPath}`, error)
    return []
  }
})

ipcMain.handle('read-file-content', async (_, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { filePath, content }
  } catch (error) {
    console.error(`Failed to read file: ${filePath}`, error)
    return null
  }
})

ipcMain.handle('dialog-save-file', async (_, { content, filePath }) => {
  if (!mainWindow) return null

  if (filePath) {
    await writeFile(filePath, content, 'utf-8')
    return filePath
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text', extensions: ['txt'] }
    ]
  })

  if (!result.canceled && result.filePath) {
    await writeFile(result.filePath, content, 'utf-8')
    return result.filePath
  }
  return null
})

ipcMain.handle('get-initial-file', async () => {
  if (fileToOpen) {
    try {
      const content = await readFile(fileToOpen, 'utf-8')
      const filePath = fileToOpen
      fileToOpen = null
      return { filePath, content }
    } catch (error) {
      console.error(`Failed to read initial file: ${fileToOpen}`, error)
      fileToOpen = null
    }
  }
  return null
})

let fileToOpen: string | null = null

async function getFilePathFromArgs(args: string[], workingDir?: string): Promise<string | null> {
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('-')) continue
    if (arg === '.' || arg === 'dev' || arg === 'build' || arg === 'preview') continue

    const hasValidExt = /\.(md|markdown|txt)$/i.test(arg)

    try {
      const fullPath = isAbsolute(arg) ? arg : (workingDir ? resolve(workingDir, arg) : resolve(arg))
      const fileStat = await stat(fullPath)
      if (fileStat.isFile()) {
        return fullPath
      }
    } catch (_) {
      if (hasValidExt) {
        return isAbsolute(arg) ? arg : (workingDir ? resolve(workingDir, arg) : resolve(arg))
      }
    }
  }
  return null
}

async function openFile(filePath: string) {
  try {
    const content = await readFile(filePath, 'utf-8')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('file-opened', { filePath, content })
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  } catch (error) {
    console.error(`Failed to open file: ${filePath}`, error)
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      
      const filePath = await getFilePathFromArgs(commandLine, workingDirectory)
      if (filePath) {
        openFile(filePath)
      }
    }
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (mainWindow && !mainWindow.isDestroyed()) {
      openFile(filePath)
    } else {
      fileToOpen = filePath
    }
  })

  app.whenReady().then(async () => {
    const filePath = await getFilePathFromArgs(process.argv)
    if (filePath) {
      fileToOpen = filePath
    }
    createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
