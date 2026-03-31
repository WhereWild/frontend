import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type PortalEntry = {
  id: string;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

type NativePortalStore = {
  getSnapshot: () => PortalEntry[];
  subscribe: (listener: () => void) => () => void;
  upsertPortal: (entry: PortalEntry) => void;
  removePortal: (id: string) => void;
};

const NativePortalHostContext = React.createContext<NativePortalStore | null>(null);

const arePortalEntriesEqual = (left: PortalEntry, right: PortalEntry) => left === right
  || (
    left.id === right.id
    && left.accessibilityHint === right.accessibilityHint
    && left.accessibilityLabel === right.accessibilityLabel
    && left.children === right.children
  );

const createNativePortalStore = (): NativePortalStore => {
  let portals: PortalEntry[] = [];
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => portals,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    upsertPortal: (entry: PortalEntry) => {
      const existingIndex = portals.findIndex((portal) => portal.id === entry.id);

      if (existingIndex === -1) {
        portals = [...portals, entry];
        notify();
        return;
      }

      const existingEntry = portals[existingIndex];

      if (arePortalEntriesEqual(existingEntry, entry)) {
        return;
      }

      const nextPortals = [...portals];
      nextPortals[existingIndex] = entry;
      portals = nextPortals;
      notify();
    },
    removePortal: (id: string) => {
      const nextPortals = portals.filter((portal) => portal.id !== id);

      if (nextPortals.length === portals.length) {
        return;
      }

      portals = nextPortals;
      notify();
    },
  };
};

/**
 * Native overlays intentionally avoid React Native's Modal on iOS.
 *
 * Fabric was crashing while unmounting RCTModalHostViewComponentView with an
 * incorrect sibling index during mouse-driven interactions. This host keeps
 * native overlay content inside the app shell instead of creating native modal
 * host views, which sidesteps that teardown path entirely.
 */
export function NativePortalProvider({ children }: { children: React.ReactNode }) {
  const storeRef = React.useRef<NativePortalStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createNativePortalStore();
  }

  return (
    <NativePortalHostContext.Provider value={storeRef.current}>
      {children}
    </NativePortalHostContext.Provider>
  );
}

export function useNativePortalHost() {
  return React.useContext(NativePortalHostContext);
}

/**
 * Renders native overlay content above the app shell while leaving the main
 * React tree stable. Only this host rerenders when portal entries change.
 */
export function NativePortalHost() {
  const store = useNativePortalHost();

  const portals = React.useSyncExternalStore(
    store?.subscribe ?? (() => () => { }),
    store?.getSnapshot ?? (() => []),
    store?.getSnapshot ?? (() => []),
  );

  if (!store || Platform.OS === 'web') {
    return null;
  }

  return (
    <View collapsable={false} style={[styles.host, styles.pointerEventsBoxNone]}>
      {portals.map((portal) => (
        <View
          key={portal.id}
          collapsable={false}
          accessibilityViewIsModal
          accessibilityLabel={portal.accessibilityLabel}
          accessibilityHint={portal.accessibilityHint}
          style={[styles.portalLayer, styles.pointerEventsBoxNone]}
        >
          <View
            collapsable={false}
            style={[styles.portalContent, styles.pointerEventsBoxNone]}
          >
            {portal.children}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100000,
    elevation: 100000,
  },
  portalLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  portalContent: {
    ...StyleSheet.absoluteFillObject,
  },
  pointerEventsBoxNone: {
    pointerEvents: 'box-none',
  },
});