import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Alert, Platform, AppState, AppStateStatus, View, Text } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { registerForPushNotifications } from '../src/notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from '../src/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shield } from 'lucide-react-native';

const APP_VERSION = '2.1.1';
const VERSION_KEY = 'ghostrecon_system_version';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isAppActive, setIsAppActive] = useState(true);
  const [mustLock, setMustLock] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const performSystemCheck = async () => {
      try {
        const lastVersion = await AsyncStorage.getItem(VERSION_KEY);
        if (lastVersion !== APP_VERSION) {
          const keysToPurge = ['ghostrecon_user_profile', 'ghostrecon_privacy_settings', 'ghostrecon_last_sync'];
          await AsyncStorage.multiRemove(keysToPurge);
          await AsyncStorage.setItem(VERSION_KEY, APP_VERSION);
        }
      } catch (e) {} finally { setIsReady(true); }
    };
    performSystemCheck();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const savedSettings = await AsyncStorage.getItem('ghostrecon_privacy_settings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};

      if (nextAppState === 'active') {
        setIsAppActive(true);
      } else if (settings.screenshot_protection) {
        setIsAppActive(false);
      }

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (settings.app_lock_immediate) setMustLock(true);
      }

      if (nextAppState === 'active' && mustLock) {
        const inAuthGroup = segments[0] === 'biometric-lock' || segments[0] === 'login' || segments[0] === 'register-pseudonym';
        if (auth.currentUser && !inAuthGroup) {
          setMustLock(false);
          router.replace('/biometric-lock');
        } else {
          setMustLock(false);
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [mustLock, segments, isReady]);

  useEffect(() => {
    if (!isReady) return;
    if (Platform.OS !== 'web') registerForPushNotifications();
    let unsubscribeCalls: () => void;

    const setupCallListener = () => {
      const user = auth.currentUser;
      if (!user) return;
      const q = query(collection(db, "calls"), where("targetUserId", "==", user.uid), where("status", "==", "dialing"));
      unsubscribeCalls = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const callData = change.doc.data();
            if (Platform.OS === 'web') {
              if (window.confirm(`INCOMING CALL: ACCEPT?`)) {
                router.push(`/call/${callData.isVideo ? 'video' : 'voice'}?id=${change.doc.id}&target=${callData.callerId}`);
              }
            } else {
              Alert.alert("INCOMING CALL", "Secure link requested", [
                { text: "ACCEPT", onPress: () => router.push(`/call/${callData.isVideo ? 'video' : 'voice'}?id=${change.doc.id}&target=${callData.callerId}`) },
                { text: "REJECT", style: "cancel" }
              ]);
            }
          }
        });
      }, (error) => {
        // Silently handle listener errors during logout/deletion
        console.log("[GHOST-LISTENERS] Call listener handshake closed.");
      });
    };

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setupCallListener();
      else if (unsubscribeCalls) unsubscribeCalls();
    });
    return () => { authUnsubscribe(); if (unsubscribeCalls) unsubscribeCalls(); };
  }, [isReady]);

  if (!isReady) return null;

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050505' }, animation: 'fade' }} />
      {!isAppActive && (
        <View style={styles.privacyOverlay}>
          <Shield size={64} color="#00FF41" />
          <Text style={styles.privacyText}>GHOSTRECON SECURE NODE</Text>
          <Text style={styles.privacySubtext}>HANDSHAKE ENCRYPTED // CONTENT MASKED</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  privacyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050505', zIndex: 9999, alignItems: 'center', justifyContent: 'center', gap: 20 },
  privacyText: { color: '#00FF41', fontSize: 14, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 4 },
  privacySubtext: { color: '#525252', fontSize: 8, fontFamily: 'monospace' }
});
