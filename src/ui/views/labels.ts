import type { DeviceKind } from '@joe/sync';

export const DEVICE_LABEL: Record<DeviceKind, string> = {
  'desktop-exe': 'Desktop',
  'android-apk': 'Android',
  'web-dashboard': 'Control plane',
};
