---
description: Guidance for selecting and completing issue and work item templates
---

# Issue template guidance

Use this guide before creating an issue or work item.

## Template locations

Executable templates live in platform-standard directories; do not move or duplicate them elsewhere:
- **GitHub**: `.github/ISSUE_TEMPLATE/` (`bug_report.md`, `feature.md`, `task.md`)
- **Azure DevOps**: `.azuredevops/work-item-templates/` or Azure Boards work item types (`Bug`, `Feature` / `User Story`, `Task`)

## Choose the template

- **Bug**: for a reproducible defect in existing behavior.
- **Feature / User Story**: for a proposed capability or user-facing outcome.
- **Task**: for engineering or implementation work with concrete acceptance criteria.

Read the selected template before creating the issue and preserve its headings.

## Populate the issue or work item

- Describe the problem or goal in concrete terms.
- State the expected outcome and observable acceptance criteria.
- Include reproduction steps, environment, and expected behavior for bugs.
- Include the user, capability, and benefit for features (`As a [user], I want [capability] so that [benefit]`).
- Include likely implementation areas, dependencies, and focused testing for tasks.
- Link related issues, work items, designs, documentation, or screenshots when they provide useful context.
- Remove placeholder text and leave no unchecked requirement that is not intentional.

Keep the scope small enough to implement and review. Do not invent technical details when the
repository or ticket context does not establish them; mark the uncertainty for refinement instead.

## Completion criteria

An issue or work item is ready when it:

- uses the appropriate template or work item type;
- explains the problem or outcome clearly;
- has concrete acceptance criteria;
- contains enough context for refinement without a file-by-file implementation plan; and
- is created through the repository's configured issue tracking workflow (`gh` CLI or `az boards` CLI).
