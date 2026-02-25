import { Size } from '@/constants/theme';
import React, { RefObject, useEffect, useState } from 'react';
import { View } from 'react-native';

/** Absolute menu position anchored to the compact menu trigger button. */
export type MobileMenuAnchor = {
  top: number;
  right: number;
};

type UseWebPageHeaderMobileMenuOptions = {
  isCompact: boolean;
  menuButtonRef: RefObject<View | null>;
  windowWidth: number;
};

/**
 * Controls compact-menu open state and anchor measurement.
 * Also closes the menu automatically when switching back to desktop layout.
 */
export function useWebPageHeaderMobileMenu({
  isCompact,
  menuButtonRef,
  windowWidth,
}: UseWebPageHeaderMobileMenuOptions) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MobileMenuAnchor | null>(null);

  const closeMenu = React.useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const measureMenuAnchor = React.useCallback(() => {
    if (!menuButtonRef.current) {
      return;
    }

    menuButtonRef.current.measureInWindow((x, y, width, height) => {
      const right = Math.max(0, windowWidth - (x + width));
      setMenuAnchor({ top: y + height + Size.space['200'], right });
    });
  }, [menuButtonRef, windowWidth]);

  const openMenu = React.useCallback(() => {
    measureMenuAnchor();
    setIsMenuOpen(true);
  }, [measureMenuAnchor]);

  const toggleMenu = React.useCallback(() => {
    if (isMenuOpen) {
      closeMenu();
      return;
    }
    openMenu();
  }, [closeMenu, isMenuOpen, openMenu]);

  useEffect(() => {
    if (!isCompact && isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [isCompact, isMenuOpen]);

  useEffect(() => {
    if (isMenuOpen && isCompact) {
      measureMenuAnchor();
    }
  }, [isMenuOpen, isCompact, measureMenuAnchor]);

  return {
    isMenuOpen,
    menuAnchor,
    toggleMenu,
    closeMenu,
  };
}
