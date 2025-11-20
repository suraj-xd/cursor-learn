import { WorkspaceList } from "@/components/workspace-list";

export default function Home() {
  return (
    <div className="space-y-1 mt-5">
      <h1 className="text-xl font-sans font-medium">Workspaces</h1>
      <p className="text-sm text-muted-foreground">
        Browse your Cursor chat conversations by project. Click on a project to
        view its conversations.
      </p>
      <WorkspaceList />
    </div>
  );
}
