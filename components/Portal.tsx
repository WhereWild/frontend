// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { useNativePortalHost } from './NativePortalHost';

type PortalProps = {
  visible: boolean;
  onDismiss?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  children: React.ReactNode;
};

let nextPortalId = 0;

/**
 * Web keeps using Modal because that path is stable and gives us browser-like
 * overlay semantics. Native intentionally avoids Modal and instead registers
 * into NativePortalHost to bypass the Fabric modal-host teardown crash seen on iOS.
 */
export function Portal({
  visible,
  onDismiss,
  accessibilityLabel,
  accessibilityHint,
  children,
}: PortalProps) {
  const portalHost = useNativePortalHost();
  const portalIdRef = React.useRef<string | null>(null);

  if (!portalIdRef.current) {
    nextPortalId += 1;
    portalIdRef.current = `portal-${nextPortalId}`;
  }

  React.useEffect(() => {
    if (!visible || Platform.OS === 'web' || !portalHost) {
      return undefined;
    }

    portalHost.upsertPortal({
      id: portalIdRef.current!,
      accessibilityHint,
      accessibilityLabel,
      children,
    });

    return () => {
      portalHost.removePortal(portalIdRef.current!);
    };
  }, [accessibilityHint, accessibilityLabel, children, portalHost, visible]);

  if (!visible) {
    return null;
  }

  if (Platform.OS !== 'web') {
    if (portalHost) {
      return null;
    }

    return (
      <View
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={[styles.nativeFallback, styles.pointerEventsBoxNone]}
      >
        {/* Fallback for native renders outside RootLayout during tests or isolated stories. */}
        {children}
      </View>
    );
  }

  return (
    <Modal
      transparent
      visible
      animationType='none'
      statusBarTranslucent={false}
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>{children}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nativeFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  pointerEventsBoxNone: {
    pointerEvents: 'box-none',
  },
});
