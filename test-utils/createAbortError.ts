// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export const createAbortError = () => {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
};
