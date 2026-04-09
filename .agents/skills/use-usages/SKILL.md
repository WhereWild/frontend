---
name: use-usages
description: Find all references to a symbol using the usages tool instead of grep
---

# Use the `usages` tool for finding references

When finding where a symbol (function, class, variable, type) is used, **always use the `usages` tool** instead of grep or text search.

## Why

- `usages` is backed by the language server / extension API — it understands scope and types
- grep matches strings, not symbols: it produces false positives (comments, string literals, similarly-named things) and false negatives (aliased imports)
- `usages` uses significantly fewer tokens on large codebases

## When to use it

Use `usages` any time you need to:
- Find all call sites of a function
- Check what imports or references a module/class
- Understand the blast radius before modifying a symbol

## When grep is still appropriate

- Searching for literal strings, log messages, or comments
- Searching for patterns that aren't symbol references (e.g., regex in config files)

## Example

> Use #usages to find all references to `parseConfig`

Do not fall back to grep for symbol lookups. If `usages` returns no results, verify the symbol name before retrying.