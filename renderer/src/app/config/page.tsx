"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { expandTildePath } from "@/utils/path"

export default function ConfigPage() {
  const router = useRouter()
  const [config, setConfig] = useState({
    workspacePath: ''
  })
  const [status, setStatus] = useState<{
    type: 'error' | 'success' | null;
    message: string;
  }>({ type: null, message: '' })

  useEffect(() => {
    const initConfig = async () => {
      if (!window?.ipc) {
        setStatus({
          type: 'error',
          message: 'IPC bridge not available. Restart the app.',
        })
        return
      }
      try {
        const data = await window.ipc.config.getPath()
        const nextPath = data.storedPath || data.resolvedPath || data.defaultPath || ''
        setConfig({ workspacePath: nextPath })
      } catch (error) {
        console.error('Failed to load workspace path:', error)
        setStatus({
          type: 'error',
          message: 'Failed to load workspace configuration.',
        })
      }
    }

    initConfig()
  }, [])

  const validateAndSave = async () => {
    try {
      if (!window?.ipc) {
        throw new Error('IPC bridge unavailable')
      }
      const expandedPath = expandTildePath(config.workspacePath)
      const data = await window.ipc.config.validatePath(expandedPath)
      if (data.valid) {
        await window.ipc.config.setPath(expandedPath)
        setStatus({
          type: 'success',
          message: `Found ${data.workspaceCount} workspaces in the specified location`
        })
        
        setTimeout(() => {
          router.push('/')
        }, 1000)
      } else {
        setStatus({
          type: 'error',
          message: 'No workspaces found in the specified location'
        })
      }
    } catch (error) {
      console.error('Validation error:', error)
      setStatus({
        type: 'error',
        message: 'Failed to validate path. Please check if the path exists and is accessible.'
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Configuration</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Cursor Workspace Path
          </label>
          <Input 
            value={config.workspacePath}
            onChange={(e) => setConfig({ ...config, workspacePath: e.target.value })}
            placeholder="/path/to/cursor/workspaces"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Path to your Cursor workspace storage directory
          </p>
        </div>

        {status.type && (
          <Alert variant={status.type === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{status.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4">
          <Button onClick={validateAndSave}>
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  )
} 