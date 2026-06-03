---
# SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
#
# SPDX-License-Identifier: AGPL-3.0-or-later

name: use-go-to-definition
description: Use the go-to-definition tool to find where a symbol is declared instead of reading entire files or grepping for imports
---

# Use `go-to-definition` for symbol lookup

When you need to find where a function, type, component, or constant is defined, use the `go-to-definition` tool. Do not open entire files or grep for import paths to trace a symbol.

## When to use it

- Finding the implementation of a component, hook, or utility
- Tracing where a type or interface is declared
- Following an import chain without reading whole files

## When not to use it

- The symbol is inline in the file you're already looking at
- You're looking for a string literal or comment, not a code symbol