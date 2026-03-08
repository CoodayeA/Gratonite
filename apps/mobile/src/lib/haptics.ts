import * as Haptics from 'expo-haptics';

export function lightImpact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function mediumImpact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function heavyImpact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export function selectionFeedback() {
  Haptics.selectionAsync();
}

export function notificationSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function notificationWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function notificationError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
