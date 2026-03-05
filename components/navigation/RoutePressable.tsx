import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { GestureResponderEvent, Pressable, type PressableProps } from 'react-native';

type RoutePressableProps = Omit<PressableProps, 'onPress'> & {
  href?: Href;
  hrefPath?: string;
  onPress?: (event: GestureResponderEvent) => void;
  navigateAfterPress?: boolean;
};

const shouldOpenInNewTab = (event?: GestureResponderEvent) => {
  const nativeEvent = event?.nativeEvent as
    | ({ ctrlKey?: boolean; metaKey?: boolean; button?: number } & object)
    | undefined;

  return Boolean(nativeEvent?.ctrlKey || nativeEvent?.metaKey || nativeEvent?.button === 1);
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
    if (href && hrefPath && shouldOpenInNewTab(event) && typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(hrefPath, '_blank', 'noopener,noreferrer');
      return;
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

