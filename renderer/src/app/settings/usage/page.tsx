"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatDistanceToNow, subDays, format } from "date-fns"
import {
  BarChart3,
  Coins,
  Hash,
  Loader2,
  RefreshCcw,
  Zap,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  usageIpc,
  type UsageStats,
  type UsageByProvider,
  type UsageByModel,
  type UsageByDay,
  type UsageRecord,
} from "@/lib/agents/ipc"
import { cn } from "@/lib/utils"
import { getProvider, type ProviderId } from "@/lib/ai/config"

const TIME_RANGES = [
  { id: "1d", label: "24h", days: 1 },
  { id: "7d", label: "7d", days: 7 },
  { id: "30d", label: "30d", days: 30 },
  { id: "all", label: "All", days: null },
] as const

type TimeRange = (typeof TIME_RANGES)[number]["id"]

const CHART_COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
]

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

function formatCost(cost: number): string {
  if (cost < 0.01) return "<$0.01"
  return `$${cost.toFixed(2)}`
}

export default function UsagePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [byProvider, setByProvider] = useState<UsageByProvider[]>([])
  const [byModel, setByModel] = useState<UsageByModel[]>([])
  const [byDay, setByDay] = useState<UsageByDay[]>([])
  const [recentRecords, setRecentRecords] = useState<UsageRecord[]>([])

  const since = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.id === timeRange)
    if (!range?.days) return undefined
    return subDays(new Date(), range.days).getTime()
  }, [timeRange])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [statsData, providerData, modelData, dayData, records] =
        await Promise.all([
          usageIpc.stats(since),
          usageIpc.byProvider(since),
          usageIpc.byModel(since),
          usageIpc.byDay(since),
          usageIpc.list({ limit: 20, since }),
        ])
      setStats(statsData)
      setByProvider(providerData)
      setByModel(modelData)
      setByDay(dayData)
      setRecentRecords(records)
    } catch (err) {
      console.error("Failed to load usage data", err)
    } finally {
      setIsLoading(false)
    }
  }, [since])

  useEffect(() => {
    loadData()
  }, [loadData])

  const chartData = useMemo(() => {
    return byDay
      .slice(0, 14)
      .reverse()
      .map((day) => ({
        date: format(new Date(day.date), "MMM d"),
        tokens: day.totalTokens,
        calls: day.totalCalls,
        cost: day.costEstimate,
      }))
  }, [byDay])

  const providerChartData = useMemo(() => {
    return byProvider.map((item, index) => ({
      name: getProvider(item.provider as ProviderId)?.name ?? item.provider,
      value: item.totalTokens,
      calls: item.totalCalls,
      cost: item.costEstimate,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))
  }, [byProvider])

  const modelChartData = useMemo(() => {
    return byModel.slice(0, 6).map((item, index) => ({
      name: item.model.length > 20 ? item.model.slice(0, 20) + "..." : item.model,
      fullName: item.model,
      tokens: item.totalTokens,
      calls: item.totalCalls,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))
  }, [byModel])

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your token usage and API costs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 p-0.5">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-3 text-xs rounded-md",
                  timeRange === range.id &&
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => setTimeRange(range.id)}
              >
                {range.label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={loadData}
            disabled={isLoading}
          >
            <RefreshCcw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {isLoading && !stats ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stats?.totalCalls === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted/50 p-4 mb-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-medium mb-1">No usage data yet</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            Start using the AI assistant to see your usage statistics here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={Zap}
              label="Total Tokens"
              value={formatTokens(stats?.totalTokens ?? 0)}
              subValue={`${formatTokens(stats?.inputTokens ?? 0)} in / ${formatTokens(stats?.outputTokens ?? 0)} out`}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <StatCard
              icon={Hash}
              label="API Calls"
              value={(stats?.totalCalls ?? 0).toString()}
              subValue={`${byProvider.length} provider${byProvider.length !== 1 ? "s" : ""}`}
              color="text-violet-500"
              bgColor="bg-violet-500/10"
            />
            <StatCard
              icon={Coins}
              label="Est. Cost"
              value={formatCost(stats?.totalCost ?? 0)}
              subValue="Based on standard pricing"
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
            <StatCard
              icon={TrendingUp}
              label="Avg. Tokens/Call"
              value={formatTokens(
                Math.round(
                  (stats?.totalTokens ?? 0) / Math.max(stats?.totalCalls ?? 1, 1)
                )
              )}
              subValue="Per request"
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
          </div>

          {chartData.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium">Token Usage Over Time</h2>
              <div className="rounded-lg border border-border/60 bg-card p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatTokens(v)}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [
                        formatTokens(value),
                        name === "tokens" ? "Total" : name === "input" ? "Input" : "Output",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke="hsl(262, 83%, 58%)"
                      strokeWidth={2}
                      fill="url(#tokenGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <div className="grid grid-cols-2 gap-4">
            {providerChartData.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium">Usage by Provider</h2>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={providerChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {providerChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number) => [formatTokens(value), "Tokens"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {providerChartData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="font-medium">{formatTokens(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {modelChartData.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium">Top Models</h2>
                <div className="rounded-lg border border-border/60 bg-card p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={modelChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatTokens(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number, _name: string, props: { payload: { fullName: string } }) => [
                          formatTokens(value),
                          props.payload.fullName,
                        ]}
                      />
                      <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                        {modelChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </div>

          {recentRecords.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium">Recent Activity</h2>
              <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/40">
                {recentRecords.slice(0, 10).map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] shrink-0",
                          record.feature === "chat" &&
                            "border-blue-500/30 text-blue-600 dark:text-blue-400",
                          record.feature === "title" &&
                            "border-violet-500/30 text-violet-600 dark:text-violet-400",
                          record.feature === "compact" &&
                            "border-amber-500/30 text-amber-600 dark:text-amber-400",
                          record.feature === "summarization" &&
                            "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {record.feature}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm truncate">{record.model}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(record.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        {formatTokens(record.totalTokens)}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                        <ArrowDownRight className="h-2.5 w-2.5 text-blue-500" />
                        {formatTokens(record.inputTokens)}
                        <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500 ml-1" />
                        {formatTokens(record.outputTokens)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  bgColor,
}: {
  icon: React.ElementType
  label: string
  value: string
  subValue: string
  color: string
  bgColor: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded-md", bgColor)}>
          <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{subValue}</p>
    </div>
  )
}
