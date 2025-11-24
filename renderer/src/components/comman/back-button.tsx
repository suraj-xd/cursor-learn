import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
export const BackButton = memo(function BackButton({
  href = "/",
  label = "",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Button variant={!label ? "ghost" : "default"} size="icon" asChild className={cn("gap-2", !label ? "justify-center" : "")}>
      <Link href={href}>
      <ArrowLeft className="w-4 h-4" />
        {label && label}
      </Link>
    </Button>
  )
})
BackButton.displayName = "BackButton"