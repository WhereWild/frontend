// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { __SPECIES_OPEN_GRAPH_TESTING__ } from '../speciesOpenGraph';

describe('species open graph helpers', () => {
  it('detects crawler user agents', () => {
    expect(
      __SPECIES_OPEN_GRAPH_TESTING__.isCrawlerUserAgent('Discordbot/2.0'),
    ).toBe(true);
    expect(
      __SPECIES_OPEN_GRAPH_TESTING__.isCrawlerUserAgent('Mozilla/5.0'),
    ).toBe(false);
  });

  it('parses species routes with taxon ids', () => {
    expect(
      __SPECIES_OPEN_GRAPH_TESTING__.parseSpeciesPath(
        '/species/12345/snowy-owl',
      ),
    ).toEqual({ slug: 'snowy-owl', taxonId: '12345' });
  });

  it('builds species metadata from backend payloads', () => {
    expect(
      __SPECIES_OPEN_GRAPH_TESTING__.buildSpeciesMetadataFields(
        {
          common_name: 'Snowy Owl',
          scientific_name: 'Bubo scandiacus',
          description: 'Large white owl adapted to Arctic climates.',
          image_url: 'https://example.com/owl.png',
          slug: 'snowy-owl',
        },
        { fallbackTaxonId: '12345' },
      ),
    ).toEqual({
      description: 'Large white owl adapted to Arctic climates.',
      imageUrl: 'https://example.com/owl.png',
      path: '/species/12345/snowy-owl',
      title: 'WhereWild | Snowy Owl (Bubo scandiacus)',
    });
  });

  it('prefers the requested route path over backend slug data', () => {
    expect(
      __SPECIES_OPEN_GRAPH_TESTING__.buildSpeciesMetadataFields(
        {
          common_name: 'Snowy Owl',
          scientific_name: 'Bubo scandiacus',
          slug: 'backend-slug',
        },
        {
          fallbackTaxonId: '12345',
          path: '/species/12345/requested-slug',
        },
      ).path,
    ).toBe('/species/12345/requested-slug');
  });

  it('renders a crawler html document with species metadata', () => {
    const html = __SPECIES_OPEN_GRAPH_TESTING__.renderSpeciesOpenGraphHtml({
      noindex: true,
      origin: 'https://aurora-8081.wherewild.net',
      path: '/species/12345/snowy-owl',
      payload: {
        common_name: 'Snowy Owl',
        description: 'Large white owl adapted to Arctic climates.',
        image_url: 'https://example.com/owl.png',
        scientific_name: 'Bubo scandiacus',
        slug: 'snowy-owl',
      },
      taxonId: '12345',
    });

    expect(html).toContain(
      'property="og:title" content="WhereWild | Snowy Owl (Bubo scandiacus)"',
    );
    expect(html).toContain(
      'property="og:url" content="https://aurora-8081.wherewild.net/species/12345/snowy-owl"',
    );
    expect(html).toContain(
      'property="og:image" content="https://example.com/owl.png"',
    );
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });
});
