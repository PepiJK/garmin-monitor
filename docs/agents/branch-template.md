---
description: Branch naming rules for issue-backed and repository maintenance work
---

# Branch naming template

Use this guide before creating a branch for issue-backed or maintenance work.

## Issue-backed branches

Use the following format:

```text
<issue-type>/<issue-or-work-item-id>-<short-kebab-case-title>
```

Apply these rules:

- Use the lowercase issue or work item type:
  - `feature` for new user-facing capabilities or enhancements
  - `task` for engineering work, refactoring, or maintenance with concrete criteria
  - `bug` (or `fix`) for reproducible defects
- Use the actual issue number (GitHub `#123`) or work item ID (Azure DevOps `AB#12345` / `12345`).
- Keep the title short, specific, and kebab-cased.
- Do not invent an issue number or work item ID when none exists.

Examples:

```text
# GitHub issue-backed branches
feature/128-add-user-authentication
bug/125-fix-null-reference-on-login
task/57-create-search-api-endpoint

# Azure DevOps work item-backed branches
feature/141602-manual-entries
bug/142301-fix-session-timeout
task/142305-database-index-optimization
```

## Non-issue branches

Use a descriptive branch name without an invented issue number only for work that is genuinely not
issue-backed, such as repository maintenance or urgent operational fixes. Prefer a clear category
and short kebab-case title:

```text
chore/update-dependencies
chore/update-agent-guidance
hotfix/production-configuration
```

## Completion criteria

A branch name is ready when it:

- identifies the issue or work item when one exists;
- uses the actual issue number or work item ID;
- follows the required lowercase/kebab-case format; and
- is short and scannable in Git CLI, GitHub, and Azure DevOps tooling.
