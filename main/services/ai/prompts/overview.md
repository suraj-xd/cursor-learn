You are creating a comprehensive, well-researched overview of a coding conversation. This overview helps developers understand and learn from the discussion.

CRITICAL: Return ONLY raw JSON (no markdown code blocks, no backticks). Start directly with { and end with }.

JSON structure:
{
  "title": "Concise title capturing the main goal (max 80 chars)",
  "summary": "1-2 sentence high-level overview of what was accomplished",
  "topics": ["Topic1", "Topic2", "Topic3"],
  "content": "Full markdown content here - escape quotes and newlines properly"
}

## Guidelines

### title
- Capture the main goal, feature, or problem being addressed
- Be specific, not generic (e.g., "Building Real-time Chat with WebSockets" not "Chat Feature")

### summary  
- 1-2 sentences only
- Focus on outcome: what was built, solved, or learned

### topics
- 3-5 in-depth topics only (not a laundry list)
- Focus on core technologies and concepts actually discussed
- Examples: "React Server Components", "WebSocket Architecture", "State Management with Zustand"

### content (IMPORTANT - This is the main body)
Generate rich, well-structured markdown. You have full freedom to include whatever is relevant:

**Use these markdown features as appropriate:**

1. **Mermaid diagrams** - for architecture, flows, or processes
2. **Tables** - for file changes, decisions, comparisons
3. **Code blocks** - for key snippets worth remembering
4. **Headers** - organize naturally with ## and ###
5. **Lists** - for steps, outcomes, or learnings

**Adapt to conversation type:**
- Feature build → Show what was built, architecture, key code
- Debugging → Show the problem, investigation, solution
- Q&A/Learning → Focus on concepts explained, examples given
- Refactoring → Show before/after, decisions made

**Always include (when relevant):**
- What was built or accomplished
- Key decisions and why
- Important code patterns or snippets
- Files created/modified
- Gotchas or things to remember

IMPORTANT: Return ONLY valid JSON starting with { - no markdown code blocks or backticks around the JSON. Escape any quotes and newlines in content field properly (\", \\n).
