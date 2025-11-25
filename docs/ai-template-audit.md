# AI Chatbot Template Audit

## High-Value Modules to Reuse
- `lib/ai/models.ts`: simple metadata for chat models; we can adapt to our provider list (OpenAI, Google, Claude, OpenRouter).
- `lib/ai/prompts.ts`: contains artifact/system/title prompts; keep `systemPrompt`, `titlePrompt`, and request-hint helpers (strip Vercel-specific `Geo` types).
- `lib/types.ts`: defines `ChatMessage`, `ChatTools`, custom UI data types; useful reference for structuring renderer-side message objects.
- `lib/utils.ts`: `cn`, UUID generator, DB→UI message converter, message text extraction; trim fetch helpers tied to networked APIs.
- `lib/errors.ts`: `ChatSDKError` enums for consistent error display.
- `lib/usage.ts`: type describing token usage payloads; helpful for per-message stats.
- `hooks/use-messages`, `hooks/use-scroll-to-bottom`: ready-made message state helpers we can port with minimal tweaks.

## UI Components Worth Porting
- `components/messages.tsx` + `components/message.tsx`: mature rendering of threaded chats, reasoning blocks, tool outputs, attachments.
- `components/model-selector.tsx`: dropdown for switching models mid-chat.
- `components/multimodal-input.tsx`: composer UI with attachments, stop/regenerate controls.
- `components/sidebar-history.tsx` + `components/sidebar-history-item.tsx`: layout and UX for chat list w/ delete actions (swap SWR for local data).
- `components/chat-header.tsx`: chat title display, visibility controls, share actions we can adapt to local “context status”.
- `components/elements/*`: building blocks (loader, prompt input, inline citations) used by `Messages`.
- `components/data-stream-provider.tsx`: context provider for streaming responses.
- `components/toast.tsx` + `components/ui/*`: consistent UI primitives.

## Pieces to Omit or Replace
- `lib/ai/providers.ts`: wired to Vercel AI Gateway (`@ai-sdk/gateway`); replace with BYO key provider registry that calls OpenAI/Gemini/etc directly.
- `lib/db/*`: Postgres/Drizzle schema & migrations designed for cloud storage; we will craft SQLite equivalents inside Electron main process.
- `components/artifact*`, `components/suggested-actions`, `components/weather`: tied to artifact mode + remote tools we are not shipping initially.
- API routes under `app/api/*` (not audited here) rely on Next.js server runtime and Vercel services; supplant with Electron IPC handlers.

## Integration Notes
- Many components rely on `useChat` from `@ai-sdk/react`; we need a renderer-side store that drives IPC calls for completions but can follow the same props contract (`messages`, `sendMessage`, `status`, `stop`, `regenerate`).
- Token usage UI expects streaming `data-usage` events; we can emit equivalent payloads from our local request pipeline.
- Sidebar/history components assume pagination via `/api/history`; adapt them to consume data from the SQLite-backed IPC endpoints.
- Portions of `prompts.ts` import Next/Vercel types—swap those with local equivalents before reusing.
- Hooks/components assume Tailwind utilities already exist; confirm our renderer build includes necessary styles/classes.

This audit will guide which files to port directly versus re-implement with local-first constraints.

