import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { getReactNativeEasing } from '@/constants/theme';
import {
  TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH,
  TOP_APP_BAR_PRIMARY_ACTION_TRANSITION_DURATION,
} from './TopAppBar.constants';
import type { PrimaryActionProps } from './TopAppBar.types';
import { useAnimatedValueRef } from './TopAppBarAnimatedValue.native';
import React from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, View } from 'react-native';

type PrimaryActionVisibleContentProps = {
  isIconButton: boolean;
  hasPrimaryButton: boolean;
  isPrimaryActionEnabled: boolean;
  contentWidth: number;
  primaryButtonIcon: PrimaryActionProps['primaryButtonIcon'];
  onPressPrimaryButton?: () => void;
  primaryIconButtonAccessibilityLabel: string;
  primaryButtonAccessibilityLabel: string;
  primaryButtonLabel: string;
};

/**
 * Renders the visible primary action control as either an icon button
 * or text button based on the current mode.
 */
function PrimaryActionVisibleContent({
  isIconButton,
  hasPrimaryButton,
  isPrimaryActionEnabled,
  contentWidth,
  primaryButtonIcon,
  onPressPrimaryButton,
  primaryIconButtonAccessibilityLabel,
  primaryButtonAccessibilityLabel,
  primaryButtonLabel,
}: PrimaryActionVisibleContentProps) {
  const showIconVariant = hasPrimaryButton && isIconButton;
  const showButtonVariant = hasPrimaryButton && !isIconButton;

  return (
    <View collapsable={false}>
      <View
        collapsable={false}
        accessibilityElementsHidden={!showIconVariant}
        importantForAccessibility={
          showIconVariant ? 'auto' : 'no-hide-descendants'
        }
        style={[
          { pointerEvents: showIconVariant ? 'auto' : 'none' },
          !showIconVariant ? styles.hiddenVariantSlot : undefined,
        ]}
      >
        <IconButton
          variant='primary'
          icon={primaryButtonIcon}
          enableHaptics={showIconVariant}
          onPress={showIconVariant ? onPressPrimaryButton : undefined}
          disabled={!isPrimaryActionEnabled || !hasPrimaryButton}
          accessibilityLabel={primaryIconButtonAccessibilityLabel}
        />
      </View>
      <View
        collapsable={false}
        accessibilityElementsHidden={!showButtonVariant}
        importantForAccessibility={
          showButtonVariant ? 'auto' : 'no-hide-descendants'
        }
        style={[
          { pointerEvents: showButtonVariant ? 'auto' : 'none' },
          !showButtonVariant ? styles.hiddenVariantSlot : undefined,
        ]}
      >
        <View style={{ width: contentWidth }}>
          <Button
            variant='primary'
            iconStart={primaryButtonIcon}
            label={primaryButtonLabel}
            enableHaptics={showButtonVariant}
            onPress={showButtonVariant ? onPressPrimaryButton : undefined}
            disabled={!isPrimaryActionEnabled || !hasPrimaryButton}
            accessibilityLabel={primaryButtonAccessibilityLabel}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Primary action slot with width/opacity animation for show/hide and
 * measured-width support for text-button mode.
 */
export function PrimaryAction({
  hasPrimaryButton,
  shouldRenderPrimaryAsIcon,
  primaryButtonIcon,
  onPressPrimaryButton,
  primaryIconButtonAccessibilityLabel,
  primaryButtonAccessibilityLabel,
  primaryButtonLabel,
}: PrimaryActionProps) {
  const animationEasing = React.useMemo(
    () => getReactNativeEasing('in-and-out'),
    [],
  );
  const [measuredTextButtonWidth, setMeasuredTextButtonWidth] =
    React.useState(0);
  const previousHasPrimaryButtonRef = React.useRef(hasPrimaryButton);
  const shouldRenderIconButton = shouldRenderPrimaryAsIcon;
  const visiblePrimaryWidth = shouldRenderIconButton
    ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH
    : measuredTextButtonWidth;
  const primaryActionWidth = useAnimatedValueRef(
    hasPrimaryButton ? visiblePrimaryWidth : 0,
  );
  const primaryActionOpacity = useAnimatedValueRef(hasPrimaryButton ? 1 : 0);

  React.useEffect(() => {
    const wasPrimaryButtonVisible = previousHasPrimaryButtonRef.current;
    previousHasPrimaryButtonRef.current = hasPrimaryButton;

    if (hasPrimaryButton && wasPrimaryButtonVisible) {
      primaryActionWidth.current.setValue(visiblePrimaryWidth);
      primaryActionOpacity.current.setValue(1);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(primaryActionWidth.current, {
        toValue: hasPrimaryButton ? visiblePrimaryWidth : 0,
        duration: TOP_APP_BAR_PRIMARY_ACTION_TRANSITION_DURATION,
        easing: animationEasing,
        useNativeDriver: false,
      }),
      Animated.timing(primaryActionOpacity.current, {
        toValue: hasPrimaryButton ? 1 : 0,
        duration: TOP_APP_BAR_PRIMARY_ACTION_TRANSITION_DURATION,
        easing: animationEasing,
        useNativeDriver: false,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    animationEasing,
    hasPrimaryButton,
    primaryActionOpacity,
    primaryActionWidth,
    visiblePrimaryWidth,
  ]);

  const handlePrimaryButtonLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const measuredWidth = Math.ceil(event.nativeEvent.layout.width);

      if (measuredWidth <= TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH) {
        return;
      }

      setMeasuredTextButtonWidth((previousWidth) =>
        previousWidth === measuredWidth ? previousWidth : measuredWidth,
      );
    },
    [],
  );

  const isPrimaryActionEnabled = typeof onPressPrimaryButton === 'function';

  return (
    <View
      collapsable={false}
      style={styles.primaryActionRow}
      testID='top-app-bar-filter-button-wrapper'
    >
      <View
        collapsable={false}
        accessibilityElementsHidden
        importantForAccessibility='no-hide-descendants'
        style={[styles.primaryActionMeasureLayer, { pointerEvents: 'none' }]}
      >
        <View
          testID='top-app-bar-primary-action-measure-layout'
          onLayout={handlePrimaryButtonLayout}
        >
          <Button
            variant='primary'
            iconStart={primaryButtonIcon}
            label={primaryButtonLabel}
            onPress={undefined}
            disabled={!isPrimaryActionEnabled}
            accessibilityLabel={primaryButtonAccessibilityLabel}
          />
        </View>
      </View>
      <Animated.View
        collapsable={false}
        testID='top-app-bar-primary-action-slot'
        style={[
          {
            pointerEvents: hasPrimaryButton ? 'auto' : 'none',
            width: primaryActionWidth.current,
            opacity: primaryActionOpacity.current,
          },
        ]}
      >
        <PrimaryActionVisibleContent
          isIconButton={shouldRenderIconButton}
          hasPrimaryButton={hasPrimaryButton}
          isPrimaryActionEnabled={isPrimaryActionEnabled}
          contentWidth={visiblePrimaryWidth}
          primaryButtonIcon={primaryButtonIcon}
          onPressPrimaryButton={onPressPrimaryButton}
          primaryIconButtonAccessibilityLabel={
            primaryIconButtonAccessibilityLabel
          }
          primaryButtonAccessibilityLabel={primaryButtonAccessibilityLabel}
          primaryButtonLabel={primaryButtonLabel}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  primaryActionMeasureLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  hiddenVariantSlot: {
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});
