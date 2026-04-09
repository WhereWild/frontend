import React from 'react';
import type {
  NavigationBarTabForegroundTone,
  NavigationBarTabState,
} from './NavigationBarTab';
import {
  resolveNavigationTabForegroundTone,
  resolveNavigationTabState,
} from './navigationBarHelpers';

/**
 * Returns:
 * - selection state (`activeIndex`, `previewIndex`, `setPreviewIndex`)
 * - commit action (`commitTabSelection`)
 * - per-tab resolvers (`resolveDerivedState`, `resolveTabForegroundTone`)
 */

type SelectableNavigationTab = {
  state?: NavigationBarTabState;
  onPress?: () => void;
};

type UseNavigationBarSelectionModelParams<
  TTab extends SelectableNavigationTab,
> = {
  tabs: TTab[];
};

export type NavigationBarSelectionModel = {
  /** Currently active tab index (controlled or internal). */
  activeIndex: number;
  /** Previewed tab index while gesture/press is in-flight, otherwise null. */
  previewIndex: number | null;
  /** Preview index setter used by gesture logic. */
  setPreviewIndex: React.Dispatch<React.SetStateAction<number | null>>;
  /** Commits a tab as selected and executes tab onPress callback. */
  commitTabSelection: (index: number) => void;
  /** Resolves visual state (`active`/`pressed`/`default`) for a tab index. */
  resolveDerivedState: (index: number) => NavigationBarTabState;
  /** Resolves foreground tone (`default`/`brand`) for a tab index. */
  resolveTabForegroundTone: (index: number) => NavigationBarTabForegroundTone;
};

/**
 * Manages active/preview tab selection state and tab commit behavior.
 * Supports both controlled (incoming active state) and uncontrolled selection.
 */
export function useNavigationBarSelectionModel<
  TTab extends SelectableNavigationTab,
>({
  tabs,
}: UseNavigationBarSelectionModelParams<TTab>): NavigationBarSelectionModel {
  const controlledActiveIndex = React.useMemo(() => {
    const foundIndex = tabs.findIndex((tab) => tab.state === 'active');
    return foundIndex >= 0 ? foundIndex : 0;
  }, [tabs]);

  const [internalActiveIndex, setInternalActiveIndex] = React.useState(
    controlledActiveIndex,
  );
  const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
  const isControlled = React.useMemo(
    () => tabs.some((tab) => typeof tab.state === 'string'),
    [tabs],
  );
  const activeIndex = isControlled
    ? controlledActiveIndex
    : internalActiveIndex;

  React.useEffect(() => {
    if (!isControlled) {
      return;
    }

    setInternalActiveIndex(controlledActiveIndex);
  }, [controlledActiveIndex, isControlled]);

  React.useEffect(() => {
    if (!isControlled || previewIndex === null) {
      return;
    }

    if (previewIndex === controlledActiveIndex) {
      setPreviewIndex(null);
    }
  }, [controlledActiveIndex, isControlled, previewIndex]);

  /** Commits the selected tab and executes tab onPress callback. */
  const commitTabSelection = React.useCallback(
    (index: number) => {
      const tab = tabs[index];

      if (!tab) {
        setPreviewIndex(null);
        return;
      }

      if (!isControlled) {
        setInternalActiveIndex(index);
        setPreviewIndex(null);
      } else if (index === controlledActiveIndex) {
        // In controlled mode, clear any pressed preview immediately when the user
        // re-selects the already-active tab instead of waiting for the sync effect.
        setPreviewIndex(null);
      }

      tab.onPress?.();
    },
    [controlledActiveIndex, isControlled, tabs],
  );

  /** Resolves each tab's interaction state from active + preview indices. */
  const resolveDerivedState = React.useCallback(
    (index: number): NavigationBarTabState => {
      return resolveNavigationTabState(index, activeIndex, previewIndex);
    },
    [activeIndex, previewIndex],
  );

  /** Resolves foreground tone to keep visual contrast consistent during preview moves. */
  const resolveTabForegroundTone = React.useCallback(
    (index: number): NavigationBarTabForegroundTone => {
      return resolveNavigationTabForegroundTone(
        index,
        activeIndex,
        previewIndex,
      );
    },
    [activeIndex, previewIndex],
  );

  return {
    activeIndex,
    previewIndex,
    setPreviewIndex,
    commitTabSelection,
    resolveDerivedState,
    resolveTabForegroundTone,
  };
}
