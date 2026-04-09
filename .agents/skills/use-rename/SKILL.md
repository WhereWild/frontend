---
name: use-rename
description: Rename symbols across the codebase using the rename tool instead of find-and-replace
---

# Use the `rename` tool for symbol renaming

When renaming a function, class, variable, or type, **always use the `rename` tool** instead of grep + sed, find-and-replace, or manual edits.

## Why

- `rename` delegates to the language server / extension refactoring API — it renames the symbol semantically, not textually
- Text-based approaches miss aliased imports, re-exports, and dynamic references; they also corrupt unrelated matches (e.g., a local variable with the same name in a different scope)
- `rename` is atomic: all changes happen together, reducing the risk of a broken intermediate state

## When to use it

Any time you are asked to rename a symbol. Examples:
- "rename `fib` to `fibonacci`"
- "rename the `User` class to `Account`"
- "change `handleClick` to `onButtonPress`"

## Example

> Use #rename and change the name of `fib` to `fibonacci`

## Fallback

If `rename` fails (unsupported language, no LSP active), note the failure explicitly and ask before falling back to text replacement.