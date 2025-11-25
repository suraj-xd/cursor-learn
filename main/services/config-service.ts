import { execSync } from 'child_process'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { expandTildePath } from '../utils/path'
import { getDefaultWorkspacePath, resolveWorkspacePath } from '../utils/workspace-path'
import { getStoredWorkspacePath, setStoredWorkspacePath } from '../store/preferences'

export type EnvironmentInfo = {
  os: NodeJS.Platform | 'unknown'
  isWSL: boolean
  isRemote: boolean
}

export async function detectEnvironment(): Promise<EnvironmentInfo> {
  try {
    let isWSL = false
    const isRemote = Boolean(process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.SSH_TTY)

    try {
      const release = execSync('uname -r', { encoding: 'utf8' }).toLowerCase()
      isWSL = release.includes('microsoft') || release.includes('wsl')
    } catch {
      // ignore
    }

    return {
      os: process.platform,
      isWSL,
      isRemote,
    }
  } catch (error) {
    console.error('Failed to detect environment:', error)
    return {
      os: 'unknown',
      isWSL: false,
      isRemote: false,
    }
  }
}

export type UsernameOptions = {
  osUserInfo: string | null
  envUser: string | null
  envLogname: string | null
  whoami: string | null
  homeDir: string | null
  gitConfigName: string | null
  macRealName: string | null
}

export async function getAllUsernames(): Promise<UsernameOptions> {
  const result: UsernameOptions = {
    osUserInfo: null,
    envUser: null,
    envLogname: null,
    whoami: null,
    homeDir: null,
    gitConfigName: null,
    macRealName: null,
  }

  try { result.osUserInfo = os.userInfo().username } catch {}
  try { result.envUser = process.env.USER || null } catch {}
  try { result.envLogname = process.env.LOGNAME || null } catch {}
  try { result.whoami = execSync('whoami', { encoding: 'utf8' }).trim() } catch {}
  try { result.homeDir = path.basename(os.homedir()) } catch {}
  try { result.gitConfigName = execSync('git config user.name', { encoding: 'utf8' }).trim() } catch {}
  
  if (process.platform === 'darwin') {
    try {
      const raw = execSync('id -F', { encoding: 'utf8' }).trim()
      result.macRealName = raw || null
    } catch {}
  }

  return result
}

export async function getUsername(): Promise<string> {
  try {
    const homeDir = path.basename(os.homedir())
    if (homeDir && homeDir !== 'root') return homeDir

    if (process.platform === 'win32') {
      return process.env.USERNAME || os.userInfo().username
    }

    return process.env.USER || os.userInfo().username
  } catch (error) {
    console.error('Failed to get username:', error)
    return ''
  }
}

export async function validateWorkspacePath(inputPath: string) {
  try {
    const expandedPath = expandTildePath(inputPath)
    if (!existsSync(expandedPath)) {
      return { valid: false, workspaceCount: 0, error: 'Path does not exist' }
    }

    const entries = await fs.readdir(expandedPath, { withFileTypes: true })
    const workspaceCount = entries.filter(entry => {
      if (!entry.isDirectory()) return false
      const dbPath = path.join(expandedPath, entry.name, 'state.vscdb')
      return existsSync(dbPath)
    }).length

    return {
      valid: workspaceCount > 0,
      workspaceCount,
    }
  } catch (error) {
    console.error('Validation error:', error)
    return {
      valid: false,
      workspaceCount: 0,
      error: 'Failed to validate path',
    }
  }
}

export function persistWorkspacePath(inputPath: string) {
  const expandedPath = expandTildePath(inputPath)
  process.env.WORKSPACE_PATH = expandedPath
  setStoredWorkspacePath(expandedPath)
  return expandedPath
}

export function getWorkspacePathConfig() {
  return {
    storedPath: getStoredWorkspacePath(),
    resolvedPath: resolveWorkspacePath(),
    defaultPath: getDefaultWorkspacePath(),
  }
}

