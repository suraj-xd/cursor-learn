import Store from 'electron-store'

export type Preferences = {
  workspacePath?: string
  theme?: 'light' | 'dark'
}

export const preferencesStore = new Store<Preferences>({
  name: 'preferences',
  clearInvalidConfig: true,
})

export function getStoredWorkspacePath(): string | undefined {
  const path = preferencesStore.get('workspacePath')
  if (typeof path === 'string' && path.trim().length > 0) {
    return path.trim()
  }
  return undefined
}

export function setStoredWorkspacePath(path: string) {
  preferencesStore.set('workspacePath', path)
}

