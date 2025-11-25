import path from 'path'
import { app, ipcMain, screen } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import { APP_CONFIG, getAppIconPath } from './app-config'
import { initAgentDatabase, closeAgentDatabase } from './services/database'
import {
  listApiKeys,
  upsertApiKey,
  deleteApiKey,
  listChats,
  createChat,
  getChatById,
  deleteChat,
  insertMessage,
  listMessagesForChat,
  recordChatMention,
  listMentionsForChat,
  getApiKey,
  updateChatModel,
  updateChatTitle,
} from './services/agent-storage'
import { generateAssistantMessage, generateAssistantMessageStreaming, generateChatTitle, prepareChatContext } from './services/agent-runtime'
import {
  listWorkspaces,
  getWorkspaceDetails,
  getWorkspaceTabs,
  listWorkspaceLogs,
  listComposers,
  getComposerById,
  searchWorkspaceData,
  getConversationById,
} from './services/workspace-service'
import {
  detectEnvironment,
  getUsername,
  getAllUsernames,
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

  initAgentDatabase()

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

app.on('before-quit', () => {
  closeAgentDatabase()
})

const redactApiKey = (provider: string) => {
  const record = getApiKey(provider)
  if (!record) return null

  const { secret, ...rest } = record
  return rest
}

ipcMain.handle('agents:api-keys:list', () => {
  return listApiKeys().map(({ secret, ...rest }) => rest)
})

ipcMain.handle('agents:api-keys:set', (_event, payload: { provider: string; secret: string; label?: string | null }) => {
  upsertApiKey(payload)
  return redactApiKey(payload.provider)
})

ipcMain.handle('agents:api-keys:delete', (_event, provider: string) => {
  deleteApiKey(provider)
  return true
})

ipcMain.handle(
  'agents:chats:list',
  (
    _event,
    payload:
      | {
          limit?: number
          search?: string
          workspaceConversationId?: string | null
        }
      | undefined,
  ) => {
    return listChats(payload ?? {})
  },
)

ipcMain.handle(
  'agents:chats:create',
  (
    _event,
    payload: {
      id?: string
      title: string
      modelId: string
      provider: string
      summary?: string | null
      workspaceConversationId?: string | null
    },
  ) => {
    return createChat(payload)
  },
)

ipcMain.handle('agents:chats:get', (_event, chatId: string) => {
  const chat = getChatById(chatId)
  if (!chat) return null

  return {
    chat,
    messages: listMessagesForChat(chatId),
    mentions: listMentionsForChat(chatId),
  }
})

ipcMain.handle('agents:chats:delete', (_event, chatId: string) => {
  deleteChat(chatId)
  return true
})

ipcMain.handle(
  'agents:chats:update-model',
  (_event, payload: { chatId: string; modelId: string }) => {
    return updateChatModel(payload)
  },
)

ipcMain.handle('agents:messages:list', (_event, chatId: string) => {
  return listMessagesForChat(chatId)
})

ipcMain.handle(
  'agents:messages:append',
  (
    _event,
    payload: {
      id?: string
      chatId: string
      role: 'user' | 'assistant' | 'system'
      content: string
      metadata?: unknown
      tokenUsage?: number
      createdAt?: number
    },
  ) => {
    return insertMessage(payload)
  },
)

ipcMain.handle(
  'agents:mentions:add',
  (_event, payload: { chatId: string; mentionedChatId: string }) => {
    recordChatMention(payload)
    return listMentionsForChat(payload.chatId)
  },
)

ipcMain.handle('agents:mentions:list', (_event, chatId: string) => {
  return listMentionsForChat(chatId)
})

ipcMain.handle('agents:chat:complete', async (_event, chatId: string) => {
  return await generateAssistantMessage(chatId)
})

ipcMain.handle('agents:chat:complete-stream', async (event, chatId: string) => {
  const webContents = event.sender
  return await generateAssistantMessageStreaming(chatId, (chunk, done) => {
    webContents.send('agents:stream-chunk', { chatId, chunk, done })
  })
})

ipcMain.handle('agents:chat:updateTitle', async (_event, payload: { chatId: string; title: string }) => {
  return updateChatTitle(payload)
})

ipcMain.handle('agents:chat:generateTitle', async (_event, payload: { chatId: string; userMessage: string }) => {
  return await generateChatTitle(payload.chatId, payload.userMessage)
})

ipcMain.handle('agents:chat:prepareContext', async (_event, chatId: string) => {
  return await prepareChatContext(chatId)
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

ipcMain.handle('workspace:conversation', async (_event, payload: { workspaceId: string; conversationId: string; type: 'chat' | 'composer' }) => {
  return await getConversationById(payload.workspaceId, payload.conversationId, payload.type)
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

ipcMain.handle('environment:usernames:all', async () => {
  return await getAllUsernames()
})

ipcMain.handle('pdf:generate', async (_event, payload: { markdown: string; title: string }) => {
  const buffer = await generatePdf(payload.markdown, payload.title)
  return buffer
})
