"use client";

import { WorkspaceList } from "@/components/workspace-list";
import Preview from "@/components/workspace/vertical-cut-reveal-default";
import { useUsername } from "@/hooks";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

export default function Home() {
  const { firstName, fetch } = useUsername();
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="mx-3">
      <div className="space-y-1 p-4 mt-0 rounded-[8px] w-full h-full border border-border">
        <Preview/>
        <motion.p 
        viewport={{ once: true }}
          className="text-sm text-muted-foreground pt-2.5"
          initial={hasAnimated ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: 1.8,
            duration: 0.5,
            ease: "easeOut"
          }}
          onAnimationComplete={() => setHasAnimated(true)}
        >
          {/* Browse your Cursor chat conversations by project.  */}
          Click on a project to
          view its conversations.
        </motion.p>
        <motion.div
        viewport={{ once: true }}
          initial={hasAnimated ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            delay: 2.1,
            duration: 0.4,
            ease: "easeOut"
          }}
        >
          <WorkspaceList />
        </motion.div>
      </div>
    </div>
  );
}
