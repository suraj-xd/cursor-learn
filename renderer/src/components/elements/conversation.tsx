import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { forwardRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConversationProps = ComponentProps<"div">;

export const Conversation = forwardRef<HTMLDivElement, ConversationProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex-1 touch-pan-y overflow-y-auto will-change-scroll",
        className
      )}
      role="log"
      {...props}
    />
  )
);
Conversation.displayName = "Conversation";

export type ConversationContentProps = ComponentProps<"div">;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <div className={cn("p-4", className)} {...props} />
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button> & {
  isAtBottom: boolean;
  scrollToBottom: () => void;
};

export const ConversationScrollButton = ({
  className,
  isAtBottom,
  scrollToBottom,
  ...props
}: ConversationScrollButtonProps) => {
  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (isAtBottom) return null;

  return (
    <Button
      className={cn(
        "-translate-x-1/2 absolute bottom-4 left-1/2 z-10 rounded-full shadow-lg",
        className
      )}
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};

