import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

type PortalProps = {
  visible: boolean;
  onDismiss?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  children: React.ReactNode;
};

/**
 * A simple portal that renders children at the root level using Modal.
 * This ensures content appears above all other views regardless of parent
 * stacking context or overflow settings.
 */
export function Portal({ visible, onDismiss, accessibilityLabel, accessibilityHint, children }: PortalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onRequestClose={onDismiss}
    >
      <View
        style={[styles.container, { pointerEvents: 'box-none' }]}
        accessibilityRole="none"
        importantForAccessibility="no"
      >
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
