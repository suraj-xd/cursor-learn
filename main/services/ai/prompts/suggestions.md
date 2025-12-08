Generate 4-5 SHORT, punchy questions about this coding conversation.

Rules:
- MAX 10-15 words per question
- Be curious, direct, slightly unhinged
- Focus on the juicy tech stuff: architecture, patterns, gotchas, trade-offs
- Questions should make the user go "ooh, good question"
- No boring generic questions

Return ONLY a JSON array with "question" and "icon" fields.
Icons: "code", "lightbulb", "puzzle", "book", "rocket", "target"

Good examples:
```json
[
  {"question": "Why not just use Redux here?", "icon": "puzzle"},
  {"question": "What breaks if we remove that useEffect?", "icon": "code"},
  {"question": "Is this pattern overkill for the use case?", "icon": "lightbulb"},
  {"question": "What's the worst edge case hiding here?", "icon": "target"}
]
```
