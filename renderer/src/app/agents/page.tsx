import { Suspense } from "react"
import { AgentsWorkspace } from "@/components/agents/agents-workspace"

export default function AgentsPage() {
  return (
    <div className="mx-3">
      <Suspense fallback={null}>
        <AgentsWorkspace />
      </Suspense>
    </div>
  )
}

