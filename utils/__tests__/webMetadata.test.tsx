import {
  __WEB_METADATA_TESTING__,
  DEFAULT_METADATA_DESCRIPTION,
} from '../webMetadata';
import type { ImageSourcePropType } from 'react-native';

describe('webMetadata helpers', () => {
  it('builds absolute urls from relative paths', () => {
    expect(__WEB_METADATA_TESTING__.buildAbsoluteUrl('/species/1/owl')).toBe(
      'https://wherewild.net/species/1/owl',
    );
  });

  it('prefers an explicit origin when building metadata documents', () => {
    const metadata = __WEB_METADATA_TESTING__.buildMetadataDocument({
      origin: 'https://aurora-8081.wherewild.net',
      path: '/species/1/owl',
      title: 'WhereWild | Owl',
    });

    expect(metadata.absoluteUrl).toBe(
      'https://aurora-8081.wherewild.net/species/1/owl',
    );
  });

  it('does not guess a browser metadata origin without window or configured site url', () => {
    expect(__WEB_METADATA_TESTING__.resolveWebMetadataOrigin()).toBeUndefined();
  });

  it('escapes html-sensitive metadata values', () => {
    expect(__WEB_METADATA_TESTING__.escapeHtml('Snowy "Owl" & friends')).toBe(
      'Snowy &quot;Owl&quot; &amp; friends',
    );
  });

  it('renders a summary card when no image is present', () => {
    const html = __WEB_METADATA_TESTING__.renderMetadataHtmlDocument({
      title: 'WhereWild | Snowy Owl',
      path: '/species/1/snowy-owl',
    });

    expect(html).toContain('twitter:card" content="summary"');
    expect(html).not.toContain('og:image');
  });

  it('uses the default description when none is supplied', () => {
    const metadata = __WEB_METADATA_TESTING__.buildMetadataDocument({
      title: 'WhereWild | Snowy Owl',
    });

    expect(metadata.description).toBe(DEFAULT_METADATA_DESCRIPTION);
  });

  it('builds absolute image urls from root-relative asset uris', () => {
    const imageSource = {
      uri: '/assets/images/wherewild-logo.png',
    } as ImageSourcePropType;

    expect(
      __WEB_METADATA_TESTING__.resolveOpenGraphImageUrl(
        imageSource,
        'https://wherewild.net',
      ),
    ).toBe('https://wherewild.net/assets/images/wherewild-logo.png');
  });

  it('marks non-production variants as noindex', () => {
    expect(__WEB_METADATA_TESTING__.shouldAddNoIndexMeta('preview')).toBe(true);
    expect(__WEB_METADATA_TESTING__.shouldAddNoIndexMeta('production')).toBe(
      false,
    );
  });

  it('renders robots noindex when metadata is marked non-production', () => {
    const html = __WEB_METADATA_TESTING__.renderMetadataHtmlDocument({
      noindex: true,
      title: 'WhereWild | Preview',
    });

    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });
});
