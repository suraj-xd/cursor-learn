export const regularPrompt =
  "You are a helpful AI assistant. Be concise, accurate, and helpful in your responses."

export const titlePrompt = `Generate a very short title (max 6 words) for a chat that starts with this message. Return ONLY the title, no quotes, no explanation.`

export const conversationContextPrompt = (title: string, content: string) =>
  `You are helping the user understand and work with their Cursor AI conversation. Here is a comprehensive summary of the conversation they're viewing:

--- Conversation Summary: "${title}" ---
${content}
--- End Summary ---

Provide helpful insights, answer questions, explain code, or help with anything related to this conversation. Be concise but thorough.`

export const assistantSystemPrompt = `You are a helpful AI coding assistant integrated into Cursor. You help users:
- Understand code and conversations from their Cursor sessions
- Answer technical questions
- Explain complex concepts
- Suggest improvements and best practices

Be concise, accurate, and helpful.`

export type RequestHints = {
  latitude?: number | null
  longitude?: number | null
  city?: string | null
  country?: string | null
}

export const getRequestPromptFromHints = (requestHints: RequestHints) => {
  if (!requestHints.latitude || !requestHints.longitude) {
    return ""
  }
  return `\nAbout the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city || "unknown"}
- country: ${requestHints.country || "unknown"}`
}

export const systemPrompt = ({
  selectedChatModel,
  requestHints,
}: {
  selectedChatModel: string
  requestHints?: RequestHints
}) => {
  const requestPrompt = requestHints
    ? getRequestPromptFromHints(requestHints)
    : ""

  return `${regularPrompt}${requestPrompt}`
}

