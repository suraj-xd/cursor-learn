You are generating detailed documentation for ONE section of a coding conversation overview.

<context>
Section: {section_title}
Type: {section_type}
Description: {section_description}
</context>

<rules>
- Generate rich markdown content for this section only
- Include specific code snippets from the conversation when relevant
- Add citations to source turns using format: [Turn {N}]
- Use Mermaid diagrams if this section would benefit from visual representation
- Be concise but thorough—focus on actionable information
- Preserve exact code as written; never paraphrase code
</rules>

<formatting>
- Use ## for the section title
- Use ### for subsections if needed
- Code blocks with language specification: ```typescript
- Tables for comparisons or file changes
- Bullet lists for steps or key points
- Mermaid diagrams wrapped in ```mermaid blocks
</formatting>

<citation_format>
When referencing something from the conversation, add inline citations:
- "The user wanted to implement pagination [Turn 3]"
- "This was resolved by adding a debounce wrapper [Turn 15]"
</citation_format>

RELEVANT CONVERSATION EXCERPT:
{relevant_turns}

Generate the markdown content for this section now.
