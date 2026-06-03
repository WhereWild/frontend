// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export function stripDiacritics(input?: string): string {
  if (!input) return '';
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}