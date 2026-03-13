import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Alert, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { registerForPushNotifications } from '../src/notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from '../src/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function RootLayout() {
  const router = useRouter();
  const ringtoneSound = useRef<any>(null);

  async function playRingtone() {
    if (Platform.OS === 'web') return;
    try {
      const { Audio } = require('expo-av');
      await stopRingtone();
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_78396636aa.mp3' },
        { isLooping: true, shouldPlay: true, volume: 1.0 }
      );
      ringtoneSound.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.warn('Handshake alert failed', error);
    }
  }

  async function stopRingtone() {
    if (ringtoneSound.current) {
      try {
        await ringtoneSound.current.stopAsync();
        await ringtoneSound.current.unloadAsync();
      } catch (e) {}
      ringtoneSound.current = null;
    }
  }

  useEffect(() => {
    // Only register push on native
    if (Platform.OS !== 'web') {
      registerForPushNotifications();
    }

    let unsubscribeCalls: () => void;

    const setupCallListener = () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "calls"),
        where("targetUserId", "==", user.uid),
        where("status", "==", "dialing")
      );

      unsubscribeCalls = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const callData = change.doc.data();
            const callId = change.doc.id;

            if (Platform.OS === 'web') {
              const accept = window.confirm(`INCOMING SECURE LINK: Agent requesting ${callData.isVideo ? 'VIDEO' : 'VOICE'} connection. ACCEPT?`);
              if (accept) {
                router.push(`/call/${callData.isVideo ? 'video' : 'voice'}?id=${callId}&target=${callData.callerId}`);
              }
            } else {
              playRingtone();
              Alert.alert(
                "INCOMING SECURE LINK",
                `Agent is requesting a ${callData.isVideo ? 'VIDEO' : 'VOICE'} connection.`,
                [
                  { text: "REJECT", style: "cancel", onPress: () => stopRingtone() },
                  {
                    text: "ACCEPT",
                    onPress: () => {
                      stopRingtone();
                      router.push(`/call/${callData.isVideo ? 'video' : 'voice'}?id=${callId}&target=${callData.callerId}`);
                    }
                  }
                ],
                { onDismiss: () => stopRingtone() }
              );
            }
          }
        });
      });
    };

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setupCallListener();
      } else if (unsubscribeCalls) {
        unsubscribeCalls();
      }
    });

    return () => {
      authUnsubscribe();
      if (unsubscribeCalls) unsubscribeCalls();
      stopRingtone();
    };
  }, []);

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#050505' },
          animation: 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
});
