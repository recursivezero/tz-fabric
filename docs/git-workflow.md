# Git Workflow

## Branch Creation

### Step 1: Create an Issue

Create a GitHub issue describing the work.

### Step 2: Wait for Issue ID Assignment

An automated workflow will assign an issue identifier.

Example:

```text
RZA-260001
```

Wait for the identifier before creating a branch.

### Step 3: Create a Branch

Valid examples:

```text
feature/RZA-260001
feature/RZA-260002

bugfix/RZA-260003
bugfix/RZA-260004
```

Rules:

- Use only `feature/` or `bugfix/`
- Use the generated issue ID exactly as assigned
- Do not add descriptions, names, dates, or suffixes

Invalid examples:

```text
feature/login-screen
feature/RZA-260001-login
feature/john-RZA-260001
bugfix/RZA-260001-test
```

---

## Back Merge

Regularly merge the latest `develop` branch into your working branch.

### Update develop

```bash
git checkout develop
git pull origin develop
```

### Switch to your branch

```bash
git checkout feature/RZA-260001
```

### Merge develop

```bash
git merge develop --no-commit
```

### Why --no-commit

This allows you to:

- Review incoming changes
- Resolve conflicts
- Test the application
- Create the merge commit only after verification

### Complete merge

```bash
git add .
git commit
git push origin feature/RZA-260001
```

---

## Resolving Conflicts

If conflicts occur:

1. Open the project in VS Code.
2. Review conflicting sections.
3. Use:
   - Accept Current Change
   - Accept Incoming Change
   - Accept Both Changes
   - Compare Changes

4. Verify the application works correctly.

Complete the merge:

```bash
git add .
git commit
git push
```

---

## Renaming a Branch

Rename local branch:

```bash
git branch -m feature/RZA-260001
```

Push renamed branch:

```bash
git push origin -u feature/RZA-260001
```

Delete old remote branch:

```bash
git push origin --delete old-branch-name
```

Verify:

- New branch exists on GitHub
- Old branch is removed
- Open PRs are updated if necessary

---

## Pull Requests

Every Pull Request should include:

### Summary

Clearly explain:

- What was changed
- Why it was changed
- Any limitations or considerations

### Evidence

Provide one or more of the following:

- Screenshots
- Screen recordings
- API examples
- Before/After comparisons

### Before Requesting Review

- Latest develop branch merged
- Conflicts resolved
- Changes tested
- Screenshots attached
- Documentation updated if required
- No debug code remains
