import fs from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import type { ChatTab, ComposerChat, ComposerData } from '../../renderer/src/types/workspace'
import { resolveWorkspacePath } from '../utils/workspace-path'

type WorkspaceEntry = {
  name: string
  workspaceJsonPath: string
}

export interface ConversationPreview {
  id: string
  name: string
  lastUpdatedAt: number
}

export interface WorkspaceProject {
  id: string
  name: string
  path?: string
  conversationCount: number
  lastModified: string
  conversations: ConversationPreview[]
}

export interface WorkspaceDetails {
  id: string
  path: string
  folder?: string
  lastModified: string
}

export interface WorkspaceTabsPayload {
  tabs: ChatTab[]
  composers?: ComposerData
}

export interface WorkspaceLog {
  id: string
  workspaceId: string
  workspaceFolder?: string
  title: string
  timestamp: number
  type: 'chat' | 'composer'
  messageCount: number
}

export interface SearchResult {
  workspaceId: string
  workspaceFolder?: string
  chatId: string
  chatTitle: string
  timestamp: string | number
  matchingText: string
  type: 'chat' | 'composer'
}

type ProjectLayoutsMap = Record<string, string[]>

const getProjectFromFilePath = (filePath: string, workspaceEntries: WorkspaceEntry[]): string | null => {
  const normalizedPath = filePath.replace(/^\/Users\/evaran\//, '')
  for (const entry of workspaceEntries) {
    try {
      const workspaceData = JSON.parse(readFileSync(entry.workspaceJsonPath, 'utf-8'))
      if (workspaceData.folder) {
        const workspacePath = workspaceData.folder.replace('file://', '').replace(/^\/Users\/evaran\//, '')
        if (normalizedPath.startsWith(workspacePath)) {
          return entry.name
        }
      }
    } catch (error) {
      console.error(`Error reading workspace ${entry.name}:`, error)
    }
  }
  return null
}

const createProjectNameToWorkspaceIdMap = (workspaceEntries: WorkspaceEntry[]) => {
  const projectNameToWorkspaceId: Record<string, string> = {}
  for (const entry of workspaceEntries) {
    try {
      const workspaceData = JSON.parse(readFileSync(entry.workspaceJsonPath, 'utf-8'))
      if (workspaceData.folder) {
        const workspacePath = workspaceData.folder.replace('file://', '')
        const folderName = workspacePath.split('/').pop() || workspacePath.split('\\').pop()
        if (folderName) {
          projectNameToWorkspaceId[folderName] = entry.name
        }
      }
    } catch (error) {
      console.error(`Error reading workspace ${entry.name}:`, error)
    }
  }
  return projectNameToWorkspaceId
}

const determineProjectForConversation = (
  composerData: Record<string, unknown>,
  composerId: string,
  projectLayoutsMap: ProjectLayoutsMap,
  projectNameToWorkspaceId: Record<string, string>,
  workspaceEntries: WorkspaceEntry[],
  bubbleMap: Record<string, Record<string, unknown>>
) => {
  const projectLayouts = projectLayoutsMap[composerId] || []
  for (const projectName of projectLayouts) {
    const workspaceId = projectNameToWorkspaceId[projectName]
    if (workspaceId) {
      return workspaceId
    }
  }

  if (Array.isArray(composerData.newlyCreatedFiles) && composerData.newlyCreatedFiles.length > 0) {
    for (const file of composerData.newlyCreatedFiles) {
      if (file && typeof file === 'object' && 'uri' in file) {
        const uri = (file as Record<string, unknown>).uri
        if (uri && typeof uri === 'object' && uri !== null && 'path' in uri && typeof (uri as Record<string, unknown>).path === 'string') {
          const projectId = getProjectFromFilePath((uri as Record<string, unknown>).path as string, workspaceEntries)
          if (projectId) return projectId
        }
      }
    }
  }

  if (composerData.codeBlockData && typeof composerData.codeBlockData === 'object' && composerData.codeBlockData !== null) {
    for (const filePathKey of Object.keys(composerData.codeBlockData as Record<string, unknown>)) {
      const normalizedPath = filePathKey.replace('file://', '')
      const projectId = getProjectFromFilePath(normalizedPath, workspaceEntries)
      if (projectId) return projectId
    }
  }

  const conversationHeaders = Array.isArray(composerData.fullConversationHeadersOnly) ? composerData.fullConversationHeadersOnly : []
  for (const header of conversationHeaders) {
    if (header && typeof header === 'object' && 'bubbleId' in header) {
      const bubbleId = (header as Record<string, unknown>).bubbleId
      if (typeof bubbleId === 'string') {
        const bubble = bubbleMap[bubbleId]

        if (bubble) {
          if (Array.isArray(bubble.relevantFiles) && bubble.relevantFiles.length > 0) {
            for (const filePath of bubble.relevantFiles) {
              if (typeof filePath === 'string') {
                const projectId = getProjectFromFilePath(filePath, workspaceEntries)
                if (projectId) return projectId
              }
            }
          }

          if (Array.isArray(bubble.attachedFileCodeChunksUris) && bubble.attachedFileCodeChunksUris.length > 0) {
            for (const uri of bubble.attachedFileCodeChunksUris) {
              if (uri && typeof uri === 'object' && 'path' in uri && typeof (uri as Record<string, unknown>).path === 'string') {
                const projectId = getProjectFromFilePath((uri as Record<string, unknown>).path as string, workspaceEntries)
                if (projectId) return projectId
              }
            }
          }

          if (bubble.context && typeof bubble.context === 'object' && bubble.context !== null && 'fileSelections' in bubble.context) {
            const context = bubble.context as Record<string, unknown>
            if (Array.isArray(context.fileSelections) && context.fileSelections.length > 0) {
              for (const fileSelection of context.fileSelections) {
                if (fileSelection && typeof fileSelection === 'object' && 'uri' in fileSelection) {
                  const fsUri = (fileSelection as Record<string, unknown>).uri
                  if (fsUri && typeof fsUri === 'object' && fsUri !== null && 'path' in fsUri && typeof (fsUri as Record<string, unknown>).path === 'string') {
                    const projectId = getProjectFromFilePath((fsUri as Record<string, unknown>).path as string, workspaceEntries)
                    if (projectId) return projectId
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return null
}

const extractTextFromRichText = (children: Array<Record<string, unknown>>) => {
  let text = ''
  for (const child of children) {
    if (child.type === 'text' && typeof child.text === 'string') {
      text += child.text
    } else if (child.type === 'code' && 'children' in child && Array.isArray(child.children)) {
      text += '\n```\n'
      text += extractTextFromRichText(child.children as Array<Record<string, unknown>>)
      text += '\n```\n'
    } else if ('children' in child && Array.isArray(child.children)) {
      text += extractTextFromRichText(child.children as Array<Record<string, unknown>>)
    }
  }
  return text
}

const extractTextFromBubble = (bubble: Record<string, unknown>) => {
  let text = ''

  if (typeof bubble.text === 'string' && bubble.text.trim()) {
    text = bubble.text
  }

  if (!text && typeof bubble.richText === 'string') {
    try {
      const richTextData = JSON.parse(bubble.richText) as Record<string, unknown>
      if (richTextData.root && typeof richTextData.root === 'object' && richTextData.root !== null && 'children' in richTextData.root) {
        const root = richTextData.root as Record<string, unknown>
        if (Array.isArray(root.children)) {
          text = extractTextFromRichText(root.children as Array<Record<string, unknown>>)
        }
      }
    } catch {
      // ignore invalid rich text
    }
  }

  if (Array.isArray(bubble.codeBlocks)) {
    for (const codeBlock of bubble.codeBlocks) {
      if (codeBlock && typeof codeBlock === 'object' && 'content' in codeBlock) {
        const cb = codeBlock as Record<string, unknown>
        if (typeof cb.content === 'string') {
          const lang = typeof cb.language === 'string' ? cb.language : ''
          text += `\n\n\`\`\`${lang}\n${cb.content}\n\`\`\``
        }
      }
    }
  }

  return text
}

const extractChatIdFromCodeBlockDiffKey = (key: string) => {
  const match = key.match(/^codeBlockDiff:([^:]+):/)
  return match ? match[1] : null
}

const extractChatIdFromBubbleKey = (key: string) => {
  const match = key.match(/^bubbleId:([^:]+):/)
  return match ? match[1] : null
}

const buildProjectLayoutsMap = (rows: Array<{ key: string; value: string }>) => {
  const projectLayoutsMap: ProjectLayoutsMap = {}
  for (const row of rows) {
    const parts = row.key.split(':')
    if (parts.length >= 2) {
      const composerId = parts[1]
      try {
        const context = JSON.parse(row.value)
        if (context.projectLayouts && Array.isArray(context.projectLayouts)) {
          if (!projectLayoutsMap[composerId]) {
            projectLayoutsMap[composerId] = []
          }
          for (const layout of context.projectLayouts) {
            if (typeof layout === 'string') {
              try {
                const layoutObj = JSON.parse(layout)
                if (layoutObj.rootPath) {
                  projectLayoutsMap[composerId].push(layoutObj.rootPath)
                }
              } catch {
                // ignore invalid JSON
              }
            }
          }
        }
      } catch {
        // ignore invalid context
      }
    }
  }
  return projectLayoutsMap
}

const loadWorkspaceEntries = async (workspacePath: string): Promise<WorkspaceEntry[]> => {
  const entries = await fs.readdir(workspacePath, { withFileTypes: true })
  const workspaceEntries: WorkspaceEntry[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const workspaceJsonPath = path.join(workspacePath, entry.name, 'workspace.json')
      if (existsSync(workspaceJsonPath)) {
        workspaceEntries.push({ name: entry.name, workspaceJsonPath })
      }
    }
  }
  return workspaceEntries
}

export async function listWorkspaces(): Promise<WorkspaceProject[]> {
  const workspacePath = resolveWorkspacePath()
  const projects: WorkspaceProject[] = []
  const workspaceEntries = await loadWorkspaceEntries(workspacePath)
  const projectNameToWorkspaceId = createProjectNameToWorkspaceIdMap(workspaceEntries)
  const conversationMap: Record<string, Array<{
    composerId: string
    name: string
    newlyCreatedFiles: Array<{ uri: { path: string } }>
    lastUpdatedAt: number
    createdAt: number
  }>> = {}

  const globalDbPath = path.join(workspacePath, '..', 'globalStorage', 'state.vscdb')
  if (existsSync(globalDbPath)) {
    let globalDb: Database.Database | undefined
    try {
      globalDb = new Database(globalDbPath, { readonly: true })
      const composerRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%' AND LENGTH(value) > 10").all() as Array<{ key: string; value: string }>
      const messageContextRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'messageRequestContext:%'").all() as Array<{ key: string; value: string }>
      const projectLayoutsMap = buildProjectLayoutsMap(messageContextRows)
      const bubbleRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'").all() as Array<{ key: string; value: string }>
      const bubbleMap: Record<string, Record<string, unknown>> = {}

      for (const row of bubbleRows) {
        const bubbleId = row.key.split(':')[2]
        try {
          const bubble = JSON.parse(row.value)
          if (bubble && typeof bubble === 'object') {
            bubbleMap[bubbleId] = bubble as Record<string, unknown>
          }
        } catch {
          // ignore invalid bubbles
        }
      }

      for (const row of composerRows) {
        const composerId = row.key.split(':')[1]
        try {
          const composerData = JSON.parse(row.value)
          const projectId = determineProjectForConversation(
            composerData,
            composerId,
            projectLayoutsMap,
            projectNameToWorkspaceId,
            workspaceEntries,
            bubbleMap
          )
          if (!projectId) {
            continue
          }
          if (!conversationMap[projectId]) {
            conversationMap[projectId] = []
          }
          conversationMap[projectId].push({
            composerId,
            name: composerData.name || `Conversation ${composerId.slice(0, 8)}`,
            newlyCreatedFiles: composerData.newlyCreatedFiles || [],
            lastUpdatedAt: composerData.lastUpdatedAt || composerData.createdAt,
            createdAt: composerData.createdAt
          })
        } catch {
          // ignore invalid composer data
        }
      }
    } catch (error) {
      console.error('Error reading global storage:', error)
    } finally {
      globalDb?.close()
    }
  }

  for (const entry of workspaceEntries) {
    const dbPath = path.join(workspacePath, entry.name, 'state.vscdb')
    if (!existsSync(dbPath)) {
      continue
    }
    const stats = await fs.stat(dbPath)
    let workspaceName = `Project ${entry.name.slice(0, 8)}`
    try {
      const workspaceData = JSON.parse(await fs.readFile(entry.workspaceJsonPath, 'utf-8'))
      if (workspaceData.folder) {
        const folderName = workspaceData.folder.split('/').pop() || workspaceData.folder.split('\\').pop()
        workspaceName = folderName || workspaceName
      }
    } catch {
      console.log(`No workspace.json found for ${entry.name}`)
    }

    const conversations = conversationMap[entry.name] || []
    const conversationPreviews: ConversationPreview[] = conversations
      .sort((a, b) => (b.lastUpdatedAt || 0) - (a.lastUpdatedAt || 0))
      .map(c => ({
        id: c.composerId,
        name: c.name,
        lastUpdatedAt: c.lastUpdatedAt
      }))
    projects.push({
      id: entry.name,
      name: workspaceName,
      path: entry.workspaceJsonPath,
      conversationCount: conversations.length,
      lastModified: stats.mtime.toISOString(),
      conversations: conversationPreviews
    })
  }

  projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
  return projects
}

export async function getWorkspaceDetails(workspaceId: string): Promise<WorkspaceDetails | null> {
  const workspacePath = resolveWorkspacePath()
  const dbPath = path.join(workspacePath, workspaceId, 'state.vscdb')
  const workspaceJsonPath = path.join(workspacePath, workspaceId, 'workspace.json')

  if (!existsSync(dbPath)) {
    return null
  }

  const stats = await fs.stat(dbPath)
  let folder: string | undefined

  try {
    const workspaceData = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf-8'))
    folder = workspaceData.folder
  } catch {
    console.log(`No workspace.json found for ${workspaceId}`)
  }

  return {
    id: workspaceId,
    path: dbPath,
    folder,
    lastModified: stats.mtime.toISOString()
  }
}

export async function getWorkspaceTabs(workspaceId: string): Promise<WorkspaceTabsPayload> {
  const workspacePath = resolveWorkspacePath()
  const workspaceEntries = await loadWorkspaceEntries(workspacePath)
  const projectNameToWorkspaceId = createProjectNameToWorkspaceIdMap(workspaceEntries)
  const globalDbPath = path.join(workspacePath, '..', 'globalStorage', 'state.vscdb')
  const response: WorkspaceTabsPayload = { tabs: [] }

  if (!existsSync(globalDbPath)) {
    return response
  }

  let globalDb: Database.Database | undefined
  try {
    globalDb = new Database(globalDbPath, { readonly: true })
    const bubbleRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'").all() as Array<{ key: string; value: string }>
    const bubbleMap: Record<string, Record<string, unknown>> = {}
    for (const row of bubbleRows) {
      const bubbleId = row.key.split(':')[2]
      try {
        const bubble = JSON.parse(row.value)
        if (bubble && typeof bubble === 'object') {
          bubbleMap[bubbleId] = bubble as Record<string, unknown>
        }
      } catch {
        // ignore invalid bubbles
      }
    }

    const codeBlockDiffRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'codeBlockDiff:%'").all() as Array<{ key: string; value: string }>
    const codeBlockDiffMap: Record<string, Array<{
      diffId: string
      newModelDiffWrtV0: Array<{ modified?: string[] }>
      originalModelDiffWrtV0: Array<{ modified?: string[] }>
    }>> = {}
    for (const row of codeBlockDiffRows) {
      const chatId = extractChatIdFromCodeBlockDiffKey(row.key)
      if (!chatId) continue
      try {
        const codeBlockDiff = JSON.parse(row.value) as {
          newModelDiffWrtV0: Array<{ modified?: string[] }>
          originalModelDiffWrtV0: Array<{ modified?: string[] }>
        }
        if (!codeBlockDiffMap[chatId]) codeBlockDiffMap[chatId] = []
        codeBlockDiffMap[chatId].push({
          ...codeBlockDiff,
          diffId: row.key.split(':')[2]
        })
      } catch {
        // ignore invalid diffs
      }
    }

    const messageRequestContextRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'messageRequestContext:%'").all() as Array<{ key: string; value: string }>
    const messageRequestContextMap: Record<string, Array<Record<string, unknown>>> = {}
    for (const row of messageRequestContextRows) {
      const parts = row.key.split(':')
      if (parts.length >= 3) {
        const chatId = parts[1]
        const contextId = parts[2]
        try {
          const context = JSON.parse(row.value) as Record<string, unknown>
          if (!messageRequestContextMap[chatId]) messageRequestContextMap[chatId] = []
          messageRequestContextMap[chatId].push({
            ...context,
            contextId
          })
        } catch {
          // ignore
        }
      }
    }

    const projectLayoutsMap = buildProjectLayoutsMap(messageRequestContextRows)
    const composerRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%' AND value LIKE '%fullConversationHeadersOnly%' AND value NOT LIKE '%fullConversationHeadersOnly\":[]%'").all() as Array<{ key: string; value: string }>

    for (const row of composerRows) {
      const composerId = row.key.split(':')[1]
      try {
        const composerData = JSON.parse(row.value)
        const projectId = determineProjectForConversation(
          composerData,
          composerId,
          projectLayoutsMap,
          projectNameToWorkspaceId,
          workspaceEntries,
          bubbleMap
        )
        if (projectId !== workspaceId) {
          continue
        }

        const conversationHeaders = Array.isArray(composerData.fullConversationHeadersOnly) ? composerData.fullConversationHeadersOnly : []
        const bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp: number }> = []

        for (const header of conversationHeaders) {
          if (header && typeof header === 'object' && 'bubbleId' in header) {
            const bubbleId = (header as Record<string, unknown>).bubbleId
            if (typeof bubbleId === 'string') {
              const bubble = bubbleMap ? bubbleMap[bubbleId] : null
              if (bubble) {
                const headerType = (header as Record<string, unknown>).type
                const isUser = headerType === 1
                const messageType = isUser ? 'user' : 'ai'
                const text = extractTextFromBubble(bubble)
                const fullText = text
                if (fullText.trim()) {
                  const timestamp = typeof bubble.timestamp === 'number' ? bubble.timestamp : Date.now()
                  bubbles.push({
                    type: messageType,
                    text: fullText,
                    timestamp
                  })
                }
              }
            }
          }
        }

        if (bubbles.length > 0) {
          let title = typeof composerData.name === 'string' ? composerData.name : `Conversation ${composerId.slice(0, 8)}`
          if (!composerData.name && bubbles.length > 0) {
            const firstMessage = bubbles[0].text
            if (firstMessage) {
              const firstLines = firstMessage.split('\n').filter((line: string) => line.trim().length > 0)
              if (firstLines.length > 0) {
                title = firstLines[0].substring(0, 100)
                if (title.length === 100) title += '...'
              }
            }
          }

          const codeBlockDiffs = codeBlockDiffMap[composerId] || []
          const lastUpdated = typeof composerData.lastUpdatedAt === 'number'
            ? composerData.lastUpdatedAt
            : (typeof composerData.createdAt === 'number' ? composerData.createdAt : Date.now())

          response.tabs.push({
            id: composerId,
            title,
            timestamp: new Date(lastUpdated).getTime(),
            bubbles: bubbles
              .filter(bubble => bubble.text && bubble.text.trim().length > 0)
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
              .map(bubble => ({
                type: bubble.type,
                text: bubble.text,
                timestamp: bubble.timestamp
              })),
            codeBlockDiffs
          })
        }
      } catch {
        // ignore invalid composer data
      }
    }
  } finally {
    globalDb?.close()
  }

  return response
}

export async function listComposers(): Promise<Array<ComposerChat & { workspaceId: string; workspaceFolder?: string }>> {
  const workspacePath = resolveWorkspacePath()
  const composers: Array<ComposerChat & { workspaceId: string; workspaceFolder?: string }> = []
  const entries = await fs.readdir(workspacePath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dbPath = path.join(workspacePath, entry.name, 'state.vscdb')
    const workspaceJsonPath = path.join(workspacePath, entry.name, 'workspace.json')
    if (!existsSync(dbPath)) continue

    let workspaceFolder: string | undefined
    try {
      const workspaceData = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf-8'))
      workspaceFolder = workspaceData.folder
    } catch {
      console.log(`No workspace.json found for ${entry.name}`)
    }

    const db = new Database(dbPath, { readonly: true })
    try {
      const result = db.prepare(`
        SELECT value FROM ItemTable 
        WHERE [key] = 'composer.composerData'
      `).get() as { value: string } | undefined
      if (result && result.value) {
        const composerData = JSON.parse(result.value) as ComposerData
        const composersWithWorkspace = composerData.allComposers.map(composer => ({
          ...composer,
          conversation: composer.conversation || [],
          workspaceId: entry.name,
          workspaceFolder
        }))
        composers.push(...composersWithWorkspace)
      }
    } finally {
      db.close()
    }
  }

  composers.sort((a, b) => {
    const aTime = a.lastUpdatedAt || 0
    const bTime = b.lastUpdatedAt || 0
    return bTime - aTime
  })

  return composers
}

export async function getComposerById(composerId: string): Promise<ComposerChat | null> {
  const workspacePath = resolveWorkspacePath()
  const entries = await fs.readdir(workspacePath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dbPath = path.join(workspacePath, entry.name, 'state.vscdb')
    if (!existsSync(dbPath)) continue

    const db = new Database(dbPath, { readonly: true })
    try {
      const result = db.prepare(`
        SELECT value FROM ItemTable 
        WHERE [key] = 'composer.composerData'
      `).get() as { value: string } | undefined
      if (result && result.value) {
        const composerData = JSON.parse(result.value) as ComposerData
        const composer = composerData.allComposers.find((c: ComposerChat) => c.composerId === composerId)
        if (composer) {
          return composer
        }
      }
    } finally {
      db.close()
    }
  }

  return null
}

export async function listWorkspaceLogs(): Promise<WorkspaceLog[]> {
  const workspacePath = resolveWorkspacePath()
  const logs: WorkspaceLog[] = []
  const globalDbPath = path.join(workspacePath, '..', 'globalStorage', 'state.vscdb')

  if (existsSync(globalDbPath)) {
    let globalDb: Database.Database | undefined
    try {
      globalDb = new Database(globalDbPath, { readonly: true })
      const bubbleRows = globalDb.prepare("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'").all() as Array<{ key: string; value: string }>
      const chatMap: Record<string, any[]> = {}
      for (const row of bubbleRows) {
        const chatId = extractChatIdFromBubbleKey(row.key)
        if (!chatId) continue
        try {
          const bubble = JSON.parse(row.value)
          if (!chatMap[chatId]) chatMap[chatId] = []
          chatMap[chatId].push(bubble)
        } catch {
          // ignore invalid bubble
        }
      }
      for (const chatId of Object.keys(chatMap)) {
        let bubbles = chatMap[chatId]
        bubbles = bubbles.filter(b => b && typeof b === 'object')
        if (!bubbles.length) continue
        bubbles.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        const first = bubbles[0]
        const last = bubbles[bubbles.length - 1]
        if (!first || !last) continue
        logs.push({
          id: chatId,
          workspaceId: 'global',
          workspaceFolder: undefined,
          title: first.text?.split('\n')[0] || `Chat ${chatId.slice(0, 8)}`,
          timestamp: last.timestamp || Date.now(),
          type: 'chat',
          messageCount: bubbles.length
        })
      }
    } catch (error) {
      console.error('Error reading global storage:', error)
    } finally {
      globalDb?.close()
    }
  }

  const entries = await fs.readdir(workspacePath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dbPath = path.join(workspacePath, entry.name, 'state.vscdb')
    const workspaceJsonPath = path.join(workspacePath, entry.name, 'workspace.json')
    if (!existsSync(dbPath)) continue

    let workspaceFolder: string | undefined
    try {
      const workspaceData = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf-8'))
      workspaceFolder = workspaceData.folder
    } catch {
      // ignore
    }

    const db = new Database(dbPath, { readonly: true })
    try {
      const chatResult = db.prepare(`SELECT value FROM ItemTable WHERE [key] = 'workbench.panel.aichat.view.aichat.chatdata'`).get() as { value: string } | undefined
      if (chatResult && chatResult.value) {
        const chatData = JSON.parse(chatResult.value)
        if (chatData.tabs && Array.isArray(chatData.tabs)) {
          const chatLogs = chatData.tabs.map((tab: ChatTab) => ({
            id: tab.id || '',
            workspaceId: entry.name,
            workspaceFolder,
            title: tab.title || `Chat ${(tab.id || '').slice(0, 8)}`,
            timestamp: new Date(tab.timestamp).getTime(),
            type: 'chat' as const,
            messageCount: tab.bubbles?.length || 0
          }))
          logs.push(...chatLogs)
        }
      }

      const composerResult = db.prepare(`SELECT value FROM ItemTable WHERE [key] = 'composer.composerData'`).get() as { value: string } | undefined
      if (composerResult && composerResult.value) {
        const composerData = JSON.parse(composerResult.value)
        if (composerData.allComposers && Array.isArray(composerData.allComposers)) {
          const composerLogs = composerData.allComposers.map((composer: ComposerChat) => ({
            id: composer.composerId || '',
            workspaceId: entry.name,
            workspaceFolder,
            title: composer.text || `Composer ${(composer.composerId || '').slice(0, 8)}`,
            timestamp: composer.lastUpdatedAt || composer.createdAt || Date.now(),
            type: 'composer' as const,
            messageCount: composer.conversation?.length || 0
          }))
          logs.push(...composerLogs)
        }
      }
    } catch (error) {
      console.error(`Error processing workspace ${entry.name}:`, error)
    } finally {
      db.close()
    }
  }

  logs.sort((a, b) => b.timestamp - a.timestamp)
  return logs
}

export async function searchWorkspaceData(query: string, type: 'all' | 'chat' | 'composer'): Promise<SearchResult[]> {
  const workspacePath = resolveWorkspacePath()
  const results: SearchResult[] = []

  if (!query) {
    return results
  }

  const globalDbPath = path.join(workspacePath, '..', 'globalStorage', 'state.vscdb')
  if (existsSync(globalDbPath) && (type === 'all' || type === 'chat')) {
    let globalDb: Database.Database | undefined
    try {
      globalDb = new Database(globalDbPath, { readonly: true })
      const globalChatResult = globalDb.prepare(`
        SELECT value FROM ItemTable 
        WHERE [key] = 'workbench.panel.aichat.view.aichat.chatdata'
      `).get() as { value: string } | undefined

      if (globalChatResult && globalChatResult.value) {
        const chatData = JSON.parse(globalChatResult.value)
        for (const tab of chatData.tabs) {
          let hasMatch = false
          let matchingText = ''

          if (tab.chatTitle?.toLowerCase().includes(query.toLowerCase())) {
            hasMatch = true
            matchingText = tab.chatTitle
          }

          for (const bubble of tab.bubbles) {
            if (bubble.text?.toLowerCase().includes(query.toLowerCase())) {
              hasMatch = true
              matchingText = bubble.text
              break
            }
          }

          if (hasMatch) {
            results.push({
              workspaceId: 'global',
              workspaceFolder: undefined,
              chatId: tab.tabId,
              chatTitle: tab.chatTitle || `Chat ${tab.tabId?.substring(0, 8) || 'Untitled'}`,
              timestamp: tab.lastSendTime || new Date().toISOString(),
              matchingText,
              type: 'chat'
            })
          }
        }
      }
    } catch (error) {
      console.error('Error searching global storage:', error)
    } finally {
      globalDb?.close()
    }
  }

  const entries = await fs.readdir(workspacePath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dbPath = path.join(workspacePath, entry.name, 'state.vscdb')
    const workspaceJsonPath = path.join(workspacePath, entry.name, 'workspace.json')
    if (!existsSync(dbPath)) continue

    let workspaceFolder: string | undefined
    try {
      const workspaceData = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf-8'))
      workspaceFolder = workspaceData.folder
    } catch {
      console.log(`No workspace.json found for ${entry.name}`)
    }

    const db = new Database(dbPath, { readonly: true })
    try {
      if (type === 'all' || type === 'chat') {
        const chatResult = db.prepare(`
          SELECT value FROM ItemTable 
          WHERE [key] = 'workbench.panel.aichat.view.aichat.chatdata'
        `).get() as { value: string } | undefined

        if (chatResult && chatResult.value) {
          const chatData = JSON.parse(chatResult.value)
          for (const tab of chatData.tabs) {
            let hasMatch = false
            let matchingText = ''

            if (tab.chatTitle?.toLowerCase().includes(query.toLowerCase())) {
              hasMatch = true
              matchingText = tab.chatTitle
            }

            for (const bubble of tab.bubbles) {
              if (bubble.text?.toLowerCase().includes(query.toLowerCase())) {
                hasMatch = true
                matchingText = bubble.text
                break
              }
            }

            if (hasMatch) {
              results.push({
                workspaceId: entry.name,
                workspaceFolder,
                chatId: tab.tabId,
                chatTitle: tab.chatTitle || `Chat ${tab.tabId?.substring(0, 8) || 'Untitled'}`,
                timestamp: tab.lastSendTime || new Date().toISOString(),
                matchingText,
                type: 'chat'
              })
            }
          }
        }
      }

      if (type === 'all' || type === 'composer') {
        const composerResult = db.prepare(`
          SELECT value FROM ItemTable 
          WHERE [key] = 'composer.composerData'
        `).get() as { value: string } | undefined

        if (composerResult && composerResult.value) {
          const composerData = JSON.parse(composerResult.value)
          for (const composer of composerData.allComposers) {
            let hasMatch = false
            let matchingText = ''

            if (composer.text?.toLowerCase().includes(query.toLowerCase())) {
              hasMatch = true
              matchingText = composer.text
            }

            if (Array.isArray(composer.conversation)) {
              for (const message of composer.conversation) {
                if (message.text?.toLowerCase().includes(query.toLowerCase())) {
                  hasMatch = true
                  matchingText = message.text
                  break
                }
              }
            }

            if (hasMatch) {
              results.push({
                workspaceId: entry.name,
                workspaceFolder,
                chatId: composer.composerId,
                chatTitle: composer.text || `Composer ${composer.composerId.substring(0, 8)}`,
                timestamp: composer.lastUpdatedAt || composer.createdAt || new Date().toISOString(),
                matchingText,
                type: 'composer'
              })
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing workspace ${entry.name}:`, error)
    } finally {
      db.close()
    }
  }

  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return results
}

