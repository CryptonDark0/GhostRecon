import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Alert, Dimensions, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Shield, Lock } from 'lucide-react-native';
import { COLORS } from '../../src/constants';
import { auth, db } from '../../src/firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { startLocalStream, createCall, joinCall, endCall as endRtcCall, getLocalStream, setOnRemoteStreamUpdate } from '../../src/webrtc';

// Lazy-load native components only on mobile
let RTCView: any = null;
if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    RTCView = webrtc.RTCView;
  } catch (e) {
    console.warn("RTCView load failed", e);
  }
}

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type: string; id: string; target: string }>();
  const { type, target } = params;
  const [callId, setCallId] = useState(params.id);

  const callType = type || 'voice';
  const isVideo = callType === 'video';

  const [callStatus, setCallStatus] = useState('connecting');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [targetAlias, setTargetAlias] = useState('Agent');
  const [pulseAnim] = useState(new Animated.Value(1));
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const soundEffect = useRef<any>(null);
  const currentUser = auth.currentUser;

  async function playSound(uri: string, loop: boolean = false) {
    if (Platform.OS === 'web') return;
    try {
      const { Audio } = require('expo-av');
      await stopSound();
      const { sound } = await Audio.Sound.createAsync({ uri }, { isLooping: loop });
      soundEffect.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.warn('Error playing sound', error);
    }
  }

  async function stopSound() {
    if (soundEffect.current) {
      try {
        await soundEffect.current.stopAsync();
        await soundEffect.current.unloadAsync();
      } catch (e) {}
      soundEffect.current = null;
    }
  }

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    animation.start();

    setupCall();

    if (Platform.OS !== 'web') {
      setOnRemoteStreamUpdate((stream) => {
        console.log("[CALL] Remote stream received");
        setRemoteStream(stream);
        setCallStatus('connected');
        stopSound();
      });
    }

    return () => {
      animation.stop();
      stopSound();
      if (Platform.OS !== 'web') endRtcCall();
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const setupCall = async () => {
    if (!currentUser || !target) {
      console.error("Missing currentUser or target", { currentUser: !!currentUser, target });
      return;
    }

    try {
      // Fetch target alias immediately
      const targetDoc = await getDoc(doc(db, "users", target));
      if (targetDoc.exists()) {
        const data = targetDoc.data();
        setTargetAlias(data.alias || 'Agent');
      }

      if (!callId) {
        // INITIATOR FLOW
        console.log("[CALL] Initiating secure link...");
        playSound('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3', true);

        if (Platform.OS !== 'web') {
          await startLocalStream(isVideo);
          const newId = await createCall(target, currentUser.uid, isVideo);
          if (newId) {
            setCallId(newId);
            listenToCall(newId);
          }
        } else {
          // Fallback for web testing UI
          setCallStatus('calling');
        }
      } else {
        // RECEIVER FLOW
        console.log("[CALL] Joining existing secure link:", callId);
        if (Platform.OS !== 'web') {
          await startLocalStream(isVideo);
          await joinCall(callId);
        }
        listenToCall(callId);
      }
    } catch (err) {
      console.error("Setup call failed", err);
      if (Platform.OS !== 'web') {
        Alert.alert("Error", "Secure link failure.");
        router.back();
      }
    }
  };

  const listenToCall = (id: string) => {
    return onSnapshot(doc(db, "calls", id), (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      if (data.status === 'ended') {
        console.log("[CALL] Link terminated by remote agent.");
        playSound('https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3');
        setTimeout(() => router.back(), 1000);
      }

      if (data.status === 'connected') {
        setCallStatus('connected');
        stopSound();
      }
    });
  };

  const handleEndCall = async () => {
    if (callId) {
      try { await updateDoc(doc(db, "calls", callId), { status: 'ended' }); } catch (err) {}
    }
    playSound('https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3');
    if (Platform.OS !== 'web') endRtcCall();
    setTimeout(() => router.back(), 1000);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {isVideo && callStatus === 'connected' && Platform.OS !== 'web' && RTCView && (
        <View style={styles.videoContainer}>
          {remoteStream && (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
            />
          )}
          {!videoOff && getLocalStream() && (
            <RTCView
              streamURL={getLocalStream()!.toURL()}
              style={styles.localVideo}
              objectFit="cover"
            />
          )}
        </View>
      )}

      <View style={[styles.overlay, isVideo && callStatus === 'connected' && Platform.OS !== 'web' && styles.overlayTransparent]}>
        <View style={styles.securityBanner}>
          <Shield size={12} color={COLORS.terminal_green} />
          <Text style={styles.securityText}>SRTP + ZRTP ENCRYPTED</Text>
          <Lock size={12} color={COLORS.terminal_green} />
        </View>

        <View style={styles.content}>
          {(!(isVideo && callStatus === 'connected') || Platform.OS === 'web') && (
            <>
              <Text style={styles.callType}>{callType.toUpperCase()} CALL</Text>
              <Animated.View style={[
                styles.avatarCircle,
                { transform: [{ scale: (callStatus === 'connecting' || callStatus === 'calling') ? pulseAnim : 1 }] }
              ]}>
                <Text style={styles.avatarLetter}>
                  {targetAlias ? targetAlias[0].toUpperCase() : 'G'}
                </Text>
              </Animated.View>
            </>
          )}

          <Text style={styles.agentName}>{targetAlias}</Text>
          <Text style={styles.callStatusText}>
            {callStatus === 'connecting' ? 'ESTABLISHING SECURE LINK...' :
             callStatus === 'calling' ? 'DIALING AGENT...' : formatDuration(duration)}
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlBtn, muted && styles.controlBtnActive]}
            onPress={() => setMuted(!muted)}
          >
            {muted ? <MicOff size={24} color={COLORS.void_black} /> : <Mic size={24} color={COLORS.ghost_white} />}
          </TouchableOpacity>

          {callType === 'video' && (
            <TouchableOpacity
              style={[styles.controlBtn, videoOff && styles.controlBtnActive]}
              onPress={() => setVideoOff(!videoOff)}
            >
              {videoOff ? <VideoOff size={24} color={COLORS.void_black} /> : <Video size={24} color={COLORS.ghost_white} />}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={handleEndCall}
          >
            <PhoneOff size={28} color={COLORS.ghost_white} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  videoContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  remoteVideo: { flex: 1 },
  localVideo: {
    position: 'absolute', right: 20, top: 100,
    width: 100, height: 150, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.terminal_green,
  },
  overlay: { flex: 1, justifyContent: 'space-between' },
  overlayTransparent: { backgroundColor: 'transparent' },
  securityBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, backgroundColor: 'rgba(0,255,65,0.1)',
  },
  securityText: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  content: { alignItems: 'center', marginTop: 50 },
  callType: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace', letterSpacing: 3, marginBottom: 32 },
  avatarCircle: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, borderColor: COLORS.terminal_green,
    backgroundColor: COLORS.gunmetal,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  avatarLetter: { color: COLORS.terminal_green, fontSize: 48, fontWeight: '700', fontFamily: 'monospace' },
  agentName: { color: COLORS.ghost_white, fontSize: 24, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  callStatusText: { color: COLORS.terminal_green, fontSize: 14, fontFamily: 'monospace', marginTop: 12 },
  controls: {
    flexDirection: 'row', justifyContent: 'center', gap: 32,
    paddingBottom: 50,
  },
  controlBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  controlBtnActive: { backgroundColor: COLORS.terminal_green },
  endCallBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.critical_red,
    alignItems: 'center', justifyContent: 'center',
  },
});
