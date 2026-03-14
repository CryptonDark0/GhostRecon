import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Alert, Dimensions, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Shield, Lock, Volume2, VolumeX } from 'lucide-react-native';
import { COLORS } from '../../src/constants';
import { auth, db } from '../../src/firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { startLocalStream, createCall, joinCall, endCall as endRtcCall, getLocalStream, setOnRemoteStreamUpdate } from '../../src/webrtc';

let RTCView: any = null;
if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    RTCView = webrtc.RTCView;
  } catch (e) {}
}

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type: string; id: string; target: string }>();
  const { type, target } = params;
  const [callId, setCallId] = useState(params.id);

  const isVideo = type === 'video';
  const [callStatus, setCallStatus] = useState('connecting');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [videoOff, setVideoOff] = useState(false);
  const [targetAlias, setTargetAlias] = useState('Agent');
  const [remoteStream, setRemoteStream] = useState<any>(null);

  useEffect(() => {
    setupCall();
    if (Platform.OS !== 'web') {
      setOnRemoteStreamUpdate((stream) => {
        setRemoteStream(stream);
        setCallStatus('connected');
      });
    }
    return () => { if (Platform.OS !== 'web') endRtcCall(); };
  }, []);

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const setupCall = async () => {
    if (!auth.currentUser || !target) return;
    try {
      const targetSnap = await getDoc(doc(db, "users", target));
      if (targetSnap.exists()) setTargetAlias(targetSnap.data().alias);

      if (!callId) {
        if (Platform.OS !== 'web') {
          await startLocalStream(isVideo);
          const newId = await createCall(target, auth.currentUser.uid, isVideo);
          if (newId) { setCallId(newId); listenToCall(newId); }
        } else { setCallStatus('calling'); }
      } else {
        if (Platform.OS !== 'web') {
          await startLocalStream(isVideo);
          await joinCall(callId);
        }
        listenToCall(callId);
      }
    } catch (err) { router.back(); }
  };

  const listenToCall = (id: string) => {
    return onSnapshot(doc(db, "calls", id), (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      if (data.status === 'ended') setTimeout(() => router.back(), 1000);
      if (data.status === 'connected') setCallStatus('connected');
    });
  };

  const handleEndCall = async () => {
    if (callId) await updateDoc(doc(db, "calls", callId), { status: 'ended' });
    if (Platform.OS !== 'web') endRtcCall();
    router.back();
  };

  const toggleSpeaker = () => {
    if (Platform.OS !== 'web') {
      const { InCallManager } = require('react-native-webrtc');
      InCallManager.setForceSpeakerphoneOn(!speaker);
    }
    setSpeaker(!speaker);
  };

  return (
    <SafeAreaView style={styles.container}>
      {isVideo && callStatus === 'connected' && Platform.OS !== 'web' && RTCView && (
        <View style={styles.videoContainer}>
          {remoteStream && <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />}
          {!videoOff && getLocalStream() && <RTCView streamURL={getLocalStream()!.toURL()} style={styles.localVideo} objectFit="cover" />}
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.securityBanner}>
          <Shield size={12} color={COLORS.terminal_green} />
          <Text style={styles.securityText}>AES-256 E2EE ACTIVE</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.agentName}>{targetAlias}</Text>
          <Text style={styles.callStatusText}>
            {callStatus === 'connecting' ? 'ESTABLISHING...' : callStatus === 'calling' ? 'DIALING...' :
             `${Math.floor(duration/60).toString().padStart(2,'0')}:${(duration%60).toString().padStart(2,'0')}`}
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.controlBtn, muted && styles.activeBtn]} onPress={() => setMuted(!muted)}>
            {muted ? <MicOff size={24} color="#000" /> : <Mic size={24} color="#FFF" />}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlBtn, speaker && styles.activeBtn]} onPress={toggleSpeaker}>
            {speaker ? <Volume2 size={24} color="#000" /> : <VolumeX size={24} color="#FFF" />}
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity style={[styles.controlBtn, videoOff && styles.activeBtn]} onPress={() => setVideoOff(!videoOff)}>
              {videoOff ? <VideoOff size={24} color="#000" /> : <Video size={24} color="#FFF" />}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}><PhoneOff size={28} color="#FFF" /></TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  videoContainer: { ...StyleSheet.absoluteFillObject },
  remoteVideo: { flex: 1 },
  localVideo: { position: 'absolute', right: 20, top: 100, width: 100, height: 150, borderRadius: 8, borderWidth: 1, borderColor: COLORS.terminal_green },
  overlay: { flex: 1, justifyContent: 'space-between', paddingVertical: 40 },
  securityBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: 'rgba(0,255,65,0.1)' },
  securityText: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  content: { alignItems: 'center', marginTop: 50 },
  agentName: { color: '#FFF', fontSize: 24, fontWeight: '700', fontFamily: 'monospace' },
  callStatusText: { color: COLORS.terminal_green, fontSize: 14, fontFamily: 'monospace', marginTop: 12 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 40 },
  controlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  activeBtn: { backgroundColor: COLORS.terminal_green },
  endCallBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.critical_red, alignItems: 'center', justifyContent: 'center' },
});
