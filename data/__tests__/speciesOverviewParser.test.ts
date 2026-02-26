import {
  parseOverviewSectionsFromDescriptionText,
  parseOverviewSectionsFromDetailSource,
} from '../speciesOverviewParser';

describe('speciesOverviewParser', () => {
  it('returns empty sections when description text is blank', () => {
    expect(parseOverviewSectionsFromDescriptionText('   \n\n')).toEqual([]);
  });

  it('parses unlabeled frequency lines into prefixed overview lines', () => {
    const sections = parseOverviewSectionsFromDescriptionText('almost always in boreal forests');

    expect(sections).toEqual([
      {
        id: 'section-1',
        title: 'Overview',
        lines: [
          {
            prefix: 'Almost always in:',
            body: 'boreal forests',
          },
        ],
      },
    ]);
  });

  it('parses labeled lines and slugifies section titles', () => {
    const sections = parseOverviewSectionsFromDescriptionText('Habitat & Range: often in wetlands');

    expect(sections).toEqual([
      {
        id: 'habitat-range',
        title: 'Habitat & Range',
        lines: [
          {
            prefix: 'Often in:',
            body: 'wetlands',
          },
        ],
      },
    ]);
  });

  it('treats trailing-colon lines as plain overview lines', () => {
    const sections = parseOverviewSectionsFromDescriptionText('Habitat:   ');

    expect(sections).toEqual([
      {
        id: 'section-1',
        title: 'Overview',
        lines: [{ body: 'Habitat:' }],
      },
    ]);
  });

  it('uses detail profile sections when valid and filters invalid rows', () => {
    const sections = parseOverviewSectionsFromDetailSource(
      {
        description_profile: {
          sections: [
            { id: 'manual-id', title: 'Summary', lines: [{ body: 'Visible' }] },
            { title: '   ', lines: [{ body: 'Missing title' }] },
            { title: 'Climate', lines: [{ body: 'Cool and wet' }] },
            { title: 'Terrain', lines: [{ body: '   ' }] },
          ],
        },
      },
      'Summary: fallback text',
    );

    expect(sections).toEqual([
      {
        id: 'manual-id',
        title: 'Summary',
        lines: [{ body: 'Visible' }],
      },
      {
        id: 'climate',
        title: 'Climate',
        lines: [{ body: 'Cool and wet' }],
      },
    ]);
  });

  it('falls back to parsing description when profile sections are missing or invalid', () => {
    const sectionsFromSnake = parseOverviewSectionsFromDetailSource(
      { description_profile: { sections: [{ title: 'Only title', lines: [] }] } },
      'Climate: sometimes in cool temperate climates',
    );

    const sectionsFromCamel = parseOverviewSectionsFromDetailSource(
      { descriptionProfile: null },
      'Locations: North America',
    );

    expect(sectionsFromSnake).toEqual([
      {
        id: 'climate',
        title: 'Climate',
        lines: [
          {
            prefix: 'Sometimes in:',
            body: 'cool temperate climates',
          },
        ],
      },
    ]);

    expect(sectionsFromCamel).toEqual([
      {
        id: 'locations',
        title: 'Locations',
        lines: [{ body: 'North America' }],
      },
    ]);
  });

});
