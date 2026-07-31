// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { Asset } from 'expo-asset';
import {
  buildGlobeHtml,
  buildLeafletHtml,
  computePointStyleUpdates,
  getMapTileUrlTemplate,
  HIGHLIGHT_MESSAGE_TYPE,
  isOpenExternalUrlEventFromFrame,
  isOpenExternalUrlMessage,
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
  OPEN_EXTERNAL_URL_MESSAGE_TYPE,
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
  const validTemplateHtml =
    '<html><body><div id="map"></div><script>__POINTS_JSON__</script></body></html>';

  const markerPalette = {
    markerFill: '#111111',
    markerStroke: '#222222',
    highlightFill: '#333333',
    highlightStroke: '#444444',
    selectedPointFill: '#F59E0B',
    selectedPointStroke: '#F59E0B',
    surfaceBackground: '#ffffff',
    surfaceBorder: '#c8c8c8',
    surfaceText: '#181818',
    linkColor: '#466237',
  };

  // The template now also inlines vendored Leaflet/MarkerCluster libraries as
  // earlier <script> blocks (so the map works fully offline), so the map's
  // own logic is always the *last* inline script block, not the first.
  const extractInlineScript = (html: string) => {
    const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
    const last = matches[matches.length - 1]?.[1];
    if (!last) {
      throw new Error('Expected inline map script in template');
    }
    return last;
  };

  type MockLeafletMarker = {
    coords: [number, number];
    style: Record<string, unknown>;
    addTo: jest.Mock<MockLeafletMarker, []>;
    setStyle: jest.Mock<void, [Record<string, unknown>]>;
    setLatLng: jest.Mock;
    bindPopup: jest.Mock;
    openPopup: jest.Mock;
    isPopupOpen: jest.Mock;
    getPopup: jest.Mock;
    on: jest.Mock;
  };

  const createLeafletHarness = () => {
    const eventHandlers = new Map<string, (event?: unknown) => void>();
    const tileLayerEventHandlers = new Map<string, (event?: unknown) => void>();
    const documentListeners = new Map<
      string,
      (event: { data: unknown }) => void
    >();
    const windowListeners = new Map<
      string,
      (event: { data: unknown }) => void
    >();
    const createdMarkers: {
      style: Record<string, unknown>;
      setStyle: jest.Mock;
      setLatLng: jest.Mock;
      bindPopup: jest.Mock;
      on: jest.Mock;
    }[] = [];
    let visibleLongitudePredicate = (_longitude: number) => false;
    const blobUrlMap = new Map<object, string>();
    let blobUrlCounter = 0;
    const popup = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
    };

    const makeLayer = () => ({
      addTo: jest.fn().mockReturnThis(),
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    });

    const makeTileLayer = (url = '') => ({
      _url: url,
      addTo: jest.fn().mockReturnThis(),
      createTile: jest.fn(() => ({ referrerPolicy: '' })),
      on: jest.fn((eventName: string, handler: () => void) => {
        tileLayerEventHandlers.set(eventName, handler);
      }),
      getTileUrl(coords: { z: number; x: number; y: number }) {
        return this._url
          .replace('{z}', String(coords.z))
          .replace('{x}', String(coords.x))
          .replace('{y}', String(coords.y));
      },
    });

    const panes = new Map<string, { style: Record<string, unknown> }>();
    let mockZoom = 8;
    // Real add/remove tracking (not a dumb stub) so tests can assert on
    // whether a specific layer instance (e.g. the offline canvas layer) is
    // actually attached to the map at a given point, not just that the
    // methods were called.
    const layersOnMap = new Set<unknown>();
    const map = {
      createPane: jest.fn((name: string) => {
        const pane = { style: {} as Record<string, unknown> };
        panes.set(name, pane);
        return pane;
      }),
      getPane: jest.fn((name: string) => panes.get(name)),
      on: jest.fn((eventName: string, handler: () => void) => {
        const existing = eventHandlers.get(eventName);
        if (existing) {
          eventHandlers.set(eventName, () => {
            existing();
            handler();
          });
        } else {
          eventHandlers.set(eventName, handler);
        }
      }),
      setMinZoom: jest.fn(),
      getSize: jest.fn(() => ({ x: 256 })),
      getBounds: jest.fn(() => {
        const bounds: Record<string, unknown> = {
          contains: ({ lng }: { lng: number }) =>
            visibleLongitudePredicate(lng),
          getWest: jest.fn(() => -180),
          getSouth: jest.fn(() => -90),
          getEast: jest.fn(() => 180),
          getNorth: jest.fn(() => 90),
        };
        bounds.pad = jest.fn(() => bounds);
        return bounds;
      }),
      getZoom: jest.fn(() => mockZoom),
      getCenter: jest.fn(() => ({ lng: 0 })),
      removeLayer: jest.fn((layer: unknown) => {
        layersOnMap.delete(layer);
      }),
      addLayer: jest.fn((layer: unknown) => {
        layersOnMap.add(layer);
      }),
      hasLayer: jest.fn((layer: unknown) => layersOnMap.has(layer)),
      getContainer: jest.fn(() => ({ style: {} as Record<string, unknown> })),
      whenReady: jest.fn((callback: () => void) => callback()),
      latLngToContainerPoint: jest.fn(
        ({ lat, lng }: { lat: number; lng: number }) => ({
          x: lng,
          y: lat,
        }),
      ),
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      addControl: jest.fn(),
      locate: jest.fn(),
    };

    const createTileElement = () => {
      const tile: Record<string, unknown> = {
        referrerPolicy: '',
        alt: '',
        onload: null,
        onerror: null,
        setAttribute: jest.fn(),
      };
      Object.defineProperty(tile, 'src', {
        configurable: true,
        enumerable: true,
        get() {
          return tile.__src;
        },
        set(value) {
          tile.__src = value;
          Promise.resolve().then(() => {
            if (typeof tile.onload === 'function') {
              tile.onload();
            }
          });
        },
      });
      return tile;
    };

    // Records what the canvas offline-fallback layer actually draws, so
    // tests can assert on real fill/stroke calls rather than just "didn't
    // throw". A real (if minimal) Path2D so moveTo/lineTo/closePath calls
    // are inspectable too.
    class MockPath2D {
      commands: { cmd: string; x?: number; y?: number }[] = [];
      moveTo(x: number, y: number) {
        this.commands.push({ cmd: 'moveTo', x, y });
      }
      lineTo(x: number, y: number) {
        this.commands.push({ cmd: 'lineTo', x, y });
      }
      closePath() {
        this.commands.push({ cmd: 'closePath' });
      }
    }
    const canvasDrawCalls: {
      type: 'fill' | 'stroke';
      style: unknown;
      path: MockPath2D;
    }[] = [];
    const createMockCanvas = () => {
      const state = { width: 0, height: 0 };
      const ctx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineJoin: '',
        lineCap: '',
        globalAlpha: 1,
        scale: jest.fn(),
        setLineDash: jest.fn(),
        fill: jest.fn((path: MockPath2D) => {
          canvasDrawCalls.push({ type: 'fill', style: ctx.fillStyle, path });
        }),
        stroke: jest.fn((path: MockPath2D) => {
          canvasDrawCalls.push({
            type: 'stroke',
            style: ctx.strokeStyle,
            path,
          });
        }),
      };
      return {
        get width() {
          return state.width;
        },
        set width(v: number) {
          state.width = v;
        },
        get height() {
          return state.height;
        },
        set height(v: number) {
          state.height = v;
        },
        getContext: jest.fn(() => ctx),
      };
    };
    const createdCanvasTiles: ReturnType<typeof createMockCanvas>[] = [];
    const gridLayerInstances: { options: Record<string, unknown> }[] = [];

    const L = {
      latLngBounds: jest.fn(() => ({})),
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      map: jest.fn(() => map),
      tileLayer: jest.fn((url: string) => makeTileLayer(url)),
      circleMarker: jest.fn(
        (coords: [number, number], style: Record<string, unknown>) => {
          const marker: MockLeafletMarker = {
            coords,
            style: { ...style },
            addTo: jest.fn(() => marker),
            setStyle: jest.fn((nextStyle: Record<string, unknown>) => {
              marker.style = { ...nextStyle };
            }),
            setLatLng: jest.fn(),
            bindPopup: jest.fn(),
            openPopup: jest.fn(),
            isPopupOpen: jest.fn(() => false),
            getPopup: jest.fn(() => ({ setContent: jest.fn() })),
            on: jest.fn(),
          };
          createdMarkers.push(marker);
          return marker;
        },
      ),
      circle: jest.fn(() => ({ addTo: jest.fn() })),
      geoJSON: jest.fn(() => ({ addTo: jest.fn() })),
      marker: jest.fn((latlng: unknown, options: Record<string, unknown>) => {
        const markerObj: {
          latlng: unknown;
          options: unknown;
          addTo: jest.Mock;
        } = {
          latlng,
          options,
          addTo: jest.fn((m: typeof map) => {
            m.addLayer(markerObj);
            return markerObj;
          }),
        };
        return markerObj;
      }),
      divIcon: jest.fn((opts: Record<string, unknown>) => opts),
      GridLayer: {
        extend: jest.fn((proto: Record<string, unknown>) => {
          function GridLayerCtor(
            this: Record<string, unknown>,
            options: Record<string, unknown>,
          ) {
            this.options = options;
            Object.assign(this, proto);
            gridLayerInstances.push(
              this as { options: Record<string, unknown> },
            );
          }
          GridLayerCtor.prototype.addTo = function (
            this: Record<string, unknown>,
            m: typeof map,
          ) {
            m.addLayer(this);
            return this;
          };
          GridLayerCtor.prototype.getTileSize = function () {
            const size =
              (this as { options?: { tileSize?: number } }).options?.tileSize ??
              256;
            return { x: size, y: size };
          };
          return GridLayerCtor as unknown as new (
            options: Record<string, unknown>,
          ) => Record<string, unknown>;
        }),
      },
      popup: jest.fn(() => popup),
      markerClusterGroup: jest.fn(() => makeLayer()),
      layerGroup: jest.fn(() => makeLayer()),
      SVG: {
        prototype: {
          _updateCircle: jest.fn(),
        },
      },
      Control: {
        extend: jest.fn(() => {
          const Ctrl = function () {};
          Ctrl.prototype.addTo = jest.fn();
          return Ctrl;
        }),
      },
      control: {
        attribution: jest.fn(() => ({ addTo: jest.fn() })),
      },
      DomUtil: {
        create: jest.fn((tagName: string) => {
          if (tagName === 'canvas') {
            const canvas = createMockCanvas();
            createdCanvasTiles.push(canvas);
            return canvas;
          }
          return {
            style: {},
            addEventListener: jest.fn(),
          };
        }),
      },
      DomEvent: {
        disableClickPropagation: jest.fn(),
        on: jest.fn(),
      },
    };

    const document = {
      addEventListener: jest.fn(
        (eventName: string, handler: (event: { data: unknown }) => void) => {
          documentListeners.set(eventName, handler);
        },
      ),
      createElement: jest.fn((tagName: string) => {
        if (tagName === 'img') {
          return createTileElement();
        }
        return {};
      }),
      head: { appendChild: jest.fn() },
      // Absent (not stubbed with requestFullscreen) on purpose: exercises the
      // same feature-detection path a real Fullscreen-API-less WebView takes.
      documentElement: {},
    };

    const urlApi = {
      createObjectURL: jest.fn((blob: object) => {
        const next = `blob:mock-${blobUrlCounter++}`;
        blobUrlMap.set(blob, next);
        return next;
      }),
      revokeObjectURL: jest.fn(),
    };

    const windowObject = {
      addEventListener: jest.fn(
        (eventName: string, handler: (event: { data: unknown }) => void) => {
          windowListeners.set(eventName, handler);
        },
      ),
      location: { origin: 'http://localhost' },
      parent: {
        postMessage: jest.fn(),
      },
    };

    const HTMLElement = { prototype: { focus: jest.fn() } };

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
        URL: urlApi,
        HTMLElement,
        Path2D: MockPath2D,
        fetch: undefined as
          | ((
              input: string,
              init?: { signal?: AbortSignal; referrerPolicy?: string },
            ) => Promise<unknown>)
          | undefined,
        AbortController: undefined as typeof AbortController | undefined,
      },
      createdMarkers,
      eventHandlers,
      tileLayerEventHandlers,
      documentListeners,
      popup,
      windowListeners,
      urlApi,
      canvasDrawCalls,
      createdCanvasTiles,
      gridLayerInstances,
      L,
      map,
      setZoom(zoom: number) {
        mockZoom = zoom;
      },
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
      '__DOCUMENT_BASE_URL__|__REFERRER_POLICY__|__REFERRER_POLICY_JSON__|__TILE_URL_JSON__|__TILE_ATTRIBUTION_JSON__|__TILE_MAX_ZOOM__|__MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS__|__POINTS_JSON__|__PALETTE_JSON__|__HIGHLIGHT_MESSAGE_TYPE_JSON__|__OPEN_EXTERNAL_URL_MESSAGE_TYPE_JSON__|__SELECTED_POINT_MESSAGE_TYPE_JSON__',
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
    expect(html).toContain(JSON.stringify(OPEN_EXTERNAL_URL_MESSAGE_TYPE));
    expect(html).toContain(JSON.stringify(SELECTED_POINT_MESSAGE_TYPE));
    expect(html).not.toContain('__POINTS_JSON__');
  });

  it('buildGlobeHtml forwards tileMode and enableOfflineFallback like buildLeafletHtml', () => {
    // buildGlobeHtml used to destructure only the first 34 of
    // fillMapTemplatePlaceholders' ~36 positional params, silently dropping
    // tileMode and enableOfflineFallback — this pins that both now reach the
    // template.
    const html = buildGlobeHtml(
      '__MAP_TILE_MODE_JSON__|__ENABLE_OFFLINE_FALLBACK__',
      [],
      markerPalette,
      getMapTileUrlTemplate('light'),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'dark',
      true,
    );

    expect(html).toContain(JSON.stringify('dark'));
    expect(html).toContain('true');
    expect(html).not.toContain('__MAP_TILE_MODE_JSON__');
    expect(html).not.toContain('__ENABLE_OFFLINE_FALLBACK__');
  });

  it('prepares popup-safe catalog fields before injecting map points', () => {
    const html = buildLeafletHtml(
      '__POINTS_JSON__',
      [
        {
          catalogNumber: 'abc" onclick="alert(1)<tag>',
          latitude: 1,
          longitude: 2,
        },
      ],
      markerPalette,
      getMapTileUrlTemplate('light'),
    );

    expect(html).toContain('popupCatalogHref');
    expect(html).toContain('abc%22%20onclick%3D%22alert(1)%3Ctag%3E');
    expect(html).toContain('popupCatalogValue');
    expect(html).toContain('abc\\" onclick=\\"alert(1)<tag>');
    expect(html).toContain('popupCatalogLabel');
    expect(html).toContain('abc&quot; onclick=&quot;alert(1)&lt;tag&gt;');
  });

  it('renders pin actions without inline JavaScript handlers', () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');
      const html = buildLeafletHtml(
        rawTemplate,
        [
          {
            catalogNumber: 'abc" onclick="alert(1)',
            latitude: 1,
            longitude: 2,
          },
        ],
        markerPalette,
        getMapTileUrlTemplate('light'),
      );

      expect(html).toContain('data-open-external-url="true"');
      expect(html).toContain('data-pin-observation="true"');
      expect(html).toContain('popupCatalogValue":"abc\\" onclick=\\"alert(1)"');
      expect(html).toContain(
        'popupCatalogHref":"abc%22%20onclick%3D%22alert(1)"',
      );
      expect(html).not.toContain('onclick="sendPinMessage');
    });
  });

  it('omits external observation links when observation linking is disabled', () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');

      const linkedHtml = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'obs-123', latitude: 1, longitude: 2 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
      );
      const linkedHarness = createLeafletHarness();
      vm.runInNewContext(
        extractInlineScript(linkedHtml),
        linkedHarness.context,
      );
      const linkedPopup =
        linkedHarness.createdMarkers[0]?.bindPopup.mock.calls[0]?.[0];

      const unlinkedHtml = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'obs-123', latitude: 1, longitude: 2 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
      );
      const unlinkedHarness = createLeafletHarness();
      vm.runInNewContext(
        extractInlineScript(unlinkedHtml),
        unlinkedHarness.context,
      );
      const unlinkedPopup =
        unlinkedHarness.createdMarkers[0]?.bindPopup.mock.calls[0]?.[0];

      expect(linkedPopup).toContain(
        'https://www.inaturalist.org/observations/obs-123',
      );
      expect(linkedPopup).not.toContain('Highlight in Environmental Features');
      expect(unlinkedPopup ?? '').not.toContain(
        'https://www.inaturalist.org/observations/obs-123',
      );
    });
  });

  it('omits pin buttons when pinning observations is disabled', () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');

      const enabledHtml = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'obs-123', latitude: 1, longitude: 2 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
      );
      const enabledHarness = createLeafletHarness();
      vm.runInNewContext(
        extractInlineScript(enabledHtml),
        enabledHarness.context,
      );
      const enabledPopup =
        enabledHarness.createdMarkers[0]?.bindPopup.mock.calls[0]?.[0];

      const disabledHtml = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'obs-123', latitude: 1, longitude: 2 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
      );
      const disabledHarness = createLeafletHarness();
      vm.runInNewContext(
        extractInlineScript(disabledHtml),
        disabledHarness.context,
      );
      const disabledPopup =
        disabledHarness.createdMarkers[0]?.bindPopup.mock.calls[0]?.[0];

      // Pin is now auto-fired via click handler — no button in popup
      expect(enabledPopup).not.toContain('Highlight in Environmental Features');
      expect(enabledPopup).not.toContain('data-pin-observation="true"');
      // Marker has a click handler registered for auto-pin
      expect(enabledHarness.createdMarkers[0]?.on).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
      expect(disabledPopup).not.toContain(
        'Highlight in Environmental Features',
      );
      expect(disabledPopup).not.toContain('data-pin-observation="true"');
    });
  });

  it('does not open a map-click popup when pinning observations is disabled', () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');
      const html = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'obs-123', latitude: 40, longitude: -111 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
        null,
        undefined,
        undefined,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
      );
      const harness = createLeafletHarness();

      vm.runInNewContext(extractInlineScript(html), harness.context);

      harness.eventHandlers.get('click')?.({
        latlng: { lat: 40, lng: -111 },
      } as unknown as { latlng: { lat: number; lng: number } });

      expect(harness.popup.openOn).not.toHaveBeenCalled();
    });
  });

  it('omits external observation links when observation linking is disabled', () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
    ];

    templatePaths.forEach((templatePath) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');

      const linkedHtml = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'obs-123', latitude: 1, longitude: 2 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
      );
      const linkedHarness = createLeafletHarness();
      vm.runInNewContext(
        extractInlineScript(linkedHtml),
        linkedHarness.context,
      );
      const linkedPopup =
        linkedHarness.createdMarkers[0]?.bindPopup.mock.calls[0]?.[0];

      const unlinkedHtml = buildLeafletHtml(
        rawTemplate,
        [{ catalogNumber: 'obs-123', latitude: 1, longitude: 2 }],
        markerPalette,
        getMapTileUrlTemplate('light'),
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
      );
      const unlinkedHarness = createLeafletHarness();
      vm.runInNewContext(
        extractInlineScript(unlinkedHtml),
        unlinkedHarness.context,
      );
      const unlinkedPopup =
        unlinkedHarness.createdMarkers[0]?.bindPopup.mock.calls[0]?.[0];

      expect(linkedPopup).toContain(
        'https://www.inaturalist.org/observations/obs-123',
      );
      expect(linkedPopup).not.toContain('Highlight in Environmental Features');
      expect(unlinkedPopup ?? '').not.toContain(
        'https://www.inaturalist.org/observations/obs-123',
      );
    });
  });

  it('keeps clustered highlight state when zooming into direct markers', () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
    ];

    const expectedHighlightStyles: Record<
      string,
      { fillColor: string; color: string }
    > = {
      'SpeciesOccurrenceMap.html': {
        fillColor: markerPalette.markerFill,
        color: markerPalette.markerStroke,
      },
      'SpeciesOccurrenceMapFallback.html': {
        fillColor: '#ffffff',
        color: 'rgba(0,0,0,0.65)',
      },
    };

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
      ).replace(
        `MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS = ${MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS}`,
        'MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS = 1',
      );
      const harness = createLeafletHarness();
      harness.setVisibleLongitudePredicate(() => true);

      vm.runInNewContext(extractInlineScript(html), harness.context);

      expect(harness.createdMarkers).toHaveLength(2);

      harness.windowListeners.get('message')?.({
        data: toHighlightMessagePayload(['101']),
      });

      harness.setVisibleLongitudePredicate((longitude) => longitude === 20);
      harness.eventHandlers.get('zoomend')?.();

      const templateName = path.basename(templatePath);
      const expectedStyle = expectedHighlightStyles[templateName];
      expect(harness.createdMarkers).toHaveLength(3);
      expect(harness.createdMarkers[2]?.style).toMatchObject({
        ...expectedStyle,
        radius: 4,
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
    expect(
      toSelectedPointMessagePayload({ latitude: 40, longitude: -111 }),
    ).toEqual({
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
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
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
        fillColor: 'transparent',
        color: markerPalette.selectedPointStroke,
        radius: 4,
      });

      harness.windowListeners.get('message')?.({
        data: toSelectedPointMessagePayload(null),
      });

      expect(harness.context.L.map).toHaveBeenCalled();
      expect(
        (harness.context.L.map as jest.Mock).mock.results[0]?.value.removeLayer,
      ).toHaveBeenCalled();
    });
  });

  it('hides the matching clustered observation marker while selected and restores it when cleared', () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
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
      ).replace(
        `MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS = ${MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS}`,
        'MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS = 1',
      );
      const harness = createLeafletHarness();

      vm.runInNewContext(extractInlineScript(html), harness.context);

      expect(harness.createdMarkers).toHaveLength(2);

      const targetClusterMarker = harness.createdMarkers[0];
      const clusterGroup = (harness.context.L.markerClusterGroup as jest.Mock)
        .mock.results[0]?.value;

      expect(clusterGroup).toBeTruthy();

      harness.windowListeners.get('message')?.({
        data: toSelectedPointMessagePayload({ latitude: 10, longitude: 20 }),
      });

      expect(harness.createdMarkers).toHaveLength(3);
      expect(clusterGroup.removeLayer).toHaveBeenCalledWith(
        targetClusterMarker,
      );

      harness.windowListeners.get('message')?.({
        data: toSelectedPointMessagePayload(null),
      });

      expect(clusterGroup.addLayer).toHaveBeenCalledWith(targetClusterMarker);
    });
  });

  it('aborts heatmap tile fetches when Leaflet unloads the tile', async () => {
    const templatePaths = [
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMap.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapOffline.html',
      ),
      path.join(
        __dirname,
        '..',
        'speciesOccurrenceMap',
        'SpeciesOccurrenceMapFallback.html',
      ),
    ];

    await Promise.all(
      templatePaths.map(async (templatePath) => {
        const rawTemplate = fs.readFileSync(templatePath, 'utf8');
        const html = buildLeafletHtml(
          rawTemplate,
          [{ catalogNumber: 101, latitude: 10, longitude: 20 }],
          markerPalette,
          getMapTileUrlTemplate('light'),
          'https://example.test/tiles/{z}/{x}/{y}.png',
        );
        const harness = createLeafletHarness();
        const fetchPromise = new Promise<never>(() => {});
        const fetchMock = jest.fn(
          (_url: string, options?: { signal?: AbortSignal }) => {
            options?.signal?.addEventListener('abort', () => undefined);
            return fetchPromise;
          },
        );

        harness.context.fetch = fetchMock;
        harness.context.AbortController = AbortController;

        vm.runInNewContext(extractInlineScript(html), harness.context);

        const heatmapLayer = (harness.context.L.tileLayer as jest.Mock).mock
          .results[1]?.value;
        expect(heatmapLayer).toBeTruthy();

        const done = jest.fn();
        const tile = heatmapLayer.createTile({ z: 3, x: 4, y: 5 }, done);
        expect(fetchMock).toHaveBeenCalledWith(
          'https://example.test/tiles/3/4/5.png',
          expect.objectContaining({ referrerPolicy: MAP_REFERRER_POLICY }),
        );

        const fetchOptions = fetchMock.mock.calls[0]?.[1] as
          | { signal?: AbortSignal }
          | undefined;
        expect(fetchOptions?.signal?.aborted).toBe(false);

        heatmapLayer.on.mock.calls.find(
          (call: unknown[]) => call[0] === 'tileunload',
        )?.[1]?.({ tile });

        expect(fetchOptions?.signal?.aborted).toBe(true);
        expect(done).not.toHaveBeenCalled();
      }),
    );
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

  it('accepts only well-formed open external url messages', () => {
    expect(
      isOpenExternalUrlMessage({
        type: OPEN_EXTERNAL_URL_MESSAGE_TYPE,
        url: 'https://www.inaturalist.org/observations/123',
      }),
    ).toBe(true);

    expect(
      isOpenExternalUrlMessage({
        type: OPEN_EXTERNAL_URL_MESSAGE_TYPE,
      }),
    ).toBe(false);

    expect(
      isOpenExternalUrlMessage({
        type: OPEN_EXTERNAL_URL_MESSAGE_TYPE,
        url: 123,
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

  it('only trusts open external url messages from the active iframe window', () => {
    const frameWindow = {} as Window;
    const otherWindow = {} as Window;
    const validEvent = {
      source: frameWindow,
      data: {
        type: OPEN_EXTERNAL_URL_MESSAGE_TYPE,
        url: 'https://www.inaturalist.org/observations/123',
      },
    } as Pick<MessageEvent, 'data' | 'source'>;

    expect(isOpenExternalUrlEventFromFrame(validEvent, frameWindow)).toBe(true);
    expect(isOpenExternalUrlEventFromFrame(validEvent, otherWindow)).toBe(
      false,
    );
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
    expect(global.fetch).toHaveBeenCalledWith(
      'mock://SpeciesOccurrenceMap.html',
    );
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
      text: jest
        .fn()
        .mockResolvedValue('<html><body><h1>App Shell</h1></body></html>'),
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
    expect(global.fetch).toHaveBeenCalledWith(
      'mock://SpeciesOccurrenceMapFallback.html',
    );
  });

  it('assigns cardinal shapes to points when circularShapesEnabled is true', () => {
    const observationValues = new Map([
      ['10', 0],
      ['20', 90],
      ['30', 180],
      ['40', 270],
    ]);
    const html = buildLeafletHtml(
      '__POINTS_JSON__',
      [
        { catalogNumber: 10, latitude: 1, longitude: 10 },
        { catalogNumber: 20, latitude: 2, longitude: 20 },
        { catalogNumber: 30, latitude: 3, longitude: 30 },
        { catalogNumber: 40, latitude: 4, longitude: 40 },
      ],
      markerPalette,
      getMapTileUrlTemplate('light'),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      observationValues,
      null,
      null,
      null,
      null,
      false,
      null,
      null,
      null,
      null,
      false,
      true,
    );
    expect(html).toContain('varShape');
  });

  describe('computePointStyleUpdates', () => {
    it('computes per-catalog varValue/varColor/varLabel/varShape for a live variable switch', () => {
      const points = [
        { catalogNumber: 10, latitude: 1, longitude: 10 },
        { catalogNumber: 20, latitude: 2, longitude: 20 },
        { catalogNumber: 'no-value', latitude: 3, longitude: 30 },
      ];
      const observationValues = new Map([
        ['10', 1],
        ['20', 2],
      ]);
      const classColors = new Map([
        ['1', '#111111'],
        ['2', '#222222'],
      ]);
      const classLabels = new Map([
        ['1', 'Forest'],
        ['2', 'Water'],
      ]);

      const updates = computePointStyleUpdates(
        points,
        observationValues,
        classColors,
        classLabels,
        null,
        false,
      );

      expect(updates).toEqual([
        {
          catalog: '10',
          varValue: 1,
          varColor: '#111111',
          varLabel: 'Forest',
          varShape: null,
        },
        {
          catalog: '20',
          varValue: 2,
          varColor: '#222222',
          varLabel: 'Water',
          varShape: null,
        },
        {
          catalog: 'no-value',
          varValue: null,
          varColor: null,
          varLabel: null,
          varShape: null,
        },
      ]);
    });

    it('omits points with no resolvable catalog number', () => {
      const updates = computePointStyleUpdates(
        [{ latitude: 1, longitude: 1 }],
        null,
        null,
        null,
        null,
        false,
      );
      expect(updates).toEqual([]);
    });

    it('assigns cardinal shapes for circular variables the same way preparePointsForMapHtml does', () => {
      const points = [{ catalogNumber: 5, latitude: 1, longitude: 1 }];
      const observationValues = new Map([['5', 90]]);

      const updates = computePointStyleUpdates(
        points,
        observationValues,
        null,
        null,
        null,
        true,
      );

      expect(updates).toEqual([
        {
          catalog: '5',
          varValue: 90,
          varColor: null,
          varLabel: null,
          varShape: 'arrow',
        },
      ]);
    });
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
    expect(MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS).toBe(20000);
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

    const isolatedHelpers = jest.requireActual(
      '../speciesOccurrenceMap/speciesOccurrenceMapHelpers',
    ) as typeof import('../speciesOccurrenceMap/speciesOccurrenceMapHelpers');

    expect(isolatedHelpers.MAP_TILE_API_KEY).toBeNull();
    expect(isolatedHelpers.getMapTileUrlTemplate('light')).toBe(
      MAP_TILE_URL_TEMPLATE_LIGHT,
    );

    jest.dontMock('expo-constants');
    jest.resetModules();
  });

  describe('offline Natural Earth fallback layer', () => {
    // The offline vector basemap/label data (and the code that renders it)
    // was split out of SpeciesOccurrenceMap.html into its own asset so every
    // other Leaflet map (species pages, maps page) doesn't pay for ~26MB of
    // template it never uses — SpeciesOccurrenceMapOffline.html is the one
    // actually loaded when enableOfflineFallback is true (upload page only).
    const templatePath = path.join(
      __dirname,
      '..',
      'speciesOccurrenceMap',
      'SpeciesOccurrenceMapOffline.html',
    );

    // enableOfflineFallback is the last of buildLeafletHtml's ~30 positional
    // params — everything between tileUrlTemplate and tileMode is left at
    // its default via `undefined`.
    const buildOfflineFallbackHtml = (
      enableOfflineFallback: boolean | undefined,
    ) => {
      const rawTemplate = fs.readFileSync(templatePath, 'utf8');
      return buildLeafletHtml(
        rawTemplate,
        [],
        markerPalette,
        getMapTileUrlTemplate('light'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'light',
        enableOfflineFallback,
      );
    };

    it('does not touch the canvas/label machinery at all when disabled (default)', () => {
      const html = buildOfflineFallbackHtml(undefined);
      const harness = createLeafletHarness();
      harness.setVisibleLongitudePredicate(() => true);
      vm.runInNewContext(extractInlineScript(html), harness.context);

      expect(harness.L.GridLayer.extend).not.toHaveBeenCalled();
      expect(harness.L.marker).not.toHaveBeenCalled();
      expect(harness.gridLayerInstances).toHaveLength(0);
    });

    it('builds a canvas GridLayer and attaches it to the map by default when enabled', () => {
      const html = buildOfflineFallbackHtml(true);
      const harness = createLeafletHarness();
      harness.setVisibleLongitudePredicate(() => true);
      vm.runInNewContext(extractInlineScript(html), harness.context);

      expect(harness.L.GridLayer.extend).toHaveBeenCalledTimes(1);
      const proto = harness.L.GridLayer.extend.mock.calls[0]?.[0] as {
        createTile: unknown;
      };
      expect(typeof proto.createTile).toBe('function');
      expect(harness.gridLayerInstances).toHaveLength(1);
      // Shown by default until tiles are confirmed loading (see the
      // separate online/offline gating test below) — matches the
      // "default to offline until proven otherwise" design.
      expect(harness.map.hasLayer(harness.gridLayerInstances[0])).toBe(true);
    });

    it('createTile culls by tile bbox — a single quadrant draws no more than the whole world', () => {
      const html = buildOfflineFallbackHtml(true);
      const harness = createLeafletHarness();
      harness.setVisibleLongitudePredicate(() => true);
      vm.runInNewContext(extractInlineScript(html), harness.context);

      const layer = harness.gridLayerInstances[0] as unknown as {
        createTile: (coords: { x: number; y: number; z: number }) => unknown;
        getTileSize: () => { x: number; y: number };
      };

      const wholeWorldTile = layer.createTile({ x: 0, y: 0, z: 0 });
      const wholeWorldDrawCount = harness.canvasDrawCalls.length;
      // The whole world in one tile is guaranteed to intersect real land
      // data (country boundaries alone span the globe), so something must
      // have been drawn — this would fail loudly if bbox culling were
      // broken in the "never draws anything" direction.
      expect(wholeWorldDrawCount).toBeGreaterThan(0);
      expect(wholeWorldTile).toBeTruthy();

      harness.canvasDrawCalls.length = 0;
      layer.createTile({ x: 0, y: 0, z: 1 });
      const quadrantDrawCount = harness.canvasDrawCalls.length;

      // A single quarter-of-the-world tile can never legitimately need
      // *more* draw calls than the whole world in one tile — if bbox
      // culling regressed to "draw everything every tile" this would grow
      // roughly 4x instead of staying bounded.
      expect(quadrantDrawCount).toBeLessThanOrEqual(wholeWorldDrawCount);

      const tile = layer.getTileSize();
      expect(tile).toEqual({ x: 256, y: 256 });
    });

    it('label declutter creates markers for eligible places and is stable across repeated recomputes', () => {
      const html = buildOfflineFallbackHtml(true);
      const harness = createLeafletHarness();
      harness.setZoom(15);
      harness.setVisibleLongitudePredicate(() => true);
      vm.runInNewContext(extractInlineScript(html), harness.context);

      const markerCallsAfterInitialLoad = harness.L.marker.mock.calls.length;
      expect(markerCallsAfterInitialLoad).toBeGreaterThan(0);

      // Recomputing with an unchanged view must not recreate labels that
      // are already showing — that churn (remove+recreate every pan/zoom
      // event) is exactly the kind of thing that reads as UI flicker even
      // when nothing about the underlying data actually changed.
      harness.eventHandlers.get('moveend')?.();
      expect(harness.L.marker.mock.calls.length).toBe(
        markerCallsAfterInitialLoad,
      );

      harness.eventHandlers.get('zoomend')?.();
      expect(harness.L.marker.mock.calls.length).toBe(
        markerCallsAfterInitialLoad,
      );
    });

    it('detaches the canvas layer once tiles are confirmed loading, and reattaches if tiles start failing', () => {
      const html = buildOfflineFallbackHtml(true);
      const harness = createLeafletHarness();
      harness.setVisibleLongitudePredicate(() => true);
      vm.runInNewContext(extractInlineScript(html), harness.context);

      const layer = harness.gridLayerInstances[0];
      expect(harness.map.hasLayer(layer)).toBe(true);

      // A full, error-free tile batch means we're genuinely online — the
      // fallback layer should fully detach, not just hide visually, so no
      // further tiles get generated while panning around online.
      harness.tileLayerEventHandlers.get('loading')?.();
      harness.tileLayerEventHandlers.get('load')?.();
      expect(harness.map.hasLayer(layer)).toBe(false);
      const pane = harness.map.getPane('worldOutlinePane') as {
        style: Record<string, unknown>;
      };
      expect(pane.style.display).toBe('none');

      // A batch where every tile errors means we're genuinely offline —
      // the layer should reattach.
      harness.tileLayerEventHandlers.get('loading')?.();
      harness.tileLayerEventHandlers.get('tileerror')?.();
      harness.tileLayerEventHandlers.get('load')?.();
      expect(harness.map.hasLayer(layer)).toBe(true);
      expect(pane.style.display).toBe('');
    });
  });
});
