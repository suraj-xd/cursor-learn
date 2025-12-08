"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  AlertCircle,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Github,
  Key,
  Lightbulb,
  Loader2,
  Microscope,
  MoreVertical,
  Play,
  Plus,
  Presentation,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Video,
  Wrench,
  Check,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { AILoader } from "@/components/ui/ai-loader"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { useResourcesStore, resourcesActions } from "@/store/resources"
import { useSettingsStore } from "@/store/settings"
import { ApiKeyDialog } from "@/components/comman/api-key-dialog"
import type { ChatTab } from "@/types/workspace"
import type { Resource, ResourceType, ResourceCategory, ResourcesProviderId } from "@/types/resources"
import { CATEGORY_INFO } from "@/types/resources"
import { RESOURCES_PROVIDER_OPTIONS } from "@/lib/ai/config"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ResourcesViewProps {
  workspaceId: string
  conversationId: string
  conversationTitle: string
  bubbles: ChatTab["bubbles"]
}

const RESOURCE_ICONS: Record<ResourceType, typeof Video> = {
  video: Video,
  documentation: FileText,
  article: BookOpen,
  tool: Wrench,
  github: Github,
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  video: "text-red-500",
  documentation: "text-blue-500",
  article: "text-green-500",
  tool: "text-purple-500",
  github: "text-gray-500",
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  brain: Brain,
  "scroll-text": ScrollText,
  "trending-up": TrendingUp,
  presentation: Presentation,
  microscope: Microscope,
  wrench: Wrench,
}

function ResearchBanner({ hasPerplexity, hasTavily }: { hasPerplexity: boolean; hasTavily: boolean }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || hasPerplexity || hasTavily) return null

  return (
    <div className="mx-4 mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Enhance Your Resources</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add Perplexity or Tavily API keys for deeper research and better resource discovery.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
              <Link href="/settings/llm">
                <Settings className="h-3 w-3 mr-1" />
                Configure
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResourceCard({ resource }: { resource: Resource }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showRelevance, setShowRelevance] = useState(false)
  const Icon = RESOURCE_ICONS[resource.type]
  const iconColor = RESOURCE_COLORS[resource.type]

  const canEmbed = resource.type === "video" && resource.embedUrl

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-3">
        <div className="flex items-start gap-3">
          {resource.thumbnail ? (
            <img
              src={resource.thumbnail}
              alt=""
              className="w-16 h-12 rounded object-cover shrink-0"
            />
          ) : (
            <div className={cn("p-2 rounded-md bg-muted shrink-0", iconColor)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {resource.favicon && (
                <img src={resource.favicon} alt="" className="w-4 h-4 rounded-sm" />
              )}
              <span className="text-[10px] text-muted-foreground truncate">
                {resource.domain}
              </span>
              {resource.source !== "ai" && (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4">
                  <Search className="h-2 w-2 mr-0.5" />
                  {resource.source === "perplexity" ? "Perplexity" : "Tavily"}
                </Badge>
              )}
            </div>
            <h4 className="text-sm font-medium mt-1 line-clamp-2">{resource.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {resource.description}
            </p>
            {resource.relevanceReason && (
              <button
                type="button"
                className="text-[10px] text-primary/70 hover:text-primary mt-1 flex items-center gap-1"
                onClick={() => setShowRelevance(!showRelevance)}
              >
                <Lightbulb className="h-3 w-3" />
                {showRelevance ? "Hide why" : "Why this?"}
              </button>
            )}
            {showRelevance && resource.relevanceReason && (
              <p className="text-[10px] text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                {resource.relevanceReason}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {canEmbed && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Play className="h-3 w-3" />
              {isExpanded ? "Hide" : "Watch"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            asChild
          >
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
          </Button>
        </div>
      </div>
      {isExpanded && resource.embedUrl && (
        <div className="border-t border-border">
          <div className="aspect-video">
            <iframe
              src={resource.embedUrl}
              title={resource.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CategorySection({
  category,
  resources,
  defaultOpen = true,
}: {
  category: ResourceCategory
  resources: Resource[]
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const info = CATEGORY_INFO[category]
  const IconComponent = CATEGORY_ICONS[info.iconName] || BookOpen

  if (resources.length === 0) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left px-1 rounded hover:bg-muted/50 transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="p-1.5 rounded-md bg-primary/10">
            <IconComponent className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium">{info.label}</span>
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs ml-auto">
            {resources.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pl-6">
        <p className="text-xs text-muted-foreground mb-2">{info.description}</p>
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function ProviderDropdown({
  selectedProvider,
  onSelect,
  availableProviders,
}: {
  selectedProvider: ResourcesProviderId
  onSelect: (provider: ResourcesProviderId) => void
  availableProviders: string[]
}) {
  const selectedOption = RESOURCES_PROVIDER_OPTIONS.find((o) => o.id === selectedProvider)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          {selectedOption?.label || "Auto"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Resource Provider
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {RESOURCES_PROVIDER_OPTIONS.map((option) => {
          const isAvailable = option.id === "auto" || availableProviders.includes(option.id)
          return (
            <DropdownMenuItem
              key={option.id}
              onClick={() => isAvailable && onSelect(option.id)}
              className={cn(
                "gap-2 cursor-pointer",
                !isAvailable && "opacity-50 cursor-not-allowed"
              )}
              disabled={!isAvailable}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{option.label}</span>
                  {selectedProvider === option.id && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{option.description}</p>
              </div>
              {option.label === 'Tavily' && (
                <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5 border border-border">
                  Best
                </p>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ResourcesView({
  workspaceId,
  conversationId,
  conversationTitle,
  bubbles,
}: ResourcesViewProps) {
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [userRequest, setUserRequest] = useState("")

  const {
    resources,
    topics,
    analysis,
    isGenerating,
    generationError,
    hasTavilyKey,
    hasPerplexityKey,
    availableProviders,
    hasApiKey,
  } = useResourcesStore()

  const { autoRunResources, setAutoRunResources, resourcesProvider, setResourcesProvider } = useSettingsStore()

  useEffect(() => {
    resourcesActions.checkProviderStatus()
  }, [])

  useEffect(() => {
    if (!workspaceId || !conversationId) return

    const loadOrGenerate = async () => {
      const hasCached = await resourcesActions.loadCached(workspaceId, conversationId)
      if (hasCached) {
        setInitialized(true)
        return
      }

      if (autoRunResources && hasApiKey && bubbles.length > 0) {
        setInitialized(true)
        resourcesActions.generateResources(
          workspaceId,
          conversationId,
          conversationTitle,
          bubbles,
          { preferredProvider: resourcesProvider }
        )
      } else {
        setInitialized(true)
      }
    }

    if (!initialized) {
      loadOrGenerate()
    }
  }, [autoRunResources, hasApiKey, initialized, workspaceId, conversationId, conversationTitle, bubbles, resourcesProvider])

  const handleGenerate = useCallback(() => {
    if (!hasApiKey && !hasPerplexityKey) {
      setShowApiKeyDialog(true)
      return
    }
    resourcesActions.generateResources(
      workspaceId,
      conversationId,
      conversationTitle,
      bubbles,
      { preferredProvider: resourcesProvider }
    )
    setInitialized(true)
  }, [workspaceId, conversationId, conversationTitle, bubbles, resourcesProvider, hasApiKey, hasPerplexityKey])

  const handleRegenerate = useCallback(() => {
    resourcesActions.clearResources()
    handleGenerate()
  }, [handleGenerate])

  const handleAddMore = useCallback((customRequest?: string) => {
    resourcesActions.addMoreResources(
      workspaceId,
      conversationId,
      conversationTitle,
      bubbles,
      customRequest
    )
    setShowAddDialog(false)
    setUserRequest("")
  }, [workspaceId, conversationId, conversationTitle, bubbles])

  const groupedByCategory = useMemo(() => {
    const groups: Record<ResourceCategory, Resource[]> = {
      fundamentals: [],
      documentation: [],
      tutorials: [],
      videos: [],
      deep_dives: [],
      tools: [],
    }
    
    for (const r of resources) {
      const category = r.category || "tutorials"
      if (groups[category]) {
        groups[category].push(r)
      } else {
        groups.tutorials.push(r)
      }
    }
    
    return groups
  }, [resources])

  const categoryOrder: ResourceCategory[] = [
    "fundamentals",
    "documentation",
    "tutorials",
    "videos",
    "deep_dives",
    "tools",
  ]

  if (!hasApiKey && !hasPerplexityKey) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Key className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-medium mb-2">API Key Required</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add an API key (Google, OpenAI, Anthropic, or Perplexity) to discover learning resources from this conversation.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setShowApiKeyDialog(true)}>
              Add API Key
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings/llm">
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Link>
            </Button>
          </div>
        </div>
        <ApiKeyDialog
          open={showApiKeyDialog}
          onOpenChange={setShowApiKeyDialog}
          provider="an AI provider"
          feature="resources"
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Resources</span>
          {resources.length > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
              {resources.length}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ProviderDropdown
            selectedProvider={resourcesProvider}
            onSelect={setResourcesProvider}
            availableProviders={availableProviders}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleRegenerate} className="gap-2 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm">Auto Run</span>
                <Switch
                  checked={autoRunResources}
                  className="border border-border"
                  onCheckedChange={setAutoRunResources}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ResearchBanner hasPerplexity={hasPerplexityKey} hasTavily={hasTavilyKey} />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isGenerating && resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AILoader variant="compact" />
            </div>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <h3 className="text-sm font-departure uppercase text-muted-foreground">Resources</h3>
              <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                Discover learning resources from your conversation
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 font-departure"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <Sparkles className="h-3 w-3" />
                Find
              </Button>
            </div>
          ) : (
            <>
              {analysis && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Lightbulb className="h-3.5 w-3.5 text-primary" />
                    Understanding Your Problem
                  </div>
                  <p className="text-sm text-foreground">
                    {analysis.coreProblem}
                  </p>
                  {/* {analysis.solutionApproach && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Solution approach:</span> {analysis.solutionApproach}
                    </p>
                  )} */}
                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {topics.map((topic) => (
                        <Badge
                          key={topic}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 font-normal"
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {categoryOrder.map((category) => (
                <CategorySection
                  key={category}
                  category={category}
                  resources={groupedByCategory[category]}
                  defaultOpen={category === "fundamentals" || category === "documentation"}
                />
              ))}

              {generationError && (
                <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-destructive">
                        {generationError.includes('API key') ? 'API Key Issue' :
                         generationError.includes('rate') ? 'Rate Limit' :
                         generationError.includes('quota') ? 'Quota Exceeded' :
                         'Something went wrong'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {generationError}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleGenerate}
                          disabled={isGenerating}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Try Again
                        </Button>
                        {generationError.includes('API key') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            asChild
                          >
                            <Link href="/settings/llm">
                              <Settings className="h-3 w-3 mr-1" />
                              Settings
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-2 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowAddDialog(true)}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add More Resources
                </Button>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add More Resources</DialogTitle>
            <DialogDescription>
              Want resources on a specific aspect? Describe what you want to learn more about.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="e.g., error handling patterns, performance optimization..."
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddMore(userRequest || undefined)
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to find more resources based on your conversation
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAddMore(userRequest || undefined)}>
              Find Resources
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
