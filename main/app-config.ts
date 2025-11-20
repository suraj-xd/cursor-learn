import path from 'path'
import { app } from 'electron'

const getBasePath = () => {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.join(__dirname, '..')
}

const PLATFORM_ICON_MAP: Partial<Record<NodeJS.Platform, string>> & { default: string } = {
  darwin: 'resources/icon.icns',
  win32: 'resources/icon.ico',
  linux: 'resources/icon.icns',
  default: 'resources/icon.icns',
}

export const APP_CONFIG = {
  appName: 'Cursor Learn',
  window: {
    widthRatio: 0.8,
    heightRatio: 0.9,
  },
  assets: {
    trayIcon: 'resources/icon.icns',
  },
}

export const resolveAssetPath = (relativePath: string) => {
  return path.join(getBasePath(), relativePath)
}

export const getAppIconPath = () => {
  const key = PLATFORM_ICON_MAP[process.platform] ? process.platform : 'default'
  return resolveAssetPath(PLATFORM_ICON_MAP[key] ?? PLATFORM_ICON_MAP.default)
}

export const getTrayIconPath = () => {
  return resolveAssetPath(APP_CONFIG.assets.trayIcon)
}


