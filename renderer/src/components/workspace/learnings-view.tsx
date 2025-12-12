"use client"

import { useEffect, useState, useMemo, useCallback, type ComponentType } from "react"
import {
  Code2,
  ListChecks,
  ToggleLeft,
  Plus,
  Loader2,
  AlertCircle,
  BookOpen,
  MoreVertical,
  RefreshCw,
  Lightbulb,
  Clock,
  CheckCircle2,
  Circle,
  RotateCcw,
  Bug,
  Wrench,
  Eye,
  FileCode,
  Timer,
} from "lucide-react"
import { AILoader } from "@/components/ui/ai-loader"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { json } from "@codemirror/lang-json"
import { css } from "@codemirror/lang-css"
import { markdown } from "@codemirror/lang-markdown"
import { yaml } from "@codemirror/lang-yaml"
import { useLearningsStore, learningsActions } from "@/store/learnings"
import { useSettingsStore } from "@/store/settings"
import { getCodeThemeStyle } from "@/lib/code-themes"
import { useTheme } from "@/components/theme-provider"
import { agentsIpc } from "@/lib/agents/ipc"
import { PROVIDER_PRIORITY } from "@/lib/ai/config"
import { compactIpc } from "@/lib/agents/compact-ipc"
import { ApiKeyDialog } from "@/components/comman/api-key-dialog"
import type { ChatTab } from "@/types/workspace"
import type { ProviderId } from "@/lib/ai/config"
import type {
  ExerciseType,
  Exercise,
  InteractiveExercise,
  McqExercise,
  TrueFalseExercise,
  ExerciseAttempt,
  ChallengeType,
} from "@/types/learnings"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

interface LearningsViewProps {
  workspaceId: string
  conversationId: string
  conversationTitle: string
  bubbles: ChatTab["bubbles"]
}

const TAB_CONFIG: { type: ExerciseType; label: string; icon: typeof Code2 }[] = [
  { type: "interactive", label: "Interactive", icon: Code2 },
  { type: "mcq", label: "Multiple Choice", icon: ListChecks },
  { type: "tf", label: "True / False", icon: ToggleLeft },
]

export function LearningsView({
  workspaceId,
  conversationId,
  conversationTitle,
  bubbles,
}: LearningsViewProps) {
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("google")
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash")
  const [initialized, setInitialized] = useState(false)
  const [contextText, setContextText] = useState(
    bubbles.map((b) => `[${b.type.toUpperCase()}]: ${b.text}`).join("\n\n")
  )
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [userRequest, setUserRequest] = useState("")

  const {
    exercises,
    attempts,
    activeTab,
    isGenerating,
    generationError,
    generationStatus,
  } = useLearningsStore()
  const { autoRunLearnings, setAutoRunLearnings } = useSettingsStore()

  useEffect(() => {
    setContextText(bubbles.map((b) => `[${b.type.toUpperCase()}]: ${b.text}`).join("\n\n"))
  }, [bubbles])

  useEffect(() => {
    const loadCompact = async () => {
      if (!workspaceId || !conversationId) return
      try {
        const compacted = await compactIpc.get(workspaceId, conversationId)
        if (compacted?.compactedContent) {
          setContextText(compacted.compactedContent)
        }
      } catch {
        // fallback to raw context already set
      }
    }
    loadCompact()
  }, [workspaceId, conversationId])

  useEffect(() => {
    agentsIpc.apiKeys.list().then((keys) => {
      const providers = keys
        .map((k) => k.provider as ProviderId)
        .filter((p) => PROVIDER_PRIORITY.includes(p))

      const sortedProviders = Array.from(new Set(providers)).sort(
        (a, b) => PROVIDER_PRIORITY.indexOf(a) - PROVIDER_PRIORITY.indexOf(b)
      )

      if (sortedProviders.length > 0) {
        setHasApiKey(true)
        setSelectedProvider(sortedProviders[0])
        if (sortedProviders[0] === "google") {
          setSelectedModel("gemini-2.0-flash")
        } else if (sortedProviders[0] === "anthropic") {
          setSelectedModel("claude-3-5-haiku-20241022")
        } else if (sortedProviders[0] === "openai") {
          setSelectedModel("gpt-4o-mini")
        }
      } else {
        setHasApiKey(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!workspaceId || !conversationId) return

    const loadOrGenerate = async () => {
      const hasCached = await learningsActions.loadCached(workspaceId, conversationId)
      if (hasCached) {
        setInitialized(true)
        return
      }

      if (autoRunLearnings && hasApiKey && contextText.length > 0) {
        setInitialized(true)
        learningsActions.generateForConversation(
          contextText,
          conversationTitle,
          selectedProvider,
          selectedModel,
          { workspaceId, conversationId, bubbles }
        )
      }
    }

    if (!initialized) {
      loadOrGenerate()
    }
  }, [autoRunLearnings, hasApiKey, initialized, contextText, conversationTitle, selectedProvider, selectedModel, workspaceId, conversationId])

  const handleOpenAddDialog = useCallback(() => {
    setUserRequest("")
    setShowAddDialog(true)
  }, [])

  const handleAddMore = useCallback((customRequest?: string) => {
    learningsActions.addMoreExercises(
      contextText,
      conversationTitle,
      selectedProvider,
      selectedModel,
      { workspaceId, conversationId, bubbles },
      activeTab,
      3,
      customRequest
    )
    setShowAddDialog(false)
    setUserRequest("")
  }, [contextText, conversationTitle, selectedProvider, selectedModel, activeTab, workspaceId, conversationId, bubbles])

  const handleRegenerate = useCallback(() => {
    learningsActions.clearExercises()
    setInitialized(true)
    learningsActions.generateForConversation(
      contextText,
      conversationTitle,
      selectedProvider,
      selectedModel,
      { workspaceId, conversationId, bubbles }
    )
  }, [contextText, conversationTitle, selectedProvider, selectedModel, workspaceId, conversationId, bubbles])

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => ex.type === activeTab)
  }, [exercises, activeTab])

  if (!hasApiKey) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <BookOpen className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">API Key Required</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add an API key to generate learning exercises from this conversation.
          </p>
          <Button onClick={() => setShowApiKeyDialog(true)}>
            Add API Key
          </Button>
        </div>
        <ApiKeyDialog
          open={showApiKeyDialog}
          onOpenChange={setShowApiKeyDialog}
          provider="an AI provider"
          feature="learnings"
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
        <div className="flex items-center gap-2">
          {TAB_CONFIG.map(({ type, label, icon: Icon }) => {
            const count = exercises.filter((ex) => ex.type === type).length
            return (
              <button
                key={type}
                type="button"
                onClick={() => learningsActions.setActiveTab(type)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === type
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {count > 0 && (
                  <Badge
                    variant={activeTab === type ? "secondary" : "outline"}
                    className="h-5 min-w-5 px-1.5 text-xs"
                  >
                    {count}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>

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
            {isGenerating && (
              <DropdownMenuItem onClick={learningsActions.cancelGeneration} className="gap-2 cursor-pointer">
                Cancel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm">Auto Run</span>
              <Switch
                checked={autoRunLearnings}
                className="border border-border"
                onCheckedChange={setAutoRunLearnings}
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isGenerating && filteredExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AILoader variant="compact" />
              <p className="text-xs text-muted-foreground mt-2">Generating exercises...</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={learningsActions.cancelGeneration}
              >
                Cancel
              </Button>
            </div>
          ) : filteredExercises.length === 0 ? (
            <>
              {generationError && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-center text-xs max-w-[500px] text-wrap">{generationError?.length > 100 ? `${generationError.slice(0, 100)}...` : generationError}</p>
                  </div>
                  <Button size="sm" onClick={handleRegenerate} variant="outline">
                    Try again
                  </Button>
                </div>
              )}
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <h3 className="text-sm font-departure uppercase text-muted-foreground">Learnings</h3>
                <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                  Practice exercises from your conversation
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 font-departure"
                  onClick={handleOpenAddDialog}
                  disabled={isGenerating}
                >
                  <Plus className="h-3 w-3" />
                  Generate
                </Button>
              </div>
            </>
          ) : (
            <>
              {filteredExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  attempt={attempts[exercise.id]}
                  provider={selectedProvider}
                  modelId={selectedModel}
                  workspaceId={workspaceId}
                  conversationId={conversationId}
                />
              ))}

              {generationError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="flex-1">{generationError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerate}
                    className="shrink-0"
                  >
                    Retry
                  </Button>
                </div>
              )}

              <div className="flex justify-center pt-2 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleOpenAddDialog}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add More Exercises
                </Button>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add More Exercises</DialogTitle>
            <DialogDescription>
              Want exercises on a specific topic? Describe what you&apos;d like to practice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="e.g., closures, async/await, React hooks..."
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddMore(userRequest || undefined)
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to generate based on conversation context
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleAddMore(userRequest || undefined)}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ExerciseCardProps {
  exercise: Exercise
  attempt?: ExerciseAttempt
  provider: ProviderId
  modelId: string
  workspaceId: string
  conversationId: string
}

function ExerciseCard({ exercise, attempt, provider, modelId, workspaceId, conversationId }: ExerciseCardProps) {
  if (exercise.type === "interactive") {
    return (
      <InteractiveCard
        exercise={exercise}
        attempt={attempt}
        provider={provider}
        modelId={modelId}
        workspaceId={workspaceId}
        conversationId={conversationId}
      />
    )
  }
  if (exercise.type === "mcq") {
    return <McqCard exercise={exercise} attempt={attempt} />
  }
  return <TfCard exercise={exercise} attempt={attempt} />
}

interface InteractiveCardProps {
  exercise: InteractiveExercise
  attempt?: ExerciseAttempt
  provider: ProviderId
  modelId: string
  workspaceId: string
  conversationId: string
}

function InteractiveCard({ exercise, attempt, provider, modelId, workspaceId, conversationId }: InteractiveCardProps) {
  const { codeTheme } = useSettingsStore()
  const { resolvedColorMode } = useTheme()
  const codeStyle = useMemo(() => {
    if (resolvedColorMode === "light") {
      return getCodeThemeStyle("oneLight")
    }
    return getCodeThemeStyle(codeTheme)
  }, [codeTheme, resolvedColorMode])
  const { isEvaluating } = useLearningsStore()

  const [userCode, setUserCode] = useState(exercise.starterCode)
  const [showSolution, setShowSolution] = useState(false)
  const [completedGoals, setCompletedGoals] = useState<Set<number>>(new Set())
  
  const revealedHintLevel = attempt?.revealedHintLevel ?? 0
  const tieredHints = exercise.tieredHints ?? []
  const stepGoals = exercise.stepGoals ?? []
  const challengeType = exercise.challengeType ?? "fill-blank"
  const estimatedMinutes = exercise.estimatedMinutes ?? 5

  const changedLines = useMemo(() => {
    const starter = exercise.starterCode.split("\n")
    const expected = exercise.expectedSolution.split("\n")
    const max = Math.max(starter.length, expected.length)
    const changed = new Set<number>()
    for (let i = 0; i < max; i++) {
      if (starter[i] !== expected[i]) changed.add(i + 1)
    }
    return changed
  }, [exercise.starterCode, exercise.expectedSolution])

  const Highlighter = SyntaxHighlighter as unknown as ComponentType<{
    style: Record<string, React.CSSProperties>
    language: string
    PreTag: string
    customStyle: React.CSSProperties
    children: string
  }>

  const getLanguageExtension = (lang: string) => {
    const langKey = lang.toLowerCase()
    switch (langKey) {
      case "javascript":
      case "js":
        return javascript()
      case "typescript":
      case "ts":
        return javascript({ typescript: true })
      case "jsx":
        return javascript({ jsx: true })
      case "tsx":
        return javascript({ jsx: true, typescript: true })
      case "python":
      case "py":
        return python()
      case "json":
        return json()
      case "css":
        return css()
      case "markdown":
      case "md":
        return markdown()
      case "yaml":
      case "yml":
        return yaml()
      default:
        return javascript()
    }
  }

  const handleVerify = () => {
    learningsActions.evaluateInteractive(
      exercise,
      userCode,
      provider,
      modelId,
      { workspaceId, conversationId }
    )
  }

  const handleReset = () => {
    setUserCode(exercise.starterCode)
    learningsActions.resetAttempt(exercise.id)
    setShowSolution(false)
    setCompletedGoals(new Set())
  }

  const handleRevealHint = () => {
    learningsActions.revealHint(exercise.id)
  }

  const handleReviewLater = () => {
    learningsActions.markForReview(exercise.id, 30)
  }

  const toggleGoal = (idx: number) => {
    setCompletedGoals((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <ChallengeTypeIcon type={challengeType} />
          <span className="text-sm font-medium">
            <ChallengeTypeLabel type={challengeType} />
          </span>
          <DifficultyBadge difficulty={exercise.difficulty} />
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Timer className="h-3 w-3" />
            ~{estimatedMinutes}m
          </span>
        </div>
        <div className="flex items-center gap-2">
          {attempt && <StatusBadge status={attempt.status} />}
          {attempt && attempt.attemptsCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {attempt.attemptsCount} attempt{attempt.attemptsCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{exercise.prompt || "Exercise"}</p>
          {exercise.topics && exercise.topics.length > 0 && (
            <TopicBadges topics={exercise.topics} />
          )}
        </div>

        {stepGoals.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground font-medium">Goals</span>
            <div className="space-y-1">
              {stepGoals.map((goal, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleGoal(idx)}
                  className={cn(
                    "flex items-center gap-2 text-xs w-full text-left py-1 px-2 rounded-md transition-colors",
                    completedGoals.has(idx)
                      ? "text-muted-foreground line-through bg-muted/30"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  {completedGoals.has(idx) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  {goal}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileCode className="h-3 w-3" />
              {exercise.language.toUpperCase()}
            </span>
          </div>
          <div className="rounded-md border overflow-hidden">
            <CodeMirror
              value={userCode}
              onChange={setUserCode}
              extensions={[getLanguageExtension(exercise.language)]}
              editable={attempt?.status !== "correct"}
              theme={resolvedColorMode}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                foldGutter: false,
              }}
              className="text-xs min-h-[120px] [&_.cm-editor]:!outline-none [&_.cm-focused]:ring-2 [&_.cm-focused]:ring-primary/50"
              style={{
                fontSize: "0.75rem",
              }}
            />
          </div>
        </div>

        {tieredHints.length > 0 && revealedHintLevel > 0 && (
          <div className="space-y-2">
            {tieredHints
              .filter((h) => h.level <= revealedHintLevel)
              .map((h) => (
                <div
                  key={h.level}
                  className={cn(
                    "p-2.5 rounded-md text-xs flex items-start gap-2",
                    h.level === 1 && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                    h.level === 2 && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    h.level === 3 && "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                  )}
                >
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium">Hint {h.level}: </span>
                    {h.hint}
                  </span>
                </div>
              ))}
          </div>
        )}

        {attempt?.feedback && (
          <div
            className={cn(
              "p-3 rounded-lg text-sm",
              attempt.status === "correct"
                ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
            )}
          >
            {attempt.status === "correct" && (
              <CheckCircle2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            )}
            {attempt.feedback}
          </div>
        )}

        {showSolution && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground flex items-center gap-2">
              Expected Solution
              <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                <span className="w-2 h-2 rounded-sm bg-green-500/30 border-l-2 border-green-500" />
                changed
              </span>
            </span>
            <div className="rounded-md border overflow-hidden font-mono text-xs py-2">
              {exercise.expectedSolution.split("\n").map((line, idx) => {
                const lineNum = idx + 1
                const isChanged = changedLines.has(lineNum)
                return (
                  <div
                    key={`solution-line-${lineNum}`}
                    className={cn(
                      "flex px-1 leading-5",
                      isChanged && "bg-green-500/15 border-l-2 border-green-500"
                    )}
                  >
                    <span className="w-8 shrink-0 text-right pr-3 text-muted-foreground/40 select-none">
                      {lineNum}
                    </span>
                    <Highlighter
                      style={codeStyle}
                      language={exercise.language}
                      PreTag="span"
                      customStyle={{
                        margin: 0,
                        padding: 0,
                        background: "transparent",
                        display: "inline",
                      }}
                    >
                      {line || " "}
                    </Highlighter>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            {attempt?.status !== "correct" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReviewLater}
                className="text-muted-foreground"
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                Later
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tieredHints.length > 0 && revealedHintLevel < 3 && attempt?.status !== "correct" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRevealHint}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
              >
                <Lightbulb className="h-3.5 w-3.5 mr-1" />
                Hint {revealedHintLevel + 1}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSolution(!showSolution)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {showSolution ? "Hide" : "Solution"}
            </Button>
            <Button
              size="sm"
              onClick={handleVerify}
              disabled={isEvaluating || attempt?.status === "correct"}
            >
              {isEvaluating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Verify
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChallengeTypeIcon({ type }: { type: ChallengeType }) {
  switch (type) {
    case "fix-bug":
      return <Bug className="h-4 w-4 text-red-500" />
    case "complete-function":
      return <FileCode className="h-4 w-4 text-blue-500" />
    case "refactor":
      return <Wrench className="h-4 w-4 text-amber-500" />
    case "predict-output":
      return <Eye className="h-4 w-4 text-purple-500" />
    default:
      return <Code2 className="h-4 w-4 text-muted-foreground" />
  }
}

function ChallengeTypeLabel({ type }: { type: ChallengeType }) {
  switch (type) {
    case "fix-bug":
      return "Fix the Bug"
    case "complete-function":
      return "Complete Function"
    case "refactor":
      return "Refactor"
    case "predict-output":
      return "Predict Output"
    default:
      return "Fill in the Blank"
  }
}

interface McqCardProps {
  exercise: McqExercise
  attempt?: ExerciseAttempt
}

function McqCard({ exercise, attempt }: McqCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    attempt?.userAnswer as string | null
  )
  const [showExplanation, setShowExplanation] = useState(false)

  const handleSubmit = () => {
    if (selectedOption) {
      learningsActions.submitMcqAnswer(exercise.id, selectedOption)
    }
  }

  const handleReset = () => {
    setSelectedOption(null)
    learningsActions.resetAttempt(exercise.id)
    setShowExplanation(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Multiple Choice</span>
          <DifficultyBadge difficulty={exercise.difficulty} />
        </div>
        {attempt && <StatusBadge status={attempt.status} />}
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {exercise.prompt || "Question"}
          </p>
          {exercise.topics && exercise.topics.length > 0 && (
            <TopicBadges topics={exercise.topics} />
          )}
        </div>

        <div className="space-y-2">
          {exercise.options.map((option) => {
            const isSelected = selectedOption === option.id
            const showResult = attempt?.status !== undefined && attempt.status !== "fresh"
            const isCorrectOption = option.isCorrect
            
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => !showResult && setSelectedOption(option.id)}
                disabled={showResult}
                className={cn(
                  "w-full text-left p-3 rounded-md border text-sm transition-colors",
                  showResult && isCorrectOption
                    ? "border-green-500 bg-green-500/10"
                    : showResult && isSelected && !isCorrectOption
                    ? "border-red-500 bg-red-500/10"
                    : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {(attempt?.status === "correct" || showExplanation) && (
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <span className="font-medium">Explanation: </span>
            {exercise.explanation}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
          <div className="flex items-center gap-2">
            {attempt?.status === "incorrect" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExplanation(!showExplanation)}
              >
                {showExplanation ? "Hide" : "Show"} Explanation
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!selectedOption || attempt?.status === "correct"}
            >
              Check Answer
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TfCardProps {
  exercise: TrueFalseExercise
  attempt?: ExerciseAttempt
}

function TfCard({ exercise, attempt }: TfCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(
    attempt?.userAnswer as boolean | null
  )
  const [showExplanation, setShowExplanation] = useState(false)

  const handleSubmit = (answer: boolean) => {
    setSelectedAnswer(answer)
    learningsActions.submitTfAnswer(exercise.id, answer)
  }

  const handleReset = () => {
    setSelectedAnswer(null)
    learningsActions.resetAttempt(exercise.id)
    setShowExplanation(false)
  }

  const showResult = attempt?.status !== undefined && attempt.status !== "fresh"

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">True or False</span>
          <DifficultyBadge difficulty={exercise.difficulty} />
        </div>
        {attempt && <StatusBadge status={attempt.status} />}
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            {exercise.statement || exercise.prompt || "True/False question"}
          </p>
          {exercise.topics && exercise.topics.length > 0 && (
            <TopicBadges topics={exercise.topics} />
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={selectedAnswer === true ? "default" : "outline"}
            size="sm"
            onClick={() => !showResult && handleSubmit(true)}
            disabled={showResult}
            className={cn(
              "flex-1",
              showResult && exercise.correct === true && "border-green-500 bg-green-500/10 text-green-700",
              showResult && selectedAnswer === true && !exercise.correct && "border-red-500 bg-red-500/10 text-red-700"
            )}
          >
            True
          </Button>
          <Button
            variant={selectedAnswer === false ? "default" : "outline"}
            size="sm"
            onClick={() => !showResult && handleSubmit(false)}
            disabled={showResult}
            className={cn(
              "flex-1",
              showResult && exercise.correct === false && "border-green-500 bg-green-500/10 text-green-700",
              showResult && selectedAnswer === false && exercise.correct && "border-red-500 bg-red-500/10 text-red-700"
            )}
          >
            False
          </Button>
        </div>

        {(attempt?.status === "correct" || showExplanation) && (
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <span className="font-medium">Explanation: </span>
            {exercise.explanation}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
          {attempt?.status === "incorrect" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExplanation(!showExplanation)}
            >
              {showExplanation ? "Hide" : "Show"} Explanation
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function TopicBadges({ topics }: { topics: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {topics.slice(0, 3).map((topic) => (
        <Badge
          key={topic}
          variant="secondary"
          className="text-[10px] px-1.5 py-0 font-normal bg-muted text-muted-foreground"
        >
          {topic}
        </Badge>
      ))}
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: Exercise["difficulty"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0",
        difficulty === "easy" && "text-green-600 border-green-500/50",
        difficulty === "medium" && "text-amber-600 border-amber-500/50",
        difficulty === "hard" && "text-red-600 border-red-500/50"
      )}
    >
      {difficulty}
    </Badge>
  )
}

function StatusBadge({ status }: { status: ExerciseAttempt["status"] }) {
  if (status === "fresh") return null
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] px-1.5 py-0",
        status === "correct" && "text-green-600 border-green-500/50 bg-green-500/10",
        status === "incorrect" && "text-amber-600 border-amber-500/50 bg-amber-500/10",
        status === "attempted" && "text-blue-600 border-blue-500/50 bg-blue-500/10"
      )}
    >
      {status === "correct" ? "Correct" : status === "incorrect" ? "Try Again" : "Attempted"}
    </Badge>
  )
}
