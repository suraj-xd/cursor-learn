import { Suspense } from 'react'
import { Loading } from '@/components/ui/loading'
import WorkspaceClient from './workspace-client'

export default function WorkspacePage() {
  return (
    <Suspense fallback={<Loading />}>
      <WorkspaceClient />
    </Suspense>
  )
}

