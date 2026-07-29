# Architecture Principles

## Separation of Concerns

Keep business logic, presentation, and data access separated.

## Single Source of Truth

Avoid duplicating ownership of the same data.

## Predictability

Prefer explicit flows over hidden side effects.

## Backward Compatibility

Consider impact on existing users and integrations before making breaking changes.

## Security First

Validate all external input.

Never trust client-provided data.

## Reuse Existing Patterns

Before introducing a new pattern, evaluate whether an existing project pattern already solves the problem.
