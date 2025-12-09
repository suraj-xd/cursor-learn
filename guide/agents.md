# AI Agents Guide

This guide documents the AI SDK integration, agent architecture, and best practices for working with AI features in the app.

## Overview

The app uses the [Vercel AI SDK](https://ai-sdk.dev) (`ai` package) as the unified interface for all AI operations. The SDK provides:

- Unified API across providers (Google, OpenAI, Anthropic, OpenRouter)
- Streaming support
- Structured output with schema validation
- Automatic retries and fallbacks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ agents-workspace│  │  overview-view  │  │ resources-   │ │
│  │     (Chat UI)   │  │   (Overview)    │  │   view       │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                    │                   │         │
│  ┌────────┴────────────────────┴───────────────────┴───────┐ │
│  │                   IPC Bridges                            │ │
│  │  agentsIpc | overviewIpc | compactIpc | resourcesIpc    │ │
│  └────────────────────────────┬────────────────────────────┘ │
└───────────────────────────────┼──────────────────────────────┘
                                │ IPC (Electron)
┌───────────────────────────────┼──────────────────────────────┐
│                      MAIN PROCESS                            │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │                    preload.ts                            │ │
│  │            (Exposes IPC handlers to renderer)            │ │
│  └────────────────────────────┬────────────────────────────┘ │
│                               │                               │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │                   Agent Services                         │ │
│  │  agent-runtime | overview-agent | compact-agent | etc.  │ │
│  └────────────────────────────┬────────────────────────────┘ │
│                               │                               │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │              main/services/ai/helpers.ts                 │ │
│  │   generate() | generateStream() | generateWithSchema()  │ │
│  └────────────────────────────┬────────────────────────────┘ │
│                               │                               │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │              main/services/ai/providers.ts               │ │
│  │         Provider instances (Google, OpenAI, etc.)        │ │
│  └────────────────────────────┬────────────────────────────┘ │
│                               │                               │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │                   AI SDK (@ai-sdk/*)                     │ │
│  │    @ai-sdk/google | @ai-sdk/openai | @ai-sdk/anthropic  │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
main/
└── services/
    └── ai/
        ├── helpers.ts      # Core generation functions
        ├── providers.ts    # Provider factory and management
        ├── models.ts       # Model configs, pricing, defaults
        └── prompts/        # Prompt templates (.md files)
            ├── chat-system.md
            ├── overview.md
            ├── compact-*.md
            └── ...

renderer/
└── src/
    └── lib/
        ├── ai/
        │   └── config.ts   # Frontend model/provider configs
        └── agents/
            ├── ipc.ts          # Agent chat IPC
            ├── overview-ipc.ts # Overview generation IPC
            ├── compact-ipc.ts  # Context compaction IPC
            └── resources-ipc.ts # Resource generation IPC
```

## Provider Setup

### Supported Providers

| Provider | Package | Models |
|----------|---------|--------|
| Google | `@ai-sdk/google` | Gemini 2.5 Pro/Flash, Gemini 2.0 |
| OpenAI | `@ai-sdk/openai` | GPT-4o, GPT-4.1, o3/o4-mini |
| Anthropic | `@ai-sdk/anthropic` | Claude Sonnet 4, Claude 3.5/3.7 |
| OpenRouter | `@ai-sdk/openai` (custom base) | Multi-provider access |

### Provider Priority

The app uses a priority order when selecting providers:

```typescript
const PROVIDER_PRIORITY = ['google', 'anthropic', 'openai', 'openrouter']
```

If the requested provider is unavailable, fallback occurs in this order.

### API Key Storage

API keys are stored securely via `agent-storage.ts`:

```typescript
// Save a key
await agentsIpc.apiKeys.save({ 
  provider: 'google', 
  secret: 'AIz...', 
  label: 'Personal' 
})

// List keys (secrets are masked)
const keys = await agentsIpc.apiKeys.list()
```

## Core Functions

### `generate(options)`

Text generation without schema:

```typescript
import { generate } from './ai/helpers'

const result = await generate({
  prompt: 'Explain React hooks',
  temperature: 0.4,
  maxTokens: 2000,
  role: 'chat',        // Uses role-based model selection
  maxRetries: 3,
})

console.log(result.content)    // string
console.log(result.provider)   // 'google'
console.log(result.model)      // 'gemini-2.5-flash'
console.log(result.usage)      // { promptTokens, completionTokens }
```

### `generateStream(options, onChunk)`

Streaming text generation:

```typescript
import { generateStream } from './ai/helpers'

const result = await generateStream(
  {
    messages: coreMessages,
    temperature: 0.4,
    role: 'chat',
  },
  (chunk, done) => {
    if (!done) {
      process.stdout.write(chunk)
    }
  }
)
```

### `generateWithSchema(options)`

Structured output with Zod schema validation:

```typescript
import { generateWithSchema } from './ai/helpers'
import { z } from 'zod'

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  topics: z.array(z.string()),
})

const result = await generateWithSchema({
  prompt: 'Analyze this conversation...',
  schema,
  schemaName: 'ConversationAnalysis',
  temperature: 0.3,
  role: 'overview',
  fallbackToText: true,  // Falls back to text + parsing if structured fails
})

console.log(result.content.title)  // Typed!
```

## Model Roles

Different operations use different model configurations:

| Role | Purpose | Default (Google) |
|------|---------|------------------|
| `chat` | Interactive chat | gemini-2.5-flash |
| `title` | Title generation | gemini-2.0-flash-lite |
| `compact` | Context compaction | gemini-2.0-flash |
| `summarization` | Chat summarization | gemini-2.5-flash |
| `overview` | Overview generation | gemini-2.0-flash |
| `resources` | Resource discovery | gemini-2.0-flash |

## Agent Features

### Agent Chat

The agent chat (`agents-workspace.tsx`) provides:

- Multi-turn conversations with context
- Model switching mid-conversation
- Context mentions (@-mentions other conversations)
- Streaming responses
- Suggested follow-up questions
- Token usage tracking

### Overview Generation

Generates structured overviews of conversations:

```typescript
// Renderer side
const result = await overviewIpc.start({
  workspaceId: '...',
  conversationId: '...',
  title: 'Building a REST API',
  bubbles: [{ type: 'user', text: '...' }, ...],
})

// Result
result.overview.title     // "Building REST API with Express"
result.overview.summary   // "Implemented CRUD endpoints..."
result.overview.topics    // ["Express.js", "REST Design", ...]
result.overview.content   // Rich markdown with diagrams
```

### Context Compaction

Compresses long conversations for context efficiency:

```typescript
const result = await compactIpc.start({
  workspaceId: '...',
  conversationId: '...',
  title: '...',
  bubbles: [...],
})

// Compression strategies:
// - full_context: < 100k tokens, single pass
// - chunked_parallel: 100k-500k tokens, map-reduce
// - hierarchical: > 500k tokens, multi-level
```

### Resource Generation

Discovers learning resources based on conversation:

```typescript
const result = await resourcesIpc.generate({
  workspaceId: '...',
  conversationId: '...',
  title: '...',
  bubbles: [...],
  preferredProvider: 'auto',  // auto | perplexity | tavily | google | ...
})

// Returns categorized resources
result.resources  // [{ type, category, title, url, ... }]
result.topics     // Extracted topics
result.analysis   // Conversation analysis
```

## Error Handling

### Automatic Fallbacks

The system handles errors gracefully:

1. **Retry with same provider**: Up to 3 retries with exponential backoff
2. **Provider fallback**: If primary fails, try other configured providers
3. **Text fallback**: For structured output, fall back to text generation + parsing

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No API key configured" | Missing key for provider | Add key in Settings → API Keys |
| "AI_NoObjectGeneratedError" | Model didn't return valid schema | Automatic text fallback handles this |
| Rate limit errors | Too many requests | Automatic retry with backoff |

## Best Practices

### 1. Use Role-Based Model Selection

Instead of hardcoding models:

```typescript
// ❌ Bad
generate({ provider: 'google', model: 'gemini-2.5-flash', ... })

// ✅ Good
generate({ role: 'chat', ... })  // System picks best available
```

### 2. Always Handle Streaming for Long Operations

```typescript
// For chat completions
const result = await generateStream(options, (chunk, done) => {
  emit('stream-chunk', { chatId, chunk, done })
})
```

### 3. Use Schemas for Structured Data

```typescript
// ✅ Validates output structure
const result = await generateWithSchema({
  schema: myZodSchema,
  fallbackToText: true,  // Safety net
  ...
})
```

### 4. Track Usage

All generation functions support usage tracking:

```typescript
generate({
  ...,
  feature: 'chat',  // 'chat' | 'title' | 'compact' | 'summarization'
  chatId: '...',    // For attribution
})
```

## Adding New AI Features

1. **Define the schema** (if structured output needed)
2. **Create prompt template** in `main/services/ai/prompts/`
3. **Add generation logic** in a new agent service
4. **Expose via IPC** in `preload.ts`
5. **Create IPC wrapper** in `renderer/src/lib/agents/`
6. **Build UI component** using the IPC wrapper

## Troubleshooting

### Overview Generation Fails

1. Check API key is valid
2. Try a different provider (model picker)
3. Check conversation has enough content
4. Look at main process logs for detailed error

### Streaming Stops Midway

1. Check network connectivity
2. Verify token limits aren't exceeded
3. Try regenerating (automatic retry should help)

### Model Not Available

1. Ensure API key is for correct provider
2. Check if model is still supported (models get deprecated)
3. Try switching to a different model

## Migration Notes

The app previously used direct API calls. Now all AI operations go through:

- `main/services/ai/helpers.ts` - Single entry point
- `main/services/ai/providers.ts` - Provider management

Key changes:
- All providers use AI SDK's unified interface
- Automatic fallback across providers
- Centralized retry logic
- Usage tracking built-in

## References

- [Vercel AI SDK Docs](https://ai-sdk.dev)
- [Zod Schema Validation](https://zod.dev)
- Provider SDKs:
  - [@ai-sdk/google](https://www.npmjs.com/package/@ai-sdk/google)
  - [@ai-sdk/openai](https://www.npmjs.com/package/@ai-sdk/openai)
  - [@ai-sdk/anthropic](https://www.npmjs.com/package/@ai-sdk/anthropic)
