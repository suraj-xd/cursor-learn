import { ShiningText } from "../comman/shinning-text";

  export function Loading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <ShiningText text={message} />
    </div>
  )
} 