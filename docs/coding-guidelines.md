# Coding Guidelines

## Naming

- Use meaningful and descriptive names.
- Avoid abbreviations unless commonly understood.
- Functions should describe actions.
- Variables should describe data.

## Functions

- Keep functions focused on a single responsibility.
- Prefer small, composable functions.
- Avoid deeply nested conditions.
- Reuse existing utilities where possible.

## Comments

- Explain why, not what.
- Remove outdated comments.
- Avoid commenting obvious code.

## Error Handling

- Handle errors explicitly.
- Provide actionable error messages.
- Never silently ignore failures.

## Dependencies

- Introduce new dependencies only when justified.
- Prefer platform-native solutions when practical.

## Code Reviews

- Optimize for readability.
- Avoid unnecessary complexity.
- Follow existing project conventions.

## Development Environment

### Use the Workspace File

Always open the project using the provided VS Code workspace file (`*.code-workspace`).

Benefits:

- Consistent settings
- Recommended extensions
- Shared tasks and debugging configuration
- Reduced environment-related issues

Open the workspace:

```bash
code project.code-workspace
```

### Recommended Extensions

Install all workspace-recommended extensions.

These help maintain:

- Formatting consistency
- Linting standards
- Import organization
- Code quality checks

### Workspace Files

Do not commit personal workspace modifications unless they benefit the entire team.
