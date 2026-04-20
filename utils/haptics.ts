import * as Haptics from 'expo-haptics';

const triggerImpactHaptic = (
  style: Haptics.ImpactFeedbackStyle,
  errorLabel: string,
) => {
  void Haptics.impactAsync(style).catch((error) => {
    console.warn(errorLabel, error);
  });
};

export const triggerButtonHaptic = () => {
  triggerImpactHaptic(
    Haptics.ImpactFeedbackStyle.Light,
    'Haptics.impactAsync failed in triggerButtonHaptic',
  );
};

export const triggerBoundHaptic = () => {
  triggerImpactHaptic(
    Haptics.ImpactFeedbackStyle.Medium,
    'Haptics.impactAsync failed in triggerBoundHaptic',
  );
};

export const triggerSelectionHaptic = () => {
  void Haptics.selectionAsync().catch((error) => {
    console.warn(
      'Haptics.selectionAsync failed in triggerSelectionHaptic',
      error,
    );
  });
};

const triggerNotificationHaptic = (
  type: Haptics.NotificationFeedbackType,
  errorLabel: string,
) => {
  void Haptics.notificationAsync(type).catch((error) => {
    console.warn(errorLabel, error);
  });
};

export const triggerSuccessHaptic = () => {
  triggerNotificationHaptic(
    Haptics.NotificationFeedbackType.Success,
    'Haptics.notificationAsync failed in triggerSuccessHaptic',
  );
};

export const triggerErrorHaptic = () => {
  triggerNotificationHaptic(
    Haptics.NotificationFeedbackType.Error,
    'Haptics.notificationAsync failed in triggerErrorHaptic',
  );
};
