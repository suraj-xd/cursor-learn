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

export async function getUsername(): Promise<string> {
  try {
    let username = 'YOUR_USERNAME'
    if (process.platform === 'win32') {
      username = process.env.USERNAME || os.userInfo().username
      return username
    }

    try {
      const output = execSync('cmd.exe /c echo %USERNAME%', { encoding: 'utf8' })
      username = output.trim()
    } catch {
      username = os.userInfo().username
    }

    return username
  } catch (error) {
    console.error('Failed to get username:', error)
    return 'YOUR_USERNAME'
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

