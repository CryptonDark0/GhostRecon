import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Alert, Platform, AppState, AppStateStatus, View, Text, TouchableOpacity, Modal } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { registerForPushNotifications } from '../src/notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth, db } from '../src/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Shield, Phone, PhoneOff, Video, VideoOff } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { Audio } from 'expo-av';

const APP_VERSION = '2.1.1';
const VERSION_KEY = 'ghostrecon_system_version';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isAppActive, setIsAppActive] = useState(true);
  const [mustLock, setMustLock] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Incoming Call State
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const ringtoneSound = useRef<Audio.Sound | null>(null);

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

  const playRingtone = async () => {
    try {
      await stopRingtone();
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_78396636aa.mp3' },
        { isLooping: true, shouldPlay: true }
      );
      ringtoneSound.current = sound;
    } catch (error) {
      console.log("Audio Handshake failed.");
    }
  };

  const stopRingtone = async () => {
    if (ringtoneSound.current) {
      try { await ringtoneSound.current.stopAsync(); await ringtoneSound.current.unloadAsync(); } catch (e) {}
      ringtoneSound.current = null;
    }
  };

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
            setIncomingCall({ id: change.doc.id, ...callData });
            playRingtone();
          } else if (change.type === "modified") {
            const data = change.doc.data();
            if (data.status === 'ended') {
              setIncomingCall(null);
              stopRingtone();
            }
          }
        });
      }, () => {});
    };

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setupCallListener();
      else if (unsubscribeCalls) unsubscribeCalls();
    });
    return () => { authUnsubscribe(); if (unsubscribeCalls) unsubscribeCalls(); };
  }, [isReady]);

  const respondToCall = async (accept: boolean) => {
    if (!incomingCall) return;
    const callId = incomingCall.id;
    const isVideo = incomingCall.isVideo;
    const callerId = incomingCall.callerId;

    setIncomingCall(null);
    await stopRingtone();

    if (accept) {
      router.push(`/call/${isVideo ? 'video' : 'voice'}?id=${callId}&target=${callerId}`);
    } else {
      await updateDoc(doc(db, "calls", callId), { status: 'ended' });
    }
  };

  if (!isReady) return null;

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050505' }, animation: 'fade' }} />

      {/* 🛡️ INCOMING CALL OVERLAY */}
      <Modal visible={!!incomingCall} transparent animationType="slide">
        <View style={styles.callOverlay}>
          <Shield size={48} color={COLORS.terminal_green} />
          <Text style={styles.callTitle}>INCOMING SECURE LINK</Text>
          <Text style={styles.callSub}>{incomingCall?.isVideo ? 'VIDEO' : 'VOICE'} HANDSHAKE REQUESTED</Text>

          <View style={styles.callActions}>
            <TouchableOpacity style={[styles.callBtn, {backgroundColor: COLORS.critical_red}]} onPress={() => respondToCall(false)}>
              <PhoneOff color="#FFF" size={28} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.callBtn, {backgroundColor: COLORS.terminal_green}]} onPress={() => respondToCall(true)}>
              {incomingCall?.isVideo ? <Video color="#000" size={28} /> : <Phone color="#000" size={28} />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  privacySubtext: { color: '#525252', fontSize: 8, fontFamily: 'monospace' },
  callOverlay: { flex: 1, backgroundColor: 'rgba(5,5,5,0.95)', alignItems: 'center', justifyContent: 'center', gap: 30 },
  callTitle: { color: COLORS.terminal_green, fontSize: 18, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 2 },
  callSub: { color: '#FFF', fontSize: 10, fontFamily: 'monospace' },
  callActions: { flexDirection: 'row', gap: 60, marginTop: 40 },
  callBtn: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' }
});
