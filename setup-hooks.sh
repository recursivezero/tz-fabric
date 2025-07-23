#!/bin/bash

# Define the hooks directory
HOOKS_DIR=".githooks"
GIT_HOOKS_DIR=".git/hooks"

# Check if .git/hooks exists
if [ ! -d "$GIT_HOOKS_DIR" ]; then
    echo "Error: This script must be run from the root of a Git repository."
    exit 1
fi

# Copy hooks to .git/hooks and make them executable
for HOOK in pre-commit prepare-commit-msg; do
    if [ -f "$HOOKS_DIR/$HOOK" ]; then
        cp "$HOOKS_DIR/$HOOK" "$GIT_HOOKS_DIR/$HOOK"
        chmod +x "$GIT_HOOKS_DIR/$HOOK"
        echo "$HOOK installed."
    else
        echo "Warning: $HOOK not found in $HOOKS_DIR."
    fi
done

echo "All hooks have been set up."
