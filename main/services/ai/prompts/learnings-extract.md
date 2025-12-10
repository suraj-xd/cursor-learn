You are extracting programming concepts and learnings from a Cursor AI coding conversation.

<task>
Identify distinct programming concepts, patterns, techniques, or skills demonstrated or discussed in this conversation. These are things the user could learn from or reference later.
</task>

<rules>
- Extract 3-8 distinct concepts (quality over quantity)
- Each concept should be specific and actionable, not generic
- Include the exact code example that demonstrates the concept
- Rate difficulty based on the complexity of the concept, not the conversation
- Link to the specific turn(s) where the concept appears
- Focus on: patterns, techniques, debugging approaches, architectural decisions, library usage
</rules>

<output_format>
Return ONLY valid JSON:

{
  "concepts": [
    {
      "name": "Debouncing User Input",
      "category": "pattern",
      "description": "Delay processing of rapid user input to avoid unnecessary API calls or re-renders",
      "difficulty": "intermediate",
      "tags": ["performance", "react", "hooks"],
      "example": {
        "code": "const debouncedSearch = useMemo(() => debounce((query) => { ... }, 300), [])",
        "language": "typescript",
        "explanation": "Uses useMemo to maintain stable debounce reference across renders"
      },
      "relatedTurns": [12, 13, 14]
    }
  ]
}
</output_format>

<categories>
- pattern: Reusable design patterns (debouncing, memoization, pub-sub)
- technique: Specific coding techniques (error boundaries, optimistic updates)
- architecture: System design decisions (component structure, state management)
- debugging: How to diagnose and fix issues
- tool: Library or tool usage (React Query, Zustand, Prisma)
- concept: Theoretical understanding (closures, event loop, SSR)
</categories>

CONVERSATION:
{conversation}

Extract the learning concepts now. Return ONLY the JSON.
