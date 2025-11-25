export const regularPrompt =
  "You are a friendly assistant! Keep your responses concise and helpful.";

export type RequestHints = {
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  country?: string | null;
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => {
  if (!requestHints.latitude || !requestHints.longitude) {
    return "";
  }
  return `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city || "unknown"}
- country: ${requestHints.country || "unknown"}
`;
};

export const systemPrompt = ({
  selectedChatModel,
  requestHints,
}: {
  selectedChatModel: string;
  requestHints?: RequestHints;
}) => {
  const requestPrompt = requestHints
    ? getRequestPromptFromHints(requestHints)
    : "";

  if (selectedChatModel === "chat-model-reasoning") {
    return `${regularPrompt}${requestPrompt ? `\n\n${requestPrompt}` : ""}`;
  }

  return `${regularPrompt}${requestPrompt ? `\n\n${requestPrompt}` : ""}`;
};

export const titlePrompt = `
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`;

