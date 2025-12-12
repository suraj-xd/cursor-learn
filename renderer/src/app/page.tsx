"use client";

import CursorCubeIcon from "@/components/brand-icons/Cursor-cube-icon";
import { WorkspaceList } from "@/components/workspace-list";
import Preview from "@/components/workspace/vertical-cut-reveal-default";
import { useUsername } from "@/hooks";
import { useEffect } from "react";

export default function Home() {
  const { fetch } = useUsername();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="mx-3">
      <div className="space-y-1 p-4 mt-0 rounded-[8px] w-full h-full border border-border">
        <Preview />
        <div>
          <WorkspaceList />
        </div>
      </div>
    </div>
  );
}
