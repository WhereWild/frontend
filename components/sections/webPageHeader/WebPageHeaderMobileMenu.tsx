import { IconMenu } from '@/assets/icons';
import { Shadows, Size } from '@/constants/theme';
import React, { RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from '../../buttons/IconButton';
import { Button } from '../../buttons/Button';
import { Portal } from '../../Portal';
import type { WebPageHeaderAction } from './types';
import type { MobileMenuAnchor } from './useWebPageHeaderMobileMenu';

type WebPageHeaderMobileMenuProps = {
  actions: WebPageHeaderAction[];
  menuButtonRef: RefObject<View | null>;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  menuAnchor: MobileMenuAnchor | null;
  insetsTop: number;
  backgroundColor: string;
  borderColor: string;
};

export function WebPageHeaderMobileMenu({
  actions,
  menuButtonRef,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  menuAnchor,
  insetsTop,
  backgroundColor,
  borderColor,
}: WebPageHeaderMobileMenuProps) {
  return (
    <>
      <View ref={menuButtonRef} collapsable={false}>
        <IconButton
          variant="primary"
          icon={<IconMenu />}
          onPress={onToggleMenu}
          accessibilityLabel="Open menu"
        />
      </View>

      {isMenuOpen ? (
        <Portal visible={isMenuOpen} onDismiss={onCloseMenu}>
          <Pressable
            testID="page-header-menu-backdrop"
            style={styles.menuBackdrop}
            onPress={onCloseMenu}
          />
          <View
            style={[
              styles.mobileMenu,
              {
                backgroundColor,
                borderColor,
              },
              menuAnchor
                ? { top: menuAnchor.top + Size.space['600'], right: menuAnchor.right }
                : {
                  top: insetsTop + Size.space['1600'] + Size.space['300'],
                  right: Size.space['200'],
                },
              Shadows.dropShadow400.style,
            ]}
          >
            {actions.map(({ label, icon, onPress, variant = 'subtle' }) => (
              <Button
                key={label}
                variant={variant}
                onPress={onPress}
                iconStart={icon}
                label={label}
                style={styles.mobileMenuButton}
              />
            ))}
          </View>
        </Portal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  mobileMenu: {
    position: 'absolute',
    padding: Size.space['200'],
    gap: Size.space['200'],
    borderRadius: Size.radius['400'],
    borderWidth: Size.stroke.border,
    zIndex: 10000,
  },
  mobileMenuButton: {
    width: '100%',
  },
});
