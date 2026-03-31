import * as ExpoRouter from 'expo-router';
import React from 'react';
import { GestureResponderEvent, Pressable, type PressableProps } from 'react-native';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';

type RoutePressableProps = Omit<PressableProps, 'onPress'> & {
  href?: ExpoRouter.Href;
  hrefPath?: string;
  onPress?: (event: GestureResponderEvent) => void;
  navigateAfterPress?: boolean;
  showPointerCursor?: boolean;
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
  showPointerCursor = true,
  ...pressableProps
}: RoutePressableProps) {
  const { disabled, style, ...restPressableProps } = pressableProps;
  const router = ExpoRouter.useRouter();
  const pathname = ExpoRouter.usePathname();
  const isStringHref = typeof href === 'string';
  const comparablePath = isStringHref ? href : hrefPath;
  const supportsCurrentRouteCheck = typeof comparablePath === 'string';

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
    const isCurrentRoute = supportsCurrentRouteCheck && comparablePath === pathname;
    if (shouldNavigate && !isCurrentRoute) {
      router.push(href);
    }
  }, [
    comparablePath,
    href,
    hrefPath,
    navigateAfterPress,
    onPress,
    pathname,
    router,
    supportsCurrentRouteCheck
  ]);

  return (
    <Pressable
      {...restPressableProps}
      disabled={disabled}
      onPress={handlePress}
      style={(state) => {
        const resolvedStyle = typeof style === 'function' ? style(state) : style;
        const normalizedStyle = Array.isArray(resolvedStyle)
          ? resolvedStyle
          : [resolvedStyle];

        return [
          showPointerCursor ? getInteractiveCursorStyle(disabled ?? false) : null,
          ...normalizedStyle,
        ];
      }}
    />
  );
}
