---
description: Commit message structure and completion criteria for repository changes
---

# Commit template

Use this guide before creating a commit in this repository.

## Subject

Write one concise Conventional Commit subject:

```text
<type>(<scope>): <imperative summary>
```

Use `<type>: <imperative summary>` when a scope does not add useful context. Keep the subject
specific and under roughly 72 characters. Use the smallest accurate type:

- `feat` for a user-visible capability
- `fix` for a defect correction
- `refactor` for an internal change without behavior change
- `test` for test-only changes
- `docs` for documentation-only changes
- `build` for dependency or build-system changes
- `perf` for performance improvements
- `ci` for CI/CD workflow and pipeline changes
- `chore` for maintenance that does not fit the other types

Use a concise scope (e.g., component, module, or package name) when it makes the change
immediately clearer. Use an imperative summary that describes the resulting change.

## Body

Add a body when the subject does not explain the reason, important behavior, compatibility impact,
or operational consequence. Keep it to 2–5 concise bullets. Explain meaningful changes and purpose;
do not produce a file-by-file inventory.

```text
<type>(<scope>): <imperative summary>

- Explain the meaningful change and why it is needed.
- Mention important compatibility, security, data, or rollout impact.
- Reference work item or issue: Closes #123 (GitHub) or Fixes AB#12345 (Azure DevOps).
```

### Windows PowerShell commit syntax

When creating a commit from PowerShell, do not write `\n` inside a quoted argument. PowerShell
does not interpret `\n` as a newline, so Git would store it literally. Use a PowerShell
here-string and pass the message through standard input instead:

```powershell
$commitMessage = @'
chore(scope): summarize the change

- Explain the meaningful change and why it is needed.
- Mention important compatibility, security, data, or rollout impact.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
'@

$commitMessage | git commit --file -
```

### Work item and issue linking

Link the commit to the backing tracker when applicable:

- **GitHub**: use `#<number>` or `Closes #<number>` / `Fixes #<number>`.
- **Azure DevOps**: use `AB#<id>` or `Fixes AB#<id>` to link directly to Azure Boards work items.

Keep unrelated changes in separate commits when practical. Preserve required trailers, including
the configured Copilot co-author trailer when the commit is created by an agent workflow.

## Completion criteria

Before committing, confirm the staged snapshot has:

- one accurate Conventional Commit subject;
- a body when context beyond the subject is important;
- no unrelated changes in the commit; and
- any required trailers preserved.
