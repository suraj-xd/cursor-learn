export function Loading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-lg text-muted-foreground animate-pulse">{message}</p>
    </div>
  )
} 