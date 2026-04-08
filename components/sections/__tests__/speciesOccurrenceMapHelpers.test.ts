import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { Asset } from 'expo-asset';
import {
  buildLeafletHtml,
  getMapTileUrlTemplate,
  HIGHLIGHT_MESSAGE_TYPE,
  isPinObservationEventFromFrame,
  isPinObservationMessage,
  loadFallbackMapTemplate,
  loadMapTemplate,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_URL_TEMPLATE_DARK,
  MAP_TILE_URL_TEMPLATE_LIGHT,
  MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS,
  MAP_DOCUMENT_BASE_URL,
  PIN_OBSERVATION_MESSAGE_TYPE,
  MAP_REFERRER_POLICY,
  SELECTED_POINT_MESSAGE_TYPE,
  toHighlightMessagePayload,
  toSelectedPointMessagePayload,
} from '../speciesOccurrenceMap/speciesOccurrenceMapHelpers';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        stadiaMapsApiKey: ' test-stadia-key ',
      },
    },
  },
}));

describe('speciesOccurrenceMapHelpers', () => {
  const originalFetch = global.fetch;
  const validTemplateHtml = '<html><body><div id="map"></div><script>__POINTS_JSON__</script></body></html>';

  const markerPalette = {
    markerFill: '#111111',
    markerStroke: '#222222',
    highlightFill: '#333333',
    highlightStroke: '#444444',
    selectedPointFill: '#F59E0B',
    selectedPointStroke: '#F59E0B',
  };

  const extractInlineScript = (html: string) => {
    const match = html.match(/<script>([\s\S]*)<\/script>/);
    if (!match?.[1]) {
      throw new Error('Expected inline map script in template');
    }
    return match[1];
  };

  type MockLeafletMarker = {
    coords: [number, number];
    style: Record<string, unknown>;
    addTo: jest.Mock<MockLeafletMarker, []>;
    setStyle: jest.Mock<void, [Record<string, unknown>]>;
    setLatLng: jest.Mock;
    bindPopup: jest.Mock;
  };

  const createLeafletHarness = () => {
    const eventHandlers = new Map<string, () => void>();
    const documentListeners = new Map<string, (event: { data: unknown }) => void>();
    const windowListeners = new Map<string, (event: { data: unknown }) => void>();
    const createdMarkers: {
      style: Record<string, unknown>;
      setStyle: jest.Mock;
      setLatLng: jest.Mock;
      bindPopup: jest.Mock;
    }[] = [];
    let visibleLongitudePredicate = (_longitude: number) => false;

    const makeLayer = () => ({
      addTo: jest.fn().mockReturnThis(),
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    });

    const map = {
      on: jest.fn((eventName: string, handler: () => void) => {
        const existing = eventHandlers.get(eventName);
        if (existing) {
          eventHandlers.set(eventName, () => { existing(); handler(); });
        } else {
          eventHandlers.set(eventName, handler);
        }
      }),
      setMinZoom: jest.fn(),
      getSize: jest.fn(() => ({ x: 256 })),
      getBounds: jest.fn(() => ({
        contains: ({ lng }: { lng: number }) => visibleLongitudePredicate(lng),
        getWest: jest.fn(() => -180),
        getSouth: jest.fn(() => -90),
        getEast: jest.fn(() => 180),
        getNorth: jest.fn(() => 90),
      })),
      getCenter: jest.fn(() => ({ lng: 0 })),
      removeLayer: jest.fn(),
      addLayer: jest.fn(),
      fitBounds: jest.fn(),
      setView: jest.fn(),
    };

    const L = {
      latLngBounds: jest.fn(() => ({})),
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      map: jest.fn(() => map),
      tileLayer: jest.fn(() => ({
        addTo: jest.fn().mockReturnThis(),
        createTile: jest.fn(() => ({ referrerPolicy: '' })),
      })),
      circleMarker: jest.fn((coords: [number, number], style: Record<string, unknown>) => {
        const marker: MockLeafletMarker = {
          coords,
          style: { ...style },
          addTo: jest.fn(() => marker),
          setStyle: jest.fn((nextStyle: Record<string, unknown>) => {
            marker.style = { ...nextStyle };
          }),
          setLatLng: jest.fn(),
          bindPopup: jest.fn(),
        };
        createdMarkers.push(marker);
        return marker;
      }),
      markerClusterGroup: jest.fn(() => makeLayer()),
      layerGroup: jest.fn(() => makeLayer()),
    };

    const document = {
      addEventListener: jest.fn((eventName: string, handler: (event: { data: unknown }) => void) => {
        documentListeners.set(eventName, handler);
      }),
    };

    const windowObject = {
      addEventListener: jest.fn((eventName: string, handler: (event: { data: unknown }) => void) => {
        windowListeners.set(eventName, handler);
      }),
      parent: {
        postMessage: jest.fn(),
      },
    };

    return {
      context: {
        L,
        document,
        window: windowObject,
        console,
        Map,
        Set,
        Math,
        Number,
        JSON,
        isFinite,
      },
      createdMarkers,
      eventHandlers,
      documentListeners,
      windowListeners,
      setVisibleLongitudePredicate(predicate: (longitude: number) => boolean) {
        visibleLongitudePredicate = predicate;
      },
    };
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('buildLeafletHtml replaces the runtime placeholders', () => {
    const html = buildLeafletHtml(
      '__DOCUMENT_BASE_URL__|__REFERRER_POLICY__|__REFERRER_POLICY_JSON__|__TILE_URL_JSON__|__TILE_ATTRIBUTION_JSON__|__TILE_MAX_ZOOM__|__MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS__|__POINTS_JSON__|__PALETTE_JSON__|__HIGHLIGHT_MESSAGE_TYPE_JSON__|__SELECTED_POINT_MESSAGE_TYPE_JSON__',
      [{ latitude: 1, longitude: 2 }],
      markerPalette,
      getMapTileUrlTemplate('light'),
    );

    expect(html).toContain('latitude');
    expect(html).toContain('markerFill');
    expect(html).toContain(MAP_DOCUMENT_BASE_URL);
    expect(html).toContain(MAP_REFERRER_POLICY);
    expect(html).toContain(JSON.stringify(MAP_REFERRER_POLICY));
    expect(html).toContain(JSON.stringify(getMapTileUrlTemplate('light')));
    expect(html).toContain(JSON.stringify(MAP_TILE_ATTRIBUTION));
    expect(html).toContain(String(MAP_TILE_MAX_ZOOM));
    expect(html).toContain(String(MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS));
    expect(html).toContain(JSON.stringify(HIGHLIGHT_MESSAGE_TYPE));
    expect(html).toContain(JSON.stringify(SELECTED_POINT_MESSAGE_TYPE));
    expect(html).not.toContain('__POINTS_JSON__');
  });

  it('prepares popup-safe catalog fields before injecting map points', () => {
    const html = buildLeafletHtml(
      '__POINTS_JSON__',
      [{
        catalogNumber: 'abc" onclick="alert(1)<tag>',
        latitude: 1,
        longitude: 2,
      }],
      markerPalette,
      getMapTileUrlTemplate('light'),
    );

    expect(html).toContain('popupCatalogHref');
    expect(html).toContain('abc%22%20onclick%3D%22alert(1)%3Ctag%3E');
    expect(html).toContain('popupCatalogLabel');
    expect(html).toContain('abc&quot; onclick=&quot;alert(1)&lt;tag&gt;');
  });

  it('renders pin actions without inline JavaScript handlers', () => {
    const templatePaths = [
      path.join(__dirname, '..', 'speciesOccurrenceMap', 'SpeciesOccurrenceMap.html'),
      path.join(__dirname, '..', 'speciesOccurrenceMap', 'SpeciesOccurrenceMapFallback.html'),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');
      const html = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'abc" onclick="alert(1)', latitude: 1, longitude: 2 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
      );

      expect(html).toContain('data-pin-observation="true"');
      expect(html).toContain('popupCatalogHref":"abc%22%20onclick%3D%22alert(1)"');
      expect(html).not.toContain('onclick="sendPinMessage');
    });
  });

  it('keeps clustered highlight state when zooming into direct markers', () => {
    const templatePaths = [
      path.join(__dirname, '..', 'speciesOccurrenceMap', 'SpeciesOccurrenceMap.html'),
      path.join(__dirname, '..', 'speciesOccurrenceMap', 'SpeciesOccurrenceMapFallback.html'),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');
      const html = buildLeafletHtml(
        rawTemplate,
        [
          { catalogNumber: 101, latitude: 10, longitude: 20 },
          { catalogNumber: 202, latitude: 11, longitude: 40 },
        ],
        markerPalette,
        getMapTileUrlTemplate('light'),
      ).replace(String(MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS), '1');
      const harness = createLeafletHarness();
      harness.setVisibleLongitudePredicate(() => true);

      vm.runInNewContext(extractInlineScript(html), harness.context);

      expect(harness.createdMarkers).toHaveLength(2);

      harness.windowListeners.get('message')?.({
        data: toHighlightMessagePayload(['101']),
      });

      harness.setVisibleLongitudePredicate((longitude) => longitude === 20);
      harness.eventHandlers.get('zoomend')?.();

      expect(harness.createdMarkers).toHaveLength(3);
      expect(harness.createdMarkers[2]?.style).toMatchObject({
        fillColor: markerPalette.highlightFill,
        color: markerPalette.highlightStroke,
        radius: 5,
      });
    });
  });

  it('creates the expected highlight payload', () => {
    expect(toHighlightMessagePayload(['10', '20'])).toEqual({
      type: HIGHLIGHT_MESSAGE_TYPE,
      catalogs: ['10', '20'],
    });
  });

  it('creates the expected selected point payload', () => {
    expect(toSelectedPointMessagePayload({ latitude: 40, longitude: -111 })).toEqual({
      type: SELECTED_POINT_MESSAGE_TYPE,
      point: { latitude: 40, longitude: -111 },
    });
    expect(toSelectedPointMessagePayload(null)).toEqual({
      type: SELECTED_POINT_MESSAGE_TYPE,
      point: null,
    });
  });

  it('renders and clears the selected point marker from messages', () => {
    const templatePaths = [
      path.join(__dirname, '..', 'speciesOccurrenceMap', 'SpeciesOccurrenceMap.html'),
      path.join(__dirname, '..', 'speciesOccurrenceMap', 'SpeciesOccurrenceMapFallback.html'),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');
      const html = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 101, latitude: 10, longitude: 20 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
      );
      const harness = createLeafletHarness();

      vm.runInNewContext(extractInlineScript(html), harness.context);

      expect(harness.createdMarkers).toHaveLength(1);

      harness.windowListeners.get('message')?.({
        data: toSelectedPointMessagePayload({ latitude: 40, longitude: -111 }),
      });

      expect(harness.createdMarkers).toHaveLength(2);
      expect(harness.createdMarkers[1]?.style).toMatchObject({
        fillColor: markerPalette.selectedPointFill,
        color: markerPalette.selectedPointStroke,
        radius: 6,
      });

      harness.windowListeners.get('message')?.({
        data: toSelectedPointMessagePayload(null),
      });

      expect(harness.context.L.map).toHaveBeenCalled();
      expect((harness.context.L.map as jest.Mock).mock.results[0]?.value.removeLayer).toHaveBeenCalled();
    });
  });

  it('accepts only well-formed pin observation messages', () => {
    expect(
      isPinObservationMessage({
        type: PIN_OBSERVATION_MESSAGE_TYPE,
        catalogNumber: '123',
        latitude: 10,
        longitude: 20,
      }),
    ).toBe(true);

    expect(
      isPinObservationMessage({
        type: PIN_OBSERVATION_MESSAGE_TYPE,
        latitude: 10,
        longitude: 20,
      }),
    ).toBe(false);

    expect(
      isPinObservationMessage({
        type: PIN_OBSERVATION_MESSAGE_TYPE,
        catalogNumber: 123,
        latitude: 10,
        longitude: 20,
      }),
    ).toBe(false);
  });

  it('only trusts pin observation messages from the active iframe window', () => {
    const frameWindow = {} as Window;
    const otherWindow = {} as Window;
    const validEvent = {
      source: frameWindow,
      data: {
        type: PIN_OBSERVATION_MESSAGE_TYPE,
        catalogNumber: '123',
        latitude: 10,
        longitude: 20,
      },
    } as Pick<MessageEvent, 'data' | 'source'>;

    expect(isPinObservationEventFromFrame(validEvent, frameWindow)).toBe(true);
    expect(isPinObservationEventFromFrame(validEvent, otherWindow)).toBe(false);
    expect(
      isPinObservationEventFromFrame(
        {
          source: frameWindow,
          data: {
            type: PIN_OBSERVATION_MESSAGE_TYPE,
            latitude: 10,
            longitude: 20,
          },
        } as Pick<MessageEvent, 'data' | 'source'>,
        frameWindow,
      ),
    ).toBe(false);
  });

  it('loads the external html template through expo-asset', async () => {
    const downloadAsync = jest.fn().mockResolvedValue(undefined);
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: undefined,
      uri: 'mock://SpeciesOccurrenceMap.html',
      downloadAsync,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(validTemplateHtml),
    } as unknown as Response);

    await expect(loadMapTemplate()).resolves.toBe(validTemplateHtml);
    expect(downloadAsync).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('mock://SpeciesOccurrenceMap.html');
  });

  it('returns null when the external html template fetch fails', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: 'mock://SpeciesOccurrenceMap.html',
      uri: 'mock://SpeciesOccurrenceMap.html',
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('network failed'));

    await expect(loadMapTemplate()).resolves.toBeNull();
  });

  it('returns null when the external html template responds with a non-ok status', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: 'mock://SpeciesOccurrenceMap.html',
      uri: 'mock://SpeciesOccurrenceMap.html',
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue('<html><body>404</body></html>'),
    } as unknown as Response);

    await expect(loadMapTemplate()).resolves.toBeNull();
  });

  it('returns null when the fetched html is not the map template', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: 'mock://SpeciesOccurrenceMap.html',
      uri: 'mock://SpeciesOccurrenceMap.html',
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html><body><h1>App Shell</h1></body></html>'),
    } as unknown as Response);

    await expect(loadMapTemplate()).resolves.toBeNull();
  });

  it('loads the dedicated fallback html template through expo-asset', async () => {
    const downloadAsync = jest.fn().mockResolvedValue(undefined);
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: undefined,
      uri: 'mock://SpeciesOccurrenceMapFallback.html',
      downloadAsync,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(validTemplateHtml),
    } as unknown as Response);

    await expect(loadFallbackMapTemplate()).resolves.toBe(validTemplateHtml);
    expect(downloadAsync).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('mock://SpeciesOccurrenceMapFallback.html');
  });

  it('exposes a stable document base url for map referrers', () => {
    expect(MAP_DOCUMENT_BASE_URL).toBe('https://wherewild.net/');
  });

  it('exposes stable map transport constants for Stadia and declustering', () => {
    expect(MAP_REFERRER_POLICY).toBe('strict-origin-when-cross-origin');
    expect(MAP_TILE_URL_TEMPLATE_LIGHT).toBe(
      'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    );
    expect(MAP_TILE_URL_TEMPLATE_DARK).toBe(
      'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    );
    expect(MAP_TILE_ATTRIBUTION).toContain('Stadia Maps');
    expect(MAP_TILE_MAX_ZOOM).toBe(20);
    expect(MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS).toBe(5000);
  });

  it('resolves a tile template for both light and dark map modes', () => {
    expect(getMapTileUrlTemplate('light')).toContain('alidade_smooth');
    expect(getMapTileUrlTemplate('dark')).toContain('alidade_smooth_dark');
    expect(getMapTileUrlTemplate('light')).toContain('api_key=test-stadia-key');
  });

  it('treats a non-string Stadia config value as absent', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            stadiaMapsApiKey: { token: 'unexpected-object' },
          },
        },
      },
    }));

    const isolatedHelpers = jest.requireActual('../speciesOccurrenceMap/speciesOccurrenceMapHelpers') as typeof import('../speciesOccurrenceMap/speciesOccurrenceMapHelpers');

    expect(isolatedHelpers.MAP_TILE_API_KEY).toBeNull();
    expect(isolatedHelpers.getMapTileUrlTemplate('light')).toBe(MAP_TILE_URL_TEMPLATE_LIGHT);

    jest.dontMock('expo-constants');
    jest.resetModules();
  });
});
