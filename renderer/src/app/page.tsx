import { WorkspaceList } from "@/components/workspace-list"

export default function Home() {
  return (
    <div className="space-y-6">
      <span className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground">
        Workspace overview
      </span>
      <h1 className="text-5xl font-serif font-light">Projects</h1>
      <p className="text-lg text-muted-foreground">
        Browse your Cursor chat conversations by project. Click on a project to view its conversations.
      </p>
      <WorkspaceList />
    </div>
  )
} 