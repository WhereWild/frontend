// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { PanResponder, View, type GestureResponderEvent } from 'react-native';

/**
 * Returns:
 * - host measurement ref/callback (`tabsHostRef`, `measureTabsHostInWindow`)
 * - attached gesture handlers (`panHandlers`)
 * - press guard helper to avoid duplicate commits (`shouldHandleTabPress`)
 */

type HostWindowOrigin = {
  x: number;
  y: number;
};

type UseNavigationBarPanResponderParams = {
  getTabIndexAtPoint: (x: number, y: number) => number | null;
  setPreviewIndex: React.Dispatch<React.SetStateAction<number | null>>;
  commitTabSelection: (index: number) => void;
};

export type NavigationBarPanResponderModel = {
  /** Ref for the tabs host container used for window-origin measurement. */
  tabsHostRef: React.RefObject<View | null>;
  /** Recomputes host window origin before/while gesture interactions. */
  measureTabsHostInWindow: () => void;
  /** Pan handlers to spread onto the tabs host view. */
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  /** Guard that blocks duplicate tab press commits after pan-release commits. */
  shouldHandleTabPress: () => boolean;
};

/**
 * Owns gesture capture and drag selection behavior for the nav bar.
 * Exposes host refs/handlers plus a guarded press helper to prevent duplicate commits.
 */
export function useNavigationBarPanResponder({
  getTabIndexAtPoint,
  setPreviewIndex,
  commitTabSelection,
}: UseNavigationBarPanResponderParams): NavigationBarPanResponderModel {
  const isTouchPressActiveRef = React.useRef(false);
  const suppressNextTabOnPressRef = React.useRef(false);
  const previewIndexRef = React.useRef<number | null>(null);
  const tabsHostRef = React.useRef<View>(null);
  const tabsHostWindowOriginRef = React.useRef<HostWindowOrigin | null>(null);

  const setPreviewIndexTracked = React.useCallback(
    (index: number | null) => {
      previewIndexRef.current = index;
      setPreviewIndex(index);
    },
    [setPreviewIndex],
  );

  /** Measures host origin for page-coordinate → local-coordinate conversion. */
  const measureTabsHostInWindow = React.useCallback(() => {
    const tabsHost = tabsHostRef.current;

    if (!tabsHost) {
      return;
    }

    tabsHost.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        return;
      }

      tabsHostWindowOriginRef.current = { x, y };
    });
  }, []);

  const updatePreviewAtPagePoint = React.useCallback(
    (pageX: number, pageY: number) => {
      const origin = tabsHostWindowOriginRef.current;

      if (!origin) {
        return null;
      }

      const hoveredTabIndex = getTabIndexAtPoint(
        pageX - origin.x,
        pageY - origin.y,
      );

      if (hoveredTabIndex === null) {
        return null;
      }

      if (previewIndexRef.current !== hoveredTabIndex) {
        setPreviewIndexTracked(hoveredTabIndex);
      }

      return hoveredTabIndex;
    },
    [getTabIndexAtPoint, setPreviewIndexTracked],
  );

  const updatePreviewAtEventPoint = React.useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      return updatePreviewAtPagePoint(pageX, pageY);
    },
    [updatePreviewAtPagePoint],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (event) => {
          // Refresh host origin before hit-testing so page coordinates map correctly.
          measureTabsHostInWindow();
          // Capture only if the gesture starts over a tab; otherwise let ancestors handle it.
          return updatePreviewAtEventPoint(event) !== null;
        },
        // Continue capturing move events only while a touch interaction is active on the bar.
        onMoveShouldSetPanResponderCapture: () => isTouchPressActiveRef.current,
        onPanResponderGrant: (event) => {
          // Mark touch session active and prime preview state at the initial touch location.
          measureTabsHostInWindow();
          isTouchPressActiveRef.current = true;
          updatePreviewAtEventPoint(event);
        },
        onPanResponderMove: (_event, gestureState) => {
          // Ignore move events when no touch session is active (stale or unrelated responder traffic).
          if (!isTouchPressActiveRef.current) {
            return;
          }

          // Drive live preview from the latest move point while dragging across tabs.
          updatePreviewAtPagePoint(gestureState.moveX, gestureState.moveY);
        },
        onPanResponderRelease: (_event, gestureState) => {
          // Ignore release events that don't belong to an active touch session.
          if (!isTouchPressActiveRef.current) {
            return;
          }

          isTouchPressActiveRef.current = false;
          // Commit the release hit target, or fall back to the most recent previewed tab.
          const releasedTabIndex =
            updatePreviewAtPagePoint(gestureState.moveX, gestureState.moveY) ??
            previewIndexRef.current;

          if (releasedTabIndex === null) {
            // No valid target; clear transient preview state and exit without committing.
            setPreviewIndexTracked(null);
            return;
          }

          // Block the subsequent tab onPress from double-committing the same selection.
          suppressNextTabOnPressRef.current = true;
          commitTabSelection(releasedTabIndex);
        },
        onPanResponderTerminate: () => {
          // Gesture was interrupted (e.g., parent took responder); reset touch/preview state.
          isTouchPressActiveRef.current = false;
          setPreviewIndexTracked(null);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [
      commitTabSelection,
      measureTabsHostInWindow,
      setPreviewIndexTracked,
      updatePreviewAtEventPoint,
      updatePreviewAtPagePoint,
    ],
  );

  const shouldHandleTabPress = React.useCallback(() => {
    if (suppressNextTabOnPressRef.current) {
      suppressNextTabOnPressRef.current = false;
      return false;
    }

    return !isTouchPressActiveRef.current;
  }, []);

  return {
    tabsHostRef,
    measureTabsHostInWindow,
    panHandlers: panResponder.panHandlers,
    shouldHandleTabPress,
  };
}
