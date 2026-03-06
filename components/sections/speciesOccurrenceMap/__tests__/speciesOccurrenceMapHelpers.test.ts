import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import {
  type ActiveHeatmapJob,
  buildLeafletHtml,
  DEFAULT_HEATMAP_MAP_POLICY,
  HEATMAP_DATA_MESSAGE_TYPE,
  HEATMAP_ERROR_MESSAGE_TYPE,
  HEATMAP_FETCH_MESSAGE_TYPE,
  loadMapTemplate,
  setupWebHeatmapBridge,
  toHighlightMessagePayload,
} from '../speciesOccurrenceMapHelpers';
import {
  createPredictHeatmapJob,
  deletePredictHeatmapJob,
  streamPredictHeatmapJob,
} from '@/data/api';

jest.mock('@/data/api', () => ({
  BACKEND_BASE: 'http://localhost:8000',
  createPredictHeatmapJob: jest.fn(),
  deletePredictHeatmapJob: jest.fn(),
  streamPredictHeatmapJob: jest.fn(),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(),
  },
}));

describe('speciesOccurrenceMapHelpers', () => {
  const originalWindow = global.window;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'web' });
  });

  afterEach(() => {
    global.window = originalWindow;
    global.fetch = originalFetch;
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
  });

  it('buildLeafletHtml replaces all placeholders including heatmap policy', () => {
    const template = [
      '__POINTS_JSON__',
      '__PALETTE_JSON__',
      '__API_BASE_JSON__',
      '__SPECIES_KEY_JSON__',
      '__HEATMAP_POLICY_JSON__',
      '__HIGHLIGHT_MESSAGE_TYPE_JSON__',
      '__HEATMAP_FETCH_MESSAGE_TYPE_JSON__',
      '__HEATMAP_DATA_MESSAGE_TYPE_JSON__',
      '__HEATMAP_ERROR_MESSAGE_TYPE_JSON__',
    ].join('|');

    const html = buildLeafletHtml(
      template,
      [{ latitude: 1, longitude: 2 }],
      {
        markerFill: '#111111',
        markerStroke: '#222222',
        highlightFill: '#333333',
        highlightStroke: '#444444',
        heatmapLow: '#555555',
        heatmapHigh: '#777777',
      },
      123,
      true,
      DEFAULT_HEATMAP_MAP_POLICY,
    );

    expect(html).toContain('latitude');
    expect(html).toContain('markerFill');
    expect(html).toContain('http://localhost:8000');
    expect(html).toContain('123');
    expect(html).toContain('"debounceMs":320');
    expect(html).toContain('"heatmap-fetch"');
    expect(html).toContain('"heatmap-data"');
    expect(html).toContain('"heatmap-error"');
    expect(html).not.toContain('__HEATMAP_POLICY_JSON__');
  });

  it('buildLeafletHtml clears species key when overlay is disabled', () => {
    const template = '__SPECIES_KEY_JSON__|__HEATMAP_POLICY_JSON__';

    const html = buildLeafletHtml(
      template,
      [{ latitude: 1, longitude: 2 }],
      {
        markerFill: '#111111',
        markerStroke: '#222222',
        highlightFill: '#333333',
        highlightStroke: '#444444',
        heatmapLow: '#555555',
        heatmapHigh: '#777777',
      },
      123,
      false,
      DEFAULT_HEATMAP_MAP_POLICY,
    );

    expect(html).toContain('""');
    expect(html).not.toContain('"123"');
    expect(html).not.toContain('__SPECIES_KEY_JSON__');
  });

  it('toHighlightMessagePayload builds highlight payload shape', () => {
    expect(toHighlightMessagePayload(['1', '2'])).toEqual({
      type: 'highlight',
      catalogs: ['1', '2'],
    });
  });

  it('loadMapTemplate returns null when asset resolution fails', async () => {
    (Asset.fromModule as jest.Mock).mockImplementation(() => {
      throw new Error('asset unavailable');
    });

    await expect(loadMapTemplate()).resolves.toBeNull();
  });

  it('loadMapTemplate downloads and returns template text when localUri is missing', async () => {
    const downloadAsync = jest.fn().mockResolvedValue(undefined);
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: undefined,
      uri: 'mock://template.html',
      downloadAsync,
    });
    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue('<html>template</html>'),
    } as unknown as Response);

    await expect(loadMapTemplate()).resolves.toBe('<html>template</html>');
    expect(downloadAsync).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('mock://template.html');
  });

  it('loadMapTemplate returns null when no asset uri is available', async () => {
    const downloadAsync = jest.fn().mockResolvedValue(undefined);
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: undefined,
      uri: undefined,
      downloadAsync,
    });

    await expect(loadMapTemplate()).resolves.toBeNull();
    expect(downloadAsync).toHaveBeenCalled();
  });

  it('loadMapTemplate returns null when fetched template text is empty', async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue({
      localUri: 'mock://template-empty.html',
      uri: 'mock://template-empty.html',
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    });
    global.fetch = jest.fn().mockResolvedValue({
      text: jest.fn().mockResolvedValue('   '),
    } as unknown as Response);

    await expect(loadMapTemplate()).resolves.toBeNull();
  });

  it('setupWebHeatmapBridge returns noop cleanup when not on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });

    const cleanup = setupWebHeatmapBridge(
      { current: null },
      { current: { requestId: null, jobId: null, abortController: null } },
    );

    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('ignores invalid incoming messages', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      { current: { requestId: null, jobId: null, abortController: null } },
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({ data: { type: 'not-heatmap' } } as MessageEvent<unknown>);

    expect(createPredictHeatmapJob).not.toHaveBeenCalled();
    expect(iframePostMessage).not.toHaveBeenCalled();
    cleanup();
  });

  it('ignores heatmap messages from other iframe sources', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const ownFrameWindow = { postMessage: jest.fn() };
    const foreignFrameWindow = { postMessage: jest.fn() };

    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: ownFrameWindow } as unknown as HTMLIFrameElement },
      { current: { requestId: null, jobId: null, abortController: null } },
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      source: foreignFrameWindow as unknown as MessageEventSource,
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 1,
        queryKey: 'foreign-source',
        query: { species_key: '99' },
      },
    } as MessageEvent<unknown>);

    expect(createPredictHeatmapJob).not.toHaveBeenCalled();
    cleanup();
  });

  it('ignores non-object incoming payloads', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      { current: { requestId: null, jobId: null, abortController: null } },
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({ data: 'heatmap-fetch' } as MessageEvent<unknown>);

    expect(createPredictHeatmapJob).not.toHaveBeenCalled();
    expect(iframePostMessage).not.toHaveBeenCalled();

    cleanup();
  });

  it('ignores fetch messages with missing or invalid query shape', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      { current: { requestId: null, jobId: null, abortController: null } },
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;

    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 1,
        queryKey: 'missing-query',
      },
    } as MessageEvent<unknown>);

    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 2,
        queryKey: 'missing-species-key',
        query: {
          resolution: '0.25',
        },
      },
    } as MessageEvent<unknown>);

    expect(createPredictHeatmapJob).not.toHaveBeenCalled();
    expect(iframePostMessage).not.toHaveBeenCalled();

    cleanup();
  });

  it('returns noop cleanup when window listeners are unavailable', () => {
    global.window = {
      addEventListener: undefined,
      removeEventListener: undefined,
    } as unknown as Window & typeof globalThis;

    const cleanup = setupWebHeatmapBridge(
      { current: null },
      { current: { requestId: null, jobId: null, abortController: null } },
    );

    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });

  it('streams cells and posts batched heatmap data from parent bridge', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const activeHeatmapJobRef: { current: ActiveHeatmapJob } = {
      current: { requestId: null, jobId: null, abortController: null },
    };

    (createPredictHeatmapJob as jest.Mock).mockResolvedValue({
      jobId: 'job-1',
      streamUrl: '/api/predict/heatmap-jobs/job-1/stream',
    });
    (streamPredictHeatmapJob as jest.Mock).mockImplementation(async (_jobId: string, options: any) => {
      options.onEvent({ type: 'meta', resolution: 0.2 });
      options.onEvent({ type: 'cell', lat: 1, lon: 2, score: 0.8, nNative: 3, source: 'sampled' });
    });
    (deletePredictHeatmapJob as jest.Mock).mockResolvedValue(undefined);

    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      activeHeatmapJobRef,
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 42,
        queryKey: 'qk',
        query: {
          species_key: '314',
          min_lat: '10',
          min_lon: '20',
          max_lat: '30',
          max_lon: '40',
          resolution: '0.25',
          include_source: 'true',
          feature_mode: 'auto',
          max_cells: '100',
        },
      },
    } as MessageEvent<unknown>);

    expect(createPredictHeatmapJob).toHaveBeenCalledWith(expect.objectContaining({
      speciesKey: '314',
      minLat: 10,
      maxLon: 40,
      maxCells: 100,
    }));
    expect(streamPredictHeatmapJob).toHaveBeenCalled();
    expect(iframePostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HEATMAP_DATA_MESSAGE_TYPE,
        requestId: 42,
        append: true,
      }),
      '*',
    );
    expect(activeHeatmapJobRef.current.jobId).toBeNull();

    cleanup();
  });

  it('includes sampled, cell_table, and unknown source counts in debug lines', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const activeHeatmapJobRef: { current: ActiveHeatmapJob } = {
      current: { requestId: null, jobId: null, abortController: null },
    };

    (createPredictHeatmapJob as jest.Mock).mockResolvedValue({
      jobId: 'job-source-counts',
      streamUrl: '/api/predict/heatmap-jobs/job-source-counts/stream',
    });
    (streamPredictHeatmapJob as jest.Mock).mockImplementation(async (_jobId: string, options: any) => {
      options.onEvent({ type: 'meta', resolution: 0.2 });
      options.onEvent({ type: 'cell', lat: 1, lon: 2, score: 0.8, nNative: 3, source: 'sampled' });
      options.onEvent({ type: 'cell', lat: 1.1, lon: 2.1, score: 0.7, nNative: 2, source: 'cell_table' });
      options.onEvent({ type: 'cell', lat: 1.2, lon: 2.2, score: 0.6, nNative: 1, source: 'mystery' });
    });
    (deletePredictHeatmapJob as jest.Mock).mockResolvedValue(undefined);

    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      activeHeatmapJobRef,
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 108,
        queryKey: 'qk-source-counts',
        query: {
          species_key: '314',
          min_lat: '10',
          min_lon: '20',
          max_lat: '30',
          max_lon: '40',
          resolution: '0.25',
          include_source: 'true',
          feature_mode: 'auto',
          max_cells: '100',
        },
      },
    } as MessageEvent<unknown>);

    expect(iframePostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HEATMAP_DATA_MESSAGE_TYPE,
        requestId: 108,
        debugLines: expect.arrayContaining([
          expect.stringContaining('source sampled/cell_table/other: 1 / 1 / 1'),
        ]),
      }),
      '*',
    );

    cleanup();
  });

  it('ignores stale stream events when active request id changes mid-stream', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const activeHeatmapJobRef: { current: ActiveHeatmapJob } = {
      current: { requestId: null, jobId: null, abortController: null },
    };

    (createPredictHeatmapJob as jest.Mock).mockResolvedValue({
      jobId: 'job-stale-request',
      streamUrl: '/api/predict/heatmap-jobs/job-stale-request/stream',
    });
    (streamPredictHeatmapJob as jest.Mock).mockImplementation(async (_jobId: string, options: any) => {
      activeHeatmapJobRef.current.requestId = 999;
      options.onEvent({ type: 'cell', lat: 5, lon: 6, score: 0.5, nNative: 1, source: 'sampled' });
    });
    (deletePredictHeatmapJob as jest.Mock).mockResolvedValue(undefined);

    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      activeHeatmapJobRef,
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 109,
        queryKey: 'qk-stale-request',
        query: {
          species_key: '22',
        },
      },
    } as MessageEvent<unknown>);

    expect(iframePostMessage).not.toHaveBeenCalled();
    expect(deletePredictHeatmapJob).not.toHaveBeenCalledWith('job-stale-request');

    cleanup();
  });

  it('does not post data when stream returns no cell events', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const activeHeatmapJobRef: { current: ActiveHeatmapJob } = {
      current: { requestId: null, jobId: null, abortController: null },
    };

    (createPredictHeatmapJob as jest.Mock).mockResolvedValue({
      jobId: 'job-meta-only',
      streamUrl: '/api/predict/heatmap-jobs/job-meta-only/stream',
    });
    (streamPredictHeatmapJob as jest.Mock).mockImplementation(async (_jobId: string, options: any) => {
      options.onEvent({ type: 'meta', resolution: 0.15 });
    });
    (deletePredictHeatmapJob as jest.Mock).mockResolvedValue(undefined);

    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      activeHeatmapJobRef,
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 110,
        queryKey: 'qk-meta-only',
        query: {
          species_key: '45',
          resolution: '0.2',
        },
      },
    } as MessageEvent<unknown>);

    expect(iframePostMessage).not.toHaveBeenCalled();
    expect(deletePredictHeatmapJob).toHaveBeenCalledWith('job-meta-only');

    cleanup();
  });

  it('cancels any active job before starting a new heatmap request', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const previousController = new AbortController();
    const activeHeatmapJobRef: { current: ActiveHeatmapJob } = {
      current: { requestId: 1, jobId: 'old-job', abortController: previousController },
    };

    (createPredictHeatmapJob as jest.Mock).mockResolvedValue({
      jobId: 'new-job',
      streamUrl: '/api/predict/heatmap-jobs/new-job/stream',
    });
    (streamPredictHeatmapJob as jest.Mock).mockImplementation(async () => {});
    (deletePredictHeatmapJob as jest.Mock).mockResolvedValue(undefined);

    const cleanup = setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      activeHeatmapJobRef,
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 111,
        queryKey: 'qk-cancel-active',
        query: {
          species_key: '99',
        },
      },
    } as MessageEvent<unknown>);

    expect(previousController.signal.aborted).toBe(true);
    expect(deletePredictHeatmapJob).toHaveBeenCalledWith('old-job');
    expect(deletePredictHeatmapJob).toHaveBeenCalledWith('new-job');

    cleanup();
  });

  it('posts heatmap error when streaming fails and request is not aborted', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const activeHeatmapJobRef: { current: ActiveHeatmapJob } = {
      current: { requestId: null, jobId: null, abortController: null },
    };

    (createPredictHeatmapJob as jest.Mock).mockResolvedValue({
      jobId: 'job-2',
      streamUrl: '/api/predict/heatmap-jobs/job-2/stream',
    });
    (streamPredictHeatmapJob as jest.Mock).mockRejectedValue(new Error('stream failed'));

    setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      activeHeatmapJobRef,
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 7,
        queryKey: 'qk-err',
        query: { species_key: '11' },
      },
    } as MessageEvent<unknown>);

    expect(iframePostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HEATMAP_ERROR_MESSAGE_TYPE,
        requestId: 7,
      }),
      '*',
    );
  });

  it('suppresses error post when request was aborted', async () => {
    const addEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener: jest.fn(),
    } as unknown as Window & typeof globalThis;

    const iframePostMessage = jest.fn();
    const activeHeatmapJobRef: { current: ActiveHeatmapJob } = {
      current: { requestId: null, jobId: null, abortController: null },
    };

    (createPredictHeatmapJob as jest.Mock).mockResolvedValue({
      jobId: 'job-3',
      streamUrl: '/api/predict/heatmap-jobs/job-3/stream',
    });
    (streamPredictHeatmapJob as jest.Mock).mockImplementation(async () => {
      activeHeatmapJobRef.current.abortController?.abort();
      throw new Error('aborted');
    });

    setupWebHeatmapBridge(
      { current: { contentWindow: { postMessage: iframePostMessage } } as unknown as HTMLIFrameElement },
      activeHeatmapJobRef,
    );

    const handler = addEventListener.mock.calls[0]?.[1] as (event: MessageEvent<unknown>) => Promise<void>;
    await handler({
      data: {
        type: HEATMAP_FETCH_MESSAGE_TYPE,
        requestId: 8,
        queryKey: 'qk-abort',
        query: { species_key: '12' },
      },
    } as MessageEvent<unknown>);

    expect(iframePostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: HEATMAP_ERROR_MESSAGE_TYPE }),
      '*',
    );
  });

  it('cleanup removes listener and cancels active job', async () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    global.window = {
      addEventListener,
      removeEventListener,
    } as unknown as Window & typeof globalThis;

    const controller = new AbortController();
    const activeHeatmapJobRef = {
      current: {
        requestId: 9,
        jobId: 'job-cleanup',
        abortController: controller,
      },
    };
    (deletePredictHeatmapJob as jest.Mock).mockResolvedValue(undefined);

    const cleanup = setupWebHeatmapBridge(
      { current: null },
      activeHeatmapJobRef,
    );

    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(controller.signal.aborted).toBe(true);
    expect(deletePredictHeatmapJob).toHaveBeenCalledWith('job-cleanup');
  });
});
