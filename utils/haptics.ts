import * as Haptics from 'expo-haptics';

export const triggerButtonHaptic = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
    console.warn('Haptics.impactAsync failed in triggerButtonHaptic', error);
  });
};

export const triggerSwitchHaptic = () => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
    console.warn('Haptics.impactAsync failed in triggerSwitchHaptic', error);
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
