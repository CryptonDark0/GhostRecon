import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { apiCall } from './api';

// This file is the entry point for notifications.
// It uses conditional requires to avoid importing native-only libraries on web.

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    console.log('Push notifications protocol: BYPASSED (Web/Simulator)');
    return null;
  }

  try {
    // Dynamic require to prevent top-level side-effects on web
    const Notifications = require('expo-notifications');

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
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Encrypted Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00FF41',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Secure Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FFB000',
        sound: 'default',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ghostrecon',
    });
    const token = tokenData.data;

    if (token) {
      try {
        await apiCall('/notifications/register', {
          method: 'POST',
          body: JSON.stringify({ push_token: token }),
        });
      } catch (err) {
        console.warn("Failed to register push token with backend", err);
      }
    }
    return token;
  } catch (err) {
    console.warn("Error establishing push notification link:", err);
    return null;
  }
}

export async function sendLocalNotification(title: string, body: string, data?: any) {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null,
    });
  } catch (err) {
    console.error("Local notification failed", err);
  }
}
