import * as ExpoRouter from 'expo-router';
import React from 'react';
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  type PressableProps,
} from 'react-native';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import { triggerButtonHaptic } from '@/utils/haptics';

type RoutePressableProps = Omit<PressableProps, 'onPress'> & {
  href?: ExpoRouter.Href;
  hrefPath?: string;
  hrefAttrs?: {
    download?: boolean;
    rel?: string;
    target?: string;
  };
  onPress?: (event: GestureResponderEvent) => void;
  navigateAfterPress?: boolean;
  showPointerCursor?: boolean;
  enablePressHaptics?: boolean;
};

type RoutePressNativeEvent = {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  button?: number;
} & object;

type RoutePressEvent = GestureResponderEvent & {
  altKey?: boolean;
  button?: number;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  isDefaultPrevented?: () => boolean;
  metaKey?: boolean;
  nativeEvent?: RoutePressNativeEvent;
  preventDefault?: () => void;
  shiftKey?: boolean;
};

type WebPressableLinkProps = {
  href?: string;
  hrefAttrs?: {
    download?: boolean;
    rel?: string;
    target?: string;
  };
};

const getModifierFlag = (
  event: RoutePressEvent | undefined,
  key: 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey',
) => event?.[key] ?? event?.nativeEvent?.[key] ?? false;

const getEventButton = (event?: RoutePressEvent) =>
  event?.button ?? event?.nativeEvent?.button;

const isDefaultPrevented = (event?: RoutePressEvent) =>
  event?.isDefaultPrevented?.() ?? event?.defaultPrevented ?? false;

const shouldLetBrowserHandleEvent = (
  event?: RoutePressEvent,
  options?: {
    download?: boolean;
    linkTarget?: string;
  },
) => {
  const button = getEventButton(event);

  if (
    getModifierFlag(event, 'altKey') ||
    getModifierFlag(event, 'ctrlKey') ||
    getModifierFlag(event, 'metaKey') ||
    getModifierFlag(event, 'shiftKey')
  ) {
    return true;
  }

  if (button != null && button !== 0) {
    return true;
  }

  if (options?.download) {
    return true;
  }

  return ![undefined, null, '', 'self', '_self'].includes(options?.linkTarget);
};

const resolveRouteHref = (
  href: ExpoRouter.Href | undefined,
  hrefPath?: string,
) => {
  if (!href) {
    return undefined;
  }

  // Expo Router does not currently expose a typed href resolver here, but the
  // Link component carries one in practice. Use it when available so web can
  // render a real anchor for object hrefs, and fall back to hrefPath otherwise.
  const resolveHref = (
    ExpoRouter.Link as { resolveHref?: (value: ExpoRouter.Href) => string }
  )?.resolveHref;

  if (resolveHref) {
    return resolveHref(href);
  }

  return typeof href === 'string' ? href : hrefPath;
};

/**
 * Navigation primitive that renders a real anchor on web and a pressable on native.
 * Use `href` for router navigation and `hrefPath` when the current path needs to be compared explicitly.
 */
export function RoutePressable({
  href,
  hrefPath,
  hrefAttrs,
  onPress,
  navigateAfterPress,
  showPointerCursor = true,
  enablePressHaptics = false,
  ...pressableProps
}: RoutePressableProps) {
  const { disabled, style, ...restPressableProps } = pressableProps;
  const router = ExpoRouter.useRouter();
  const pathname = ExpoRouter.usePathname();
  const isWeb = Platform.OS === 'web';
  const isStringHref = typeof href === 'string';
  const resolvedHref = React.useMemo(
    () => resolveRouteHref(href, hrefPath),
    [href, hrefPath],
  );
  const anchorHref = hrefPath ?? resolvedHref;
  const comparablePath = isStringHref ? href : hrefPath;
  const supportsCurrentRouteCheck = typeof comparablePath === 'string';

  const handlePress = React.useCallback(
    (event: GestureResponderEvent) => {
      const routeEvent = event as RoutePressEvent;

      if (
        isWeb &&
        anchorHref &&
        shouldLetBrowserHandleEvent(routeEvent, {
          download: hrefAttrs?.download,
          linkTarget: hrefAttrs?.target,
        })
      ) {
        return;
      }

      if (enablePressHaptics && !(disabled ?? false)) {
        triggerButtonHaptic();
      }

      onPress?.(event);
      const userPreventedDefault = isDefaultPrevented(routeEvent);

      if (!href) {
        return;
      }

      if (isWeb && anchorHref) {
        routeEvent.preventDefault?.();
      }

      if (userPreventedDefault) {
        return;
      }

      const shouldNavigate = navigateAfterPress ?? !onPress;
      const isCurrentRoute =
        supportsCurrentRouteCheck && comparablePath === pathname;
      if (shouldNavigate && !isCurrentRoute) {
        router.push(href);
      }
    },
    [
      comparablePath,
      anchorHref,
      disabled,
      enablePressHaptics,
      href,
      hrefAttrs?.download,
      hrefAttrs?.target,
      isWeb,
      navigateAfterPress,
      onPress,
      pathname,
      router,
      supportsCurrentRouteCheck,
    ],
  );

  const webLinkProps: WebPressableLinkProps | undefined =
    isWeb && anchorHref
      ? {
          href: anchorHref,
          hrefAttrs,
        }
      : undefined;

  return (
    <Pressable
      {...restPressableProps}
      {...(webLinkProps as WebPressableLinkProps)}
      disabled={disabled}
      onPress={handlePress}
      style={(state) => {
        const resolvedStyle =
          typeof style === 'function' ? style(state) : style;
        const normalizedStyle = Array.isArray(resolvedStyle)
          ? resolvedStyle
          : [resolvedStyle];

        return [
          showPointerCursor
            ? getInteractiveCursorStyle(disabled ?? false)
            : null,
          ...normalizedStyle,
        ];
      }}
    />
  );
}
