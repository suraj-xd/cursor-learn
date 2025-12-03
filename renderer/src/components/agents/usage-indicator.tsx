"use client"

import { useEffect, useState, useCallback } from "react"
import { Coins, TrendingUp, Loader2 } from "lucide-react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { usageIpc, type UsageStats } from "@/lib/agents/ipc"

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

function formatCost(cost: number): string {
  if (cost < 0.001) return "$0.00"
  if (cost < 0.01) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

type UsageIndicatorProps = {
  className?: string
  refreshTrigger?: number
}

export function UsageIndicator({ className, refreshTrigger }: UsageIndicatorProps) {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [prevStats, setPrevStats] = useState<UsageStats | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const data = await usageIpc.stats(todayStart.getTime())
      setPrevStats(stats)
      setStats(data)
    } catch {
      console.error("Failed to load usage stats")
    } finally {
      setIsLoading(false)
    }
  }, [stats])

  useEffect(() => {
    loadStats()
  }, [refreshTrigger])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading && !stats) {
    return (
      <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    )
  }

  if (!stats) return null

  const hasIncrease = prevStats && stats.totalTokens > prevStats.totalTokens

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors ${className}`}
        >
          <Coins className="h-3 w-3" />
          <span className={hasIncrease ? "text-primary animate-pulse" : ""}>
            {formatCost(stats.totalCost)}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-52 p-0" align="end" side="top">
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Today's Usage</span>
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tokens</span>
              <span className="font-mono">{formatTokens(stats.totalTokens)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Input</span>
              <span className="font-mono text-muted-foreground">
                {formatTokens(stats.inputTokens)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Output</span>
              <span className="font-mono text-muted-foreground">
                {formatTokens(stats.outputTokens)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">API Calls</span>
              <span className="font-mono">{stats.totalCalls}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between bg-secondary px-3 py-2 text-xs border-t">
          <span className="text-muted-foreground">Est. Cost</span>
          <span className="font-medium">{formatCost(stats.totalCost)}</span>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

