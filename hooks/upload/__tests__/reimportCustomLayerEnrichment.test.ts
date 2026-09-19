// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type * as DocumentPicker from 'expo-document-picker';
import type { EnvironmentVariableDefinition } from '@/data/types';
import {
  buildReimportRawCsv,
  findExistingCustomLayerDescriptors,
  planCustomLayerReimport,
  resolveReimportExtras,
} from '../reimportCustomLayerEnrichment';

const asset = (name: string): DocumentPicker.DocumentPickerAsset =>
  ({
    name,
    uri: `file://${name}`,
  }) as unknown as DocumentPicker.DocumentPickerAsset;

const defs: EnvironmentVariableDefinition[] = [
  { id: 'bio_1', name: 'Temp', valueType: 'ratio', category: 'Climate' },
  {
    id: 'salinity_two',
    name: 'salinity_two',
    valueType: 'ordinal',
    category: 'Custom Layers',
    units: null,
    legendClasses: [{ id: 0, name: 'Low', color: '#440154' }],
  },
  // Custom category but an unusable value type -- must not become a descriptor.
  { id: 'odd', valueType: 'circular', category: 'Custom Layers' },
];

describe('findExistingCustomLayerDescriptors', () => {
  it('keeps only custom-layer variables with a supported value type, rebuilt from their own metadata', () => {
    expect(findExistingCustomLayerDescriptors(defs)).toEqual([
      {
        id: 'salinity_two',
        name: 'salinity_two',
        valueType: 'ordinal',
        units: null,
        legendClasses: [{ id: 0, name: 'Low', color: '#440154' }],
      },
    ]);
  });
});

describe('planCustomLayerReimport', () => {
  it('splits attached files into already-present vs genuinely new by slugged id', () => {
    const { alreadyPresent, newLayers } = planCustomLayerReimport(
      [asset('Salinity Two.tif'), asset('rainfall.tif')],
      new Set(['salinity_two']),
    );
    expect(alreadyPresent.map((a) => a.name)).toEqual(['Salinity Two.tif']);
    expect(newLayers.map((a) => a.name)).toEqual(['rainfall.tif']);
  });
});

describe('buildReimportRawCsv', () => {
  it('emits base columns plus preserved custom columns, dropping real catalog variables', () => {
    const csv = buildReimportRawCsv(
      [
        {
          catalogNumber: 'A',
          decimalLatitude: 1,
          decimalLongitude: 2,
          observationName: 'Smith, John',
          bio_1: 12.5,
          salinity_two: 3,
        },
        {
          catalogNumber: 'B',
          decimalLatitude: 4,
          decimalLongitude: 5,
          salinity_two: null,
        },
      ],
      findExistingCustomLayerDescriptors(defs),
    );
    expect(csv).toBe(
      [
        'catalogNumber,decimalLatitude,decimalLongitude,observationName,imageUrl,salinity_two',
        'A,1,2,"Smith, John",,3',
        'B,4,5,,,',
      ].join('\n'),
    );
    expect(csv).not.toContain('bio_1');
  });
});

describe('resolveReimportExtras', () => {
  const embedded = new Blob(['img']);
  const carried = {
    descriptionSections: [{ id: 'a', title: 'A', lines: [] }],
    imageUrl: 'blob:local',
    imageBlob: embedded,
    imageFilename: 'taxon_image.png',
    parentTaxonId: '6SRLS',
  } as never;

  it('carries over everything the ZIP already had when Extra options are blank', () => {
    expect(resolveReimportExtras(carried, {})).toEqual({
      generateDescription: true,
      image: embedded,
      imageFilename: 'taxon_image.png',
      // The ZIP's own imageUrl for an embedded image is a local object URL.
      imageUrl: undefined,
      parentTaxonId: '6SRLS',
    });
  });

  it('lets Extra options override the ZIP, including swapping the image', () => {
    const chosen = new Blob(['new']);
    expect(
      resolveReimportExtras(carried, {
        image: chosen,
        imageFilename: 'new.png',
        parentTaxonId: 'XYZ',
      }),
    ).toMatchObject({
      image: chosen,
      imageFilename: 'new.png',
      imageUrl: undefined,
      parentTaxonId: 'XYZ',
    });
  });

  it('carries a remote imageUrl but never sends one alongside an embedded image', () => {
    expect(
      resolveReimportExtras(
        { imageUrl: 'https://example.com/a.jpg' } as never,
        {},
      ),
    ).toMatchObject({
      image: undefined,
      imageUrl: 'https://example.com/a.jpg',
    });
  });

  it('sends nothing for a ZIP that carried no extras', () => {
    expect(resolveReimportExtras(undefined, {})).toEqual({
      generateDescription: false,
      image: undefined,
      imageFilename: undefined,
      imageUrl: undefined,
      parentTaxonId: undefined,
    });
  });
});
