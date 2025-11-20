import path from 'path'
import { app, ipcMain, screen } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import { APP_CONFIG, getAppIconPath } from './app-config'
import {
  listWorkspaces,
  getWorkspaceDetails,
  getWorkspaceTabs,
  listWorkspaceLogs,
  listComposers,
  getComposerById,
  searchWorkspaceData,
} from './services/workspace-service'
import {
  detectEnvironment,
  getUsername,
  validateWorkspacePath,
  persistWorkspacePath,
  getWorkspacePathConfig,
} from './services/config-service'
import { generatePdf } from './services/pdf-service'

const isProd = process.env.NODE_ENV === 'production'

app.setName(APP_CONFIG.appName)

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

  const { workAreaSize } = screen.getPrimaryDisplay()
  const windowWidth = Math.round(workAreaSize.width * APP_CONFIG.window.widthRatio)
  const windowHeight = Math.round(workAreaSize.height * APP_CONFIG.window.heightRatio)

  const mainWindow = createWindow('main', {
    width: windowWidth,
    height: windowHeight,
    title: APP_CONFIG.appName,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.handle('workspace:list', async () => {
  return await listWorkspaces()
})

ipcMain.handle('workspace:details', async (_event, workspaceId: string) => {
  return await getWorkspaceDetails(workspaceId)
})

ipcMain.handle('workspace:tabs', async (_event, workspaceId: string) => {
  return await getWorkspaceTabs(workspaceId)
})

ipcMain.handle('workspace:logs', async () => {
  return await listWorkspaceLogs()
})

ipcMain.handle('workspace:composers', async () => {
  return await listComposers()
})

ipcMain.handle('workspace:composer', async (_event, composerId: string) => {
  return await getComposerById(composerId)
})

ipcMain.handle('workspace:search', async (_event, payload: { query: string; type: 'all' | 'chat' | 'composer' }) => {
  return await searchWorkspaceData(payload.query, payload.type)
})

ipcMain.handle('workspace:path:validate', async (_event, workspacePath: string) => {
  return await validateWorkspacePath(workspacePath)
})

ipcMain.handle('workspace:path:set', async (_event, workspacePath: string) => {
  return persistWorkspacePath(workspacePath)
})

ipcMain.handle('workspace:path:get', async () => {
  return getWorkspacePathConfig()
})

ipcMain.handle('environment:info', async () => {
  return await detectEnvironment()
})

ipcMain.handle('environment:username', async () => {
  return await getUsername()
})

ipcMain.handle('pdf:generate', async (_event, payload: { markdown: string; title: string }) => {
  const buffer = await generatePdf(payload.markdown, payload.title)
  return buffer
})
