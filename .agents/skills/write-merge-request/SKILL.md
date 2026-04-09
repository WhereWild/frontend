---
name: write-merge-request
description: Create a complete GitLab merge request title and description using the repository templates in `.gitlab`. Use this skill when requested.
---

## Template source rules

1. Check for templates in:
    - `.gitlab/merge_request_templates/`
2. If multiple templates exist, choose:
    - The one explicitly requested by the user, or
    - the most appropriate template, or
    - Ask the user which template to use.
3. Do not invent sections that conflict with the selected template.

## Workflow

1. Read template
    - Load the selected template file exactly.
2. Collect change context
    - #code-review staged/unstaged diff and recent commits.
    - Extract: problem, approach, risk, migrations, user impact.
3. Fill template sections
    - Keep content specific and evidence-based.
    - Use concise bullets.
    - If a section is not applicable, write `N/A` (unless template says otherwise).
5. Final output
    - Proposed MR title
    - Completed MR description (template-populated markdown) in a markdown code block using three backticks
    - Optional commit message suggestions (if user asks)

## Writing standards

- Be factual and implementation-focused.
- Include breaking changes, migrations, and rollout notes when relevant.
- Keep tone professional and concise, avoid using bold text or emojis.
- Use four spaces for indentation.

## Example title patterns

- `Add species heatmap loading placeholder`
- `Fix search: prevent duplicate taxonId entries in results`
- `Split environment chart logic from view`