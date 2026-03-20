import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import {
  buildLeafletHtml,
  HEATMAP_DATA_MESSAGE_TYPE,
  HEATMAP_FETCH_MESSAGE_TYPE,
  getMapTileUrlTemplate,
  HIGHLIGHT_MESSAGE_TYPE,
  loadFallbackMapTemplate,
  loadMapTemplate,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_URL_TEMPLATE_DARK,
  MAP_TILE_URL_TEMPLATE_LIGHT,
  MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS,
  MAP_DOCUMENT_BASE_URL,
  MAP_REFERRER_POLICY,
  setupWebHeatmapBridge,
  toHighlightMessagePayload,
} from '../speciesOccurrenceMap/speciesOccurrenceMapHelpers';

const mockCreatePredictHeatmapJob = jest.fn();
const mockDeletePredictHeatmapJob = jest.fn();
const mockStreamPredictHeatmapJob = jest.fn();

jest.mock('@/data/api', () => ({
  createPredictHeatmapJob: (...args: unknown[]) => mockCreatePredictHeatmapJob(...args),
  deletePredictHeatmapJob: (...args: unknown[]) => mockDeletePredictHeatmapJob(...args),
  streamPredictHeatmapJob: (...args: unknown[]) => mockStreamPredictHeatmapJob(...args),
}));

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
  const originalWindow = global.window;
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

  afterEach(() => {
    global.fetch = originalFetch;
    global.window = originalWindow;
    mockCreatePredictHeatmapJob.mockReset();
    mockDeletePredictHeatmapJob.mockReset();
    mockStreamPredictHeatmapJob.mockReset();
    jest.clearAllMocks();
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
  });

  it('buildLeafletHtml replaces the runtime placeholders', () => {
    const html = buildLeafletHtml(
      '__DOCUMENT_BASE_URL__|__REFERRER_POLICY__|__REFERRER_POLICY_JSON__|__TILE_URL_JSON__|__TILE_ATTRIBUTION_JSON__|__TILE_MAX_ZOOM__|__MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS__|__POINTS_JSON__|__PALETTE_JSON__|__SPECIES_KEY_JSON__|__HEATMAP_POLICY_JSON__|__HIGHLIGHT_MESSAGE_TYPE_JSON__|__HEATMAP_FETCH_MESSAGE_TYPE_JSON__|__HEATMAP_DATA_MESSAGE_TYPE_JSON__|__HEATMAP_ERROR_MESSAGE_TYPE_JSON__|__HEATMAP_SETTINGS_MESSAGE_TYPE_JSON__',
      [{ latitude: 1, longitude: 2 }],
      {
        markerFill: '#111111',
        markerStroke: '#222222',
        highlightFill: '#333333',
        highlightStroke: '#444444',
        heatmapLow: '#555555',
        heatmapHigh: '#666666',
      },
      getMapTileUrlTemplate('light'),
      { speciesKey: 101 },
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
    expect(html).toContain('101');
    expect(html).toContain('zoomResolutionBreakpoints');
    expect(html).toContain(JSON.stringify(HIGHLIGHT_MESSAGE_TYPE));
    expect(html).toContain(JSON.stringify(HEATMAP_FETCH_MESSAGE_TYPE));
    expect(html).toContain(JSON.stringify(HEATMAP_DATA_MESSAGE_TYPE));
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
      {
        markerFill: '#111111',
        markerStroke: '#222222',
        highlightFill: '#333333',
        highlightStroke: '#444444',
        heatmapLow: '#555555',
        heatmapHigh: '#666666',
      },
      getMapTileUrlTemplate('light'),
    );

    expect(html).toContain('popupCatalogHref');
    expect(html).toContain('abc%22%20onclick%3D%22alert(1)%3Ctag%3E');
    expect(html).toContain('popupCatalogLabel');
    expect(html).toContain('abc&quot; onclick=&quot;alert(1)&lt;tag&gt;');
  });

  it('creates the expected highlight payload', () => {
    expect(toHighlightMessagePayload(['10', '20'])).toEqual({
      type: HIGHLIGHT_MESSAGE_TYPE,
      catalogs: ['10', '20'],
    });
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

  it('bridges heatmap fetch requests from the iframe and streams cell batches back', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    const listeners = new Map<string, EventListener>();
    global.window = {
      ...originalWindow,
      addEventListener: jest.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener);
      }),
      removeEventListener: jest.fn((type: string) => {
        listeners.delete(type);
      }),
    } as unknown as Window & typeof globalThis;

    const postMessage = jest.fn();
    const iframeWindow = { postMessage };
    const iframeRef = {
      current: {
        contentWindow: iframeWindow,
      },
    } as unknown as { current: HTMLIFrameElement | null };
    const activeHeatmapJobRef = {
      current: {
        requestId: null,
        jobId: null,
        abortController: null,
      },
    };

    mockCreatePredictHeatmapJob.mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
      streamUrl: '/stream',
      cancelUrl: '/cancel',
    });
    mockDeletePredictHeatmapJob.mockResolvedValue({ status: 'deleted' });
    mockStreamPredictHeatmapJob.mockImplementation(
      async (_jobId: string, options?: { onEvent?: (event: Record<string, unknown>) => void }) => {
        options?.onEvent?.({ type: 'meta', resolution: 0.5 });
        options?.onEvent?.({ type: 'cell', lat: 1, lon: 2, score: 0.7, nNative: 3, source: 'cell_table' });
        options?.onEvent?.({ type: 'done', nCells: 1 });
      },
    );

    const cleanup = setupWebHeatmapBridge(iframeRef, activeHeatmapJobRef);
    const listener = listeners.get('message');

    expect(listener).toBeDefined();

    listener?.({
      source: iframeWindow,
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 7,
        queryKey: 'species-101',
        query: {
          species_key: '101',
          min_lat: '-10',
          min_lon: '20',
          max_lat: '10',
          max_lon: '40',
          resolution: '0.5',
          include_source: 'true',
        },
      },
    } as unknown as MessageEvent<unknown>);

    await waitFor(() => {
      expect(mockCreatePredictHeatmapJob).toHaveBeenCalledWith(expect.objectContaining({
        speciesKey: '101',
        resolution: 0.5,
        includeSource: true,
      }));
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: HEATMAP_DATA_MESSAGE_TYPE,
          requestId: 7,
          queryKey: 'species-101',
          cells: [{ lat: 1, lon: 2, score: 0.7, nNative: 3, source: 'cell_table' }],
        }),
        '*',
      );
    });

    cleanup();
    expect(global.window.removeEventListener).toHaveBeenCalled();
  });
});