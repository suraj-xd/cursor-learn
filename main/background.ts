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
  getUsageStats,
  getUsageByProvider,
  getUsageByModel,
  getUsageByDay,
  listUsageRecords,
  type UsageFeature,
} from './services/agent-storage'
import { generateAssistantMessage, generateAssistantMessageStreaming, generateChatTitle, prepareChatContext } from './services/agent-runtime'
import {
  startCompactSession,
  cancelCompactSession,
  getCompactedChatForConversation,
  getSessionStatus,
  getActiveSession,
  generateSuggestedQuestions,
  type ConversationInput,
} from './services/compact-agent'
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
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  toggleNotePin,
  getNotesCount,
  getAllLabels as getAllNoteLabels,
} from './services/notes-storage'
import {
  listSnippets,
  getSnippet,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  toggleSnippetPin,
  getSnippetsCount,
  getLanguages,
  getAllSnippetLabels,
  migrateFromLocalStorage,
} from './services/snippets-storage'

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

ipcMain.handle(
  'compact:start',
  async (
    event,
    payload: {
      workspaceId: string
      conversationId: string
      title: string
      bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
    }
  ) => {
    const webContents = event.sender
    const conversation: ConversationInput = {
      workspaceId: payload.workspaceId,
      conversationId: payload.conversationId,
      title: payload.title,
      bubbles: payload.bubbles,
    }

    const result = await startCompactSession(conversation, (session) => {
      webContents.send('compact:progress', {
        sessionId: session.id,
        workspaceId: payload.workspaceId,
        conversationId: payload.conversationId,
        status: session.status,
        progress: session.progress,
        currentStep: session.currentStep,
        chunksTotal: session.chunksTotal,
        chunksProcessed: session.chunksProcessed,
      })
    })

    return {
      session: result.session,
      compactedChat: result.compactedChat,
    }
  }
)

ipcMain.handle('compact:cancel', async (_event, sessionId: string) => {
  return await cancelCompactSession(sessionId)
})

ipcMain.handle(
  'compact:get',
  async (_event, payload: { workspaceId: string; conversationId: string }) => {
    return getCompactedChatForConversation(payload.workspaceId, payload.conversationId)
  }
)

ipcMain.handle('compact:session:status', async (_event, sessionId: string) => {
  return getSessionStatus(sessionId)
})

ipcMain.handle(
  'compact:session:active',
  async (_event, payload: { workspaceId: string; conversationId: string }) => {
    return getActiveSession(payload.workspaceId, payload.conversationId)
  }
)

ipcMain.handle(
  'compact:suggestions',
  async (_event, compactedContent: string) => {
    return await generateSuggestedQuestions(compactedContent)
  }
)

ipcMain.handle('usage:stats', async (_event, since?: number) => {
  return getUsageStats(since)
})

ipcMain.handle('usage:by-provider', async (_event, since?: number) => {
  return getUsageByProvider(since)
})

ipcMain.handle('usage:by-model', async (_event, since?: number) => {
  return getUsageByModel(since)
})

ipcMain.handle('usage:by-day', async (_event, since?: number) => {
  return getUsageByDay(since)
})

ipcMain.handle(
  'usage:list',
  async (
    _event,
    options?: { limit?: number; since?: number; provider?: string; feature?: UsageFeature }
  ) => {
    return listUsageRecords(options ?? {})
  }
)

ipcMain.handle('notes:list', (_event, options?: { limit?: number; offset?: number; search?: string }) => {
  return listNotes(options)
})

ipcMain.handle('notes:get', (_event, id: string) => {
  return getNote(id)
})

ipcMain.handle('notes:create', (_event, payload: { id?: string; title?: string | null; content: string; plainText: string; labels?: string[] }) => {
  return createNote(payload)
})

ipcMain.handle('notes:update', (_event, payload: { id: string; title?: string | null; content?: string; plainText?: string; labels?: string[]; isPinned?: boolean }) => {
  const { id, ...rest } = payload
  return updateNote(id, rest)
})

ipcMain.handle('notes:delete', (_event, id: string) => {
  return deleteNote(id)
})

ipcMain.handle('notes:toggle-pin', (_event, id: string) => {
  return toggleNotePin(id)
})

ipcMain.handle('notes:count', () => {
  return getNotesCount()
})

ipcMain.handle('notes:labels', () => {
  return getAllNoteLabels()
})

ipcMain.handle('snippets:list', (_event, options?: { limit?: number; offset?: number; search?: string; language?: string }) => {
  return listSnippets(options)
})

ipcMain.handle('snippets:get', (_event, id: string) => {
  return getSnippet(id)
})

ipcMain.handle('snippets:create', (_event, payload: { id?: string; code: string; language: string; title?: string | null; labels?: string[]; sourceContext?: string | null }) => {
  return createSnippet(payload)
})

ipcMain.handle('snippets:update', (_event, payload: { id: string; code?: string; language?: string; title?: string | null; labels?: string[]; isPinned?: boolean }) => {
  const { id, ...rest } = payload
  return updateSnippet(id, rest)
})

ipcMain.handle('snippets:delete', (_event, id: string) => {
  return deleteSnippet(id)
})

ipcMain.handle('snippets:toggle-pin', (_event, id: string) => {
  return toggleSnippetPin(id)
})

ipcMain.handle('snippets:count', () => {
  return getSnippetsCount()
})

ipcMain.handle('snippets:languages', () => {
  return getLanguages()
})

ipcMain.handle('snippets:labels', () => {
  return getAllSnippetLabels()
})

ipcMain.handle('snippets:migrate', (_event, snippets: Array<{ id: string; code: string; language: string; createdAt: string }>) => {
  return migrateFromLocalStorage(snippets)
})
