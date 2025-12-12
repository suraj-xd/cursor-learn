import { AILoader } from "./ai-loader"

export function Loading({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AILoader description={message} mode="loading" />
    </div>
  )
} 