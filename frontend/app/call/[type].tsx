import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Alert, Dimensions, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Shield, Lock, Volume2, VolumeX, Activity } from 'lucide-react-native';
import { COLORS } from '../../src/constants';
import { auth, db } from '../../src/firebase';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { startLocalStream, createCall, joinCall, endCall as endRtcCall, getLocalStream, setOnRemoteStreamUpdate } from '../../src/webrtc';
import { Audio } from 'expo-av';

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
  const [isAudioPassing, setIsAudioPassing] = useState(false);
  const [activeTracks, setActiveTracks] = useState<string[]>([]);

  const dialTone = useRef<Audio.Sound | null>(null);
  const isMounted = useRef(true);
  const remoteVideoRef = useRef<any>(null);
  const localVideoRef = useRef<any>(null);

  useEffect(() => {
    isMounted.current = true;
    setupCall();

    setOnRemoteStreamUpdate((stream) => {
      if (!isMounted.current) return;

      const tracks = stream.getTracks();
      const trackTypes = tracks.map((t: any) => t.kind.toUpperCase());
      setActiveTracks(trackTypes);

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        setIsAudioPassing(audioTrack.enabled && audioTrack.readyState === 'live');
      }

      setRemoteStream(stream);
      setCallStatus('connected');
      stopDialTone();

      if (Platform.OS === 'web' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    return () => {
      isMounted.current = false;
      stopDialTone();
      endRtcCall();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && localVideoRef.current && getLocalStream()) {
      localVideoRef.current.srcObject = getLocalStream();
    }
  }, [callStatus, videoOff]);

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        if (isMounted.current) setDuration(d => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const toggleMute = () => {
    const stream = getLocalStream();
    if (stream) {
      stream.getAudioTracks().forEach((track: any) => {
        track.enabled = muted; // Enable if we were muted, disable if we were live
      });
    }
    setMuted(!muted);
  };

  const playDialTone = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/phone/phone-calling-1.mp3' },
        { isLooping: true, shouldPlay: true, volume: 0.3 }
      );
      if (isMounted.current) dialTone.current = sound;
      else await sound.unloadAsync();
    } catch (e) {}
  };

  const stopDialTone = async () => {
    if (dialTone.current) {
      try { await dialTone.current.stopAsync(); await dialTone.current.unloadAsync(); } catch (e) {}
      dialTone.current = null;
    }
  };

  const setupCall = async () => {
    if (!auth.currentUser || !target) return;
    try {
      const targetSnap = await getDoc(doc(db, "users", target));
      if (targetSnap.exists() && isMounted.current) setTargetAlias(targetSnap.data().alias);

      await startLocalStream(isVideo);

      if (!callId) {
        if (isMounted.current) {
            setCallStatus('calling');
            playDialTone().catch(() => {});
        }
        const newId = await createCall(target, auth.currentUser.uid, isVideo);
        if (newId && isMounted.current) {
          setCallId(newId);
          listenToCall(newId);
        }
      } else {
        await joinCall(callId);
        listenToCall(callId);
      }
    } catch (err) {
      console.error("[GHOST-RTC] Handshake Error:", err);
    }
  };

  const listenToCall = (id: string) => {
    return onSnapshot(doc(db, "calls", id), (snapshot) => {
      if (!isMounted.current) return;
      const data = snapshot.data();
      if (data?.status === 'ended') {
        setCallStatus('ended');
        stopDialTone();
        setTimeout(() => { if (isMounted.current) router.replace('/home'); }, 1500);
      }
      if (data?.status === 'connected' && callStatus !== 'connected') {
        setCallStatus('connected');
        stopDialTone();
      }
    });
  };

  const handleEndCall = async () => {
    if (callId) { try { await updateDoc(doc(db, "calls", callId), { status: 'ended' }); } catch (e) {} }
    stopDialTone();
    endRtcCall();
    router.replace('/home');
  };

  const toggleSpeaker = async () => {
    setSpeaker(!speaker);
    if (Platform.OS !== 'web') {
      try {
        const { InCallManager } = require('react-native-webrtc');
        InCallManager.setSpeakerphoneOn(!speaker);
      } catch (e) {}
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {isVideo && callStatus === 'connected' && (
        <View style={styles.videoContainer}>
          {Platform.OS === 'web' ? (
             <video autoPlay playsInline ref={remoteVideoRef} style={styles.webRemoteVideo as any} />
          ) : (
            RTCView && remoteStream && <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
          )}
          {!videoOff && getLocalStream() && (
            Platform.OS === 'web' ? (
              <video autoPlay muted playsInline ref={localVideoRef} style={styles.webLocalVideo as any} />
            ) : (
              RTCView && <RTCView streamURL={getLocalStream()!.toURL()} style={styles.localVideo} objectFit="cover" />
            )
          )}
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.securityBanner}>
          <Shield size={12} color={COLORS.terminal_green} />
          <Text style={styles.securityText}>AES-256 E2EE ACTIVE</Text>
          {isAudioPassing && (
            <View style={styles.audioMonitor}>
              <Activity size={10} color={COLORS.terminal_green} />
              <Text style={styles.audioMonitorText}>AUDIO: LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.agentName}>{targetAlias}</Text>
          <Text style={styles.callStatusText}>
            {callStatus === 'connecting' ? 'ESTABLISHING SECURE NODE...' :
             callStatus === 'calling' ? `OUTGOING ${isVideo ? 'VIDEO' : 'AUDIO'} CALL` :
             callStatus === 'ended' ? 'LINK TERMINATED' :
             `${Math.floor(duration/60).toString().padStart(2,'0')}:${(duration%60).toString().padStart(2,'0')}`}
          </Text>

          <View style={styles.debugRow}>
             {activeTracks.map((t, i) => (
               <Text key={i} style={styles.debugBadge}>{t}</Text>
             ))}
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.controlBtn, muted && styles.activeBtn]} onPress={toggleMute}>
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
  webRemoteVideo: { width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
  localVideo: { position: 'absolute', right: 20, top: 100, width: 100, height: 150, borderRadius: 8, borderWidth: 1, borderColor: COLORS.terminal_green },
  webLocalVideo: { position: 'absolute', right: 20, top: 100, width: 120, height: 160, borderRadius: 8, border: `1px solid ${COLORS.terminal_green}`, objectFit: 'cover', backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between', paddingVertical: 40 },
  securityBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, paddingVertical: 10, backgroundColor: 'rgba(0,255,65,0.1)' },
  securityText: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  audioMonitor: { flexDirection: 'row', alignItems: 'center', gap: 4, borderLeftWidth: 1, borderLeftColor: 'rgba(0,255,65,0.3)', paddingLeft: 10 },
  audioMonitorText: { color: COLORS.terminal_green, fontSize: 8, fontFamily: 'monospace' },
  content: { alignItems: 'center', marginTop: 50 },
  agentName: { color: '#FFF', fontSize: 24, fontWeight: '700', fontFamily: 'monospace' },
  callStatusText: { color: COLORS.terminal_green, fontSize: 14, fontFamily: 'monospace', marginTop: 12 },
  debugRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  debugBadge: { color: '#000', backgroundColor: COLORS.terminal_green, fontSize: 8, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, fontFamily: 'monospace' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 40 },
  controlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  activeBtn: { backgroundColor: COLORS.terminal_green },
  endCallBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.critical_red, alignItems: 'center', justifyContent: 'center' },
});
