// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { toKebabCase } from '@/utils/string';

describe('toKebabCase', () => {
  it('lowercases letters and replaces spaces with hyphens', () => {
    expect(toKebabCase('Mountain Ball Cactus')).toBe('mountain-ball-cactus');
  });

  it('collapses consecutive non-alphanumeric characters to a single hyphen', () => {
    expect(toKebabCase('Strix___nebulosa!! great owl')).toBe('strix-nebulosa-great-owl');
  });

  it('trims leading and trailing separators', () => {
    expect(toKebabCase('  --Prairie Smoke-- ')).toBe('prairie-smoke');
  });

  it('returns an empty string when no alphanumeric characters are provided', () => {
    expect(toKebabCase('---___***')).toBe('');
  });

  it('handles already kebab-cased input without changes', () => {
    expect(toKebabCase('geum-triflorum')).toBe('geum-triflorum');
  });
});
