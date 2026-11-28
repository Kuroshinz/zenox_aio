/**
 * Safe bridge for Capacitor iOS native ergonomics (Haptics & Rest Timer Notifications).
 * Gracefully no-ops on Web browsers and SSR/Node test environments.
 */

function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

const REST_TIMER_NOTIF_ID = 9001;

export async function triggerHaptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light'): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (kind === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (kind === 'medium') {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch {
    // Native plugin unavailable
  }
}

export async function scheduleRestTimerNotification(
  seconds: number,
  title: string = 'Hết giờ nghỉ giữa hiệp!',
  body: string = 'Sẵn sàng bước vào hiệp tiếp theo trên ZENOX.'
): Promise<void> {
  if (!isNativePlatform() || seconds <= 0) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
    await LocalNotifications.cancel({ notifications: [{ id: REST_TIMER_NOTIF_ID }] }).catch(() => undefined);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_TIMER_NOTIF_ID,
          title,
          body,
          schedule: { at: new Date(Date.now() + Math.round(seconds) * 1000), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    // Ignore notification permission / scheduling errors
  }
}

export async function cancelRestTimerNotification(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REST_TIMER_NOTIF_ID }] });
  } catch {
    // Ignore cancel errors
  }
}
