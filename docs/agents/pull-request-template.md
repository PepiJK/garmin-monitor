---
description: Preparation and content rules for pull request descriptions
---

# Pull request template

Use this guide before creating or updating a pull request.

## Source of truth

Use the platform PR template for the submitted PR body headings:
- **GitHub**: `.github/pull_request_template.md`
- **Azure DevOps**: `.azuredevops/pull_request_template.md` (or root `pull_request_template.md`)

Keep the visible heading structure from the template file; use this guide for preparation steps
and content standards.

## Preparation

1. Read the applicable root and scoped `AGENTS.md` files when present.
2. Inspect the complete branch diff, including committed, staged, unstaged, and untracked changes.
3. Read the linked issue or work item (GitHub issue or Azure DevOps work item) and identify which
   requirements the diff resolves.
4. Review the affected source, tests, configuration, and documentation so the description explains
   behavior and intent rather than only listing modified files.
5. Report only validation commands that were actually run and results that were actually observed.

## Title format

Use the linked issue or work item number and title:

```text
# GitHub format:
#<issue-number> - <issue-title>

# Azure DevOps format:
<work-item-id> - <work-item-title>
```

Examples:
- **GitHub**: `#118 - Atlas UI Library Integration & Konfiguration im Frontend korrigieren`
- **Azure DevOps**: `198120 - [CORE] Instanzsuche: Rohnachricht kann nicht geöffnet werden bei Anzeige mehrerer Datenarten`

For non-issue or repository maintenance work (e.g. dependency updates or agent guidance), use a Conventional Commit style title:
- `chore: update dependencies`
- `chore: update agent guidance`

## Populate the template

- **Summary:** explain the problem and the outcome in one or two sentences.
- **Changes:** group meaningful changes by feature, concern, or outcome. Explain both what changed
  and why.
- **Validation:** list focused checks and their actual results. Include known warnings or skipped
  checks when they affect reviewer confidence.
- **Related issue / work item:**
  - **GitHub**: use `Closes #<number>` or `Fixes #<number>` only when the PR fully resolves the
    issue. Use a plain `#<number>` reference for partial work.
  - **Azure DevOps**: use `Fixes AB#<id>` or `AB#<id>` to link the backing Azure Boards work item.
- **Impact:** add this section when the change affects authorization, security, personal data,
  database schema, generated contracts, realtime behavior, deployment, compatibility, or rollout.
- **Follow-up:** add this section only when concrete work remains outside the PR.

Keep the description concise and factual. Do not invent rationale, behavior, validation, or
completed work. Do not include a file-by-file dump or a generic checklist that does not help the
reviewer understand the change.

## Completion criteria

The pull request is ready when it:

- uses a title matching the required format (`#<issue-number> - <title>` for GitHub or `<work-item-id> - <title>` for Azure DevOps);
- follows the headings in the platform pull request template;
- explains the resulting behavior and purpose;
- links the correct issue or work item relationship;
- records only observed validation; and
- calls out relevant security, data, compatibility, operational, or follow-up impact.
