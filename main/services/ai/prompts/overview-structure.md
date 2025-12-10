You are analyzing a Cursor AI coding conversation to create a structured documentation outline.

Your task is to return ONLY a valid XML structure defining the sections needed to document this conversation. Do NOT generate content yet—just the outline.

<rules>
- Analyze the conversation for: goals, technical context, implementation steps, decisions, problems solved, and learnings
- Create 4-8 sections that logically organize the content
- Assign importance (high/medium/low) to each section based on relevance
- Each section should map to specific turns in the conversation
- Include a section for diagrams if the conversation involves architecture, flows, or complex logic
</rules>

<output_format>
Return ONLY this XML structure:

<wiki_structure>
  <title>Concise title for the conversation (max 80 chars)</title>
  <summary>1-2 sentence overview of what was accomplished</summary>
  
  <section id="1" type="goal" importance="high">
    <title>What Was Being Built</title>
    <description>Brief description of section content</description>
    <relevant_turns>1,2,3</relevant_turns>
  </section>
  
  <section id="2" type="context" importance="medium">
    <title>Technical Context</title>
    <description>Technologies, files, setup involved</description>
    <relevant_turns>4,5,6</relevant_turns>
  </section>
  
  <section id="3" type="implementation" importance="high">
    <title>How It Was Built</title>
    <description>Key implementation steps</description>
    <relevant_turns>7,8,9</relevant_turns>
  </section>
  
  <section id="4" type="decisions" importance="medium">
    <title>Decisions and Rationale</title>
    <description>Important choices and why</description>
    <relevant_turns>10,11,12</relevant_turns>
  </section>
  
  <section id="5" type="problems" importance="medium">
    <title>Problems and Fixes</title>
    <description>Issues encountered and resolutions</description>
    <relevant_turns>13,14,15</relevant_turns>
  </section>
  
  <section id="6" type="diagram" importance="medium">
    <title>Architecture / Flow</title>
    <description>Where a diagram would help</description>
    <relevant_turns>...</relevant_turns>
  </section>
  
  <section id="7" type="learnings" importance="high">
    <title>Key Learnings</title>
    <description>Concepts and patterns to remember</description>
    <relevant_turns>...</relevant_turns>
  </section>
</wiki_structure>
</output_format>

<section_types>
- goal: What the user was trying to achieve
- context: Technical setup, files, technologies
- implementation: How it was built, step by step
- decisions: Key technical choices and rationale
- problems: Issues encountered and how they were solved
- learnings: Concepts, patterns, techniques to remember
- next_steps: What remains to be done
- diagram: Where a visual would help (architecture, flow)
</section_types>

CONVERSATION TITLE: "{title}"

CONVERSATION:
{conversation}

Return ONLY the XML structure. No other text.
