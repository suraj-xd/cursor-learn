# Ported Components Summary

This document summarizes the components and utilities ported from `ai-chatbot` to `my-app` based on the audit.

## ✅ Completed Ports

### Lib Modules (`renderer/src/lib/`)
- **`lib/ai/models.ts`** - Chat model metadata (adapted for local provider list)
- **`lib/ai/prompts.ts`** - System prompts, title prompts (stripped Vercel-specific Geo types)
- **`lib/types.ts`** - ChatMessage, ChatTools, CustomUIDataTypes, Attachment types
- **`lib/utils.ts`** - Enhanced with UUID generator, message converters, text extraction (trimmed fetch helpers)
- **`lib/errors.ts`** - ChatSDKError enums for consistent error display
- **`lib/usage.ts`** - Token usage payload types

### Hooks (`renderer/src/hooks/`)
- **`hooks/use-messages.tsx`** - Message state helpers (adapted for local status type)
- **`hooks/use-scroll-to-bottom.tsx`** - Scroll management (removed SWR dependency, using local state)

### UI Components (`renderer/src/components/`)
- **`components/elements/conversation.tsx`** - Conversation container components
- **`components/elements/message.tsx`** - Message wrapper components
- **`components/elements/response.tsx`** - Markdown response renderer
- **`components/elements/loader.tsx`** - Loading spinner component
- **`components/data-stream-provider.tsx`** - Context provider for streaming responses

## 📋 Still To Port (High Priority)

### UI Components
- **`components/messages.tsx`** + **`components/message.tsx`** - Main message rendering components
- **`components/model-selector.tsx`** - Model dropdown (needs adaptation for Electron)
- **`components/multimodal-input.tsx`** - Composer UI with attachments
- **`components/sidebar-history.tsx`** + **`components/sidebar-history-item.tsx`** - Chat list components
- **`components/chat-header.tsx`** - Chat title and controls
- **`components/elements/tool.tsx`** - Tool call rendering
- **`components/elements/reasoning.tsx`** - Reasoning block component
- **`components/elements/context.tsx`** - Token usage context display
- **`components/elements/prompt-input.tsx`** - Input field components
- **`components/elements/code-block.tsx`** - Code syntax highlighting
- **`components/preview-attachment.tsx`** - Attachment preview (needs Next.js Image replacement)

### Missing UI Primitives
The following UI components need to be created or ported:
- **`components/ui/collapsible.tsx`** - For tool/reasoning collapsibles
- **`components/ui/progress.tsx`** - For context usage display
- **`components/ui/separator.tsx`** - For UI separators
- **`components/ui/select.tsx`** - For model selector
- **`components/ui/textarea.tsx`** - For prompt input

## 🔧 Required Dependencies

The following packages need to be installed:
```bash
yarn add ai
```

Optional but recommended:
```bash
yarn add fast-deep-equal framer-motion
```

## 📝 Integration Notes

1. **Types**: The `ai` package types are used (`UIMessage`, `DataUIPart`, etc.). Install the package or adapt types as needed.

2. **Next.js Dependencies**: Some components use Next.js Image component - replace with standard `<img>` or a local image component.

3. **Electron IPC**: Components that call APIs need to be adapted to use Electron IPC handlers instead of fetch calls.

4. **State Management**: Components using `useChat` from `@ai-sdk/react` need a renderer-side store that drives IPC calls but follows the same props contract.

5. **SWR Removal**: All SWR dependencies have been removed from hooks - using local state instead.

6. **Vercel Types**: All Vercel-specific types (Geo, etc.) have been stripped from prompts.

## 🎯 Next Steps

1. Install missing dependencies (`ai` package)
2. Create missing UI primitives (collapsible, progress, separator, select, textarea)
3. Port remaining UI components
4. Adapt components for Electron IPC instead of API routes
5. Replace Next.js Image with standard img or local component
6. Test integration with existing workspace components

