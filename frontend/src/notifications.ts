import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { auth, db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * SECURE PUSH HANDSHAKE
 * Connects the physical device to the GhostRecon signaling network.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // 🛡️ Tactical Bypass: Physical hardware or Web environment required
  if (!Device.isDevice && Platform.OS !== 'web') {
    console.log('[GHOST-NOTIF] Handshake bypassed (Simulator)');
    return null;
  }

  try {
    const Notifications = require('expo-notifications');

    // Configure how notifications appear when app is OPEN
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[GHOST-NOTIF] Permission denied by agent.');
      return null;
    }

    // Configure OS-level tactical channels (Android)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Secure Call Link',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#00FF41',
        sound: 'default',
      });
    }

    // Retrieve unique device token using VAPID for Web support
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ghostrecon-9c294',
      vapidKey: 'BO9_lB7J1j9iPTwAtn3WQXVTgSZGRLILk21cCjTdNPcPNXFHpJ54lUr315s-QFijAYY6i1AiW9qo_yg0TBWKGYg'
    });
    const token = tokenData.data;

    // ⚡ CRITICAL: Use setDoc with merge to prevent Permission Denied on new users
    const user = auth.currentUser;
    if (user && token) {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        pushToken: token,
        deviceType: Platform.OS,
        lastOnline: new Date().toISOString()
      }, { merge: true });
      console.log(`[GHOST-NOTIF] Tactical link established for ${Platform.OS}.`);
    }

    return token;
  } catch (err) {
    console.error("[GHOST-NOTIF] Protocol failure:", err);
    return null;
  }
}

export async function sendLocalNotification(title: string, body: string) {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = require('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    });
  } catch (err) {}
}
