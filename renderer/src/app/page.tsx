import { WorkspaceList } from "@/components/workspace-list";

export default function Home() {
  return (
    <div className="mx-3">
    <div className="space-y-1 p-4 mt-0 rounded-[8px] w-full h-full border border-border ">
      <h1 className="text-xl font-sans font-medium text-accent">Workspace</h1>
      <p className="text-sm text-muted-foreground">
        Browse your Cursor chat conversations by project. Click on a project to
        view its conversations.
      </p>
      <WorkspaceList />
    </div>
    </div>
  );
}
