import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { GestureResponderEvent, Pressable, type PressableProps } from 'react-native';

type RoutePressableProps = Omit<PressableProps, 'onPress'> & {
  href?: Href;
  hrefPath?: string;
  onPress?: (event: GestureResponderEvent) => void;
  navigateAfterPress?: boolean;
};

type RoutePressNativeEvent = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  button?: number;
} & object;

type OpenTarget = 'new_window' | 'new_tab' | 'same_tab';

const resolveOpenTarget = (event?: GestureResponderEvent): OpenTarget => {
  const nativeEvent = event?.nativeEvent as RoutePressNativeEvent | undefined;

  if (nativeEvent?.shiftKey) {
    return 'new_window';
  }

  if (nativeEvent?.ctrlKey || nativeEvent?.metaKey || nativeEvent?.button === 1) {
    return 'new_tab';
  }

  return 'same_tab';
};

/**
 * Pressable wrapper that adds browser-like new-tab behavior for app routes.
 * Use `hrefPath` for web tab opening and `href` for in-app router navigation.
 */
export function RoutePressable({
  href,
  hrefPath,
  onPress,
  navigateAfterPress,
  ...pressableProps
}: RoutePressableProps) {
  const router = useRouter();

  const handlePress = React.useCallback((event: GestureResponderEvent) => {
    if (href && hrefPath && typeof window !== 'undefined' && typeof window.open === 'function') {
      const openTarget = resolveOpenTarget(event);
      if (openTarget === 'new_window') {
        // Avoid popup-style window features so browsers keep normal chrome/bookmarks UI.
        const openedWindow = window.open(hrefPath, '_blank');
        if (openedWindow) {
          openedWindow.opener = null;
        }
        return;
      }

      if (openTarget === 'new_tab') {
        window.open(hrefPath, '_blank', 'noopener,noreferrer');
        return;
      }
    }

    onPress?.(event);

    if (!href) {
      return;
    }

    const shouldNavigate = navigateAfterPress ?? !onPress;
    if (shouldNavigate) {
      router.push(href);
    }
  }, [href, hrefPath, navigateAfterPress, onPress, router]);

  return (
    <Pressable
      {...pressableProps}
      onPress={handlePress}
    />
  );
}
