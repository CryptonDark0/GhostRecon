import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { auth, db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * SECURE PUSH HANDSHAKE
 * Connects the physical device to the GhostRecon signaling network.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // 🛡️ Web/Simulator Protocol: Push is handled via browser service workers
  if (Platform.OS === 'web' || !Device.isDevice) {
    console.log('[GHOST-NOTIF] Handshake bypassed (Web/Simulator)');
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

    // Retrieve unique device token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ghostrecon-9c294', // Matches your Firebase project ID
    });
    const token = tokenData.data;

    // ⚡ CRITICAL: Link token to User Profile for incoming calls
    const user = auth.currentUser;
    if (user && token) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        pushToken: token,
        deviceType: Platform.OS
      });
      console.log('[GHOST-NOTIF] Tactical link established.');
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
