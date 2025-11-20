import os from 'os'
import path from 'path'

export function expandTildePath(inputPath: string): string {
  if (!inputPath) {
    return inputPath
  }

  const homePath = os.homedir()

  if (inputPath.startsWith('~/')) {
    return path.join(homePath, inputPath.slice(2))
  }

  if (inputPath.startsWith(homePath)) {
    return inputPath
  }

  if (inputPath.includes('Library/Application Support') && !inputPath.startsWith(homePath)) {
    return path.join(homePath, inputPath)
  }

  return inputPath
}

