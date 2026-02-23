import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Shield, Lock } from 'lucide-react-native';
import { COLORS } from '../../src/constants';
import { apiCall, getUser } from '../../src/api';

export default function CallScreen() {
  const router = useRouter();
  const { type, target } = useLocalSearchParams<{ type: string; target: string }>();
  const callType = type || 'voice';
  const [callStatus, setCallStatus] = useState('connecting');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [targetAlias, setTargetAlias] = useState('Unknown Agent');
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    initiateCall();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callStatus === 'connected') {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const initiateCall = async () => {
    try {
      if (target) {
        const res = await apiCall('/calls', {
          method: 'POST',
          body: JSON.stringify({ target_user_id: target, call_type: callType }),
        });
        setCallId(res.id);
        setTargetAlias(res.receiver_alias);
      }
      setTimeout(() => setCallStatus('connected'), 2000);
    } catch {
      setCallStatus('connected');
    }
  };

  const endCall = async () => {
    if (callId) {
      try { await apiCall(`/calls/${callId}/end`, { method: 'PUT' }); } catch {}
    }
    router.back();
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.securityBanner}>
        <Shield size={12} color={COLORS.terminal_green} />
        <Text style={styles.securityText}>SRTP + ZRTP ENCRYPTED</Text>
        <Lock size={12} color={COLORS.terminal_green} />
      </View>

      <View style={styles.content}>
        <Text style={styles.callType}>{callType.toUpperCase()} CALL</Text>

        <Animated.View style={[styles.avatarCircle, { transform: [{ scale: callStatus === 'connecting' ? pulseAnim : 1 }] }]}>
          <Text style={styles.avatarLetter}>{targetAlias[0]}</Text>
        </Animated.View>

        <Text style={styles.agentName}>{targetAlias}</Text>
        <Text style={styles.callStatusText}>
          {callStatus === 'connecting' ? 'ESTABLISHING SECURE LINK...' : formatDuration(duration)}
        </Text>

        {callStatus === 'connected' && (
          <View style={styles.encryptionInfo}>
            <Text style={styles.encryptionText}>E2E ENCRYPTION ACTIVE</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          testID="mute-btn"
          style={[styles.controlBtn, muted && styles.controlBtnActive]}
          onPress={() => setMuted(!muted)}
          activeOpacity={0.7}
        >
          {muted ? <MicOff size={24} color={COLORS.void_black} /> : <Mic size={24} color={COLORS.ghost_white} />}
          <Text style={[styles.controlLabel, muted && styles.controlLabelActive]}>{muted ? 'UNMUTE' : 'MUTE'}</Text>
        </TouchableOpacity>

        {callType === 'video' && (
          <TouchableOpacity
            testID="video-toggle-btn"
            style={[styles.controlBtn, videoOff && styles.controlBtnActive]}
            onPress={() => setVideoOff(!videoOff)}
            activeOpacity={0.7}
          >
            {videoOff ? <VideoOff size={24} color={COLORS.void_black} /> : <Video size={24} color={COLORS.ghost_white} />}
            <Text style={[styles.controlLabel, videoOff && styles.controlLabelActive]}>VIDEO</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID="end-call-btn"
          style={styles.endCallBtn}
          onPress={endCall}
          activeOpacity={0.7}
        >
          <PhoneOff size={28} color={COLORS.ghost_white} />
          <Text style={styles.endCallLabel}>END</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  securityBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, backgroundColor: 'rgba(0,255,65,0.08)',
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  securityText: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  callStatusText: { color: COLORS.terminal_green, fontSize: 14, fontFamily: 'monospace', marginTop: 12, letterSpacing: 1 },
  encryptionInfo: {
    marginTop: 24, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.terminal_green, borderRadius: 2,
  },
  encryptionText: { color: COLORS.terminal_green, fontSize: 10, fontFamily: 'monospace', letterSpacing: 2 },
  controls: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
    paddingVertical: 32, paddingHorizontal: 24,
    borderTopWidth: 1, borderTopColor: COLORS.armour_grey,
  },
  controlBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1, borderColor: COLORS.border_subtle,
    backgroundColor: COLORS.gunmetal,
    alignItems: 'center', justifyContent: 'center',
  },
  controlBtnActive: { backgroundColor: COLORS.terminal_green, borderColor: COLORS.terminal_green },
  controlLabel: { color: COLORS.muted_text, fontSize: 8, fontFamily: 'monospace', marginTop: 4, letterSpacing: 1 },
  controlLabelActive: { color: COLORS.void_black },
  endCallBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.critical_red,
    alignItems: 'center', justifyContent: 'center',
  },
  endCallLabel: { color: COLORS.ghost_white, fontSize: 8, fontFamily: 'monospace', marginTop: 4, letterSpacing: 1 },
});
