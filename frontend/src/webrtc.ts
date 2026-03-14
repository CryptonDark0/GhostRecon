import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import { Platform } from 'react-native';

// WebRTC configuration
let peerConnection: any = null;
let localStream: any = null;
let remoteStream: any = null;
let onRemoteStreamUpdate: ((stream: any) => void) | null = null;

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

const getRTCProvider = () => {
  if (Platform.OS === 'web') {
    return {
      RTCPeerConnection: window.RTCPeerConnection,
      RTCSessionDescription: window.RTCSessionDescription,
      RTCIceCandidate: window.RTCIceCandidate,
      mediaDevices: navigator.mediaDevices,
    };
  } else {
    try {
      return require('react-native-webrtc');
    } catch (e) {
      console.warn("Native WebRTC module not found.");
      return null;
    }
  }
};

export const setOnRemoteStreamUpdate = (callback: (stream: any) => void) => {
  onRemoteStreamUpdate = callback;
};

export async function startLocalStream(isVideo: boolean) {
  const provider = getRTCProvider();
  if (!provider) return null;

  // 🛡️ REUSE PROTECTION: Reuse local stream if already active
  if (localStream && localStream.active) {
    console.log("[GHOST-RTC] Reusing existing local stream.");
    return localStream;
  }

  const constraints = {
    audio: true,
    video: isVideo ? {
      facingMode: 'user',
      width: { min: 640, ideal: 1280 },
      height: { min: 480, ideal: 720 }
    } : false,
  };

  try {
    localStream = await provider.mediaDevices.getUserMedia(constraints);
    return localStream;
  } catch (err) {
    console.error("Failed to get local stream", err);
    return null;
  }
}

export async function createCall(targetUserId: string, callerId: string, isVideo: boolean) {
  const provider = getRTCProvider();
  if (!provider) return null;

  const callDoc = doc(collection(db, "calls"));
  const offerCandidates = collection(callDoc, "offerCandidates");
  const answerCandidates = collection(callDoc, "answerCandidates");

  peerConnection = new provider.RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach((track: any) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.ontrack = (event: any) => {
    const stream = event.streams[0];
    if (stream && stream.id !== remoteStream?.id) {
      remoteStream = stream;
      if (onRemoteStreamUpdate) onRemoteStreamUpdate(remoteStream);
    }
  };

  peerConnection.onicecandidate = (event: any) => {
    if (event.candidate) {
      addDoc(offerCandidates, event.candidate.toJSON());
    }
  };

  const offerDescription = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offerDescription);

  const offer = { sdp: offerDescription.sdp, type: offerDescription.type };

  await setDoc(callDoc, {
    offer,
    callerId,
    targetUserId,
    isVideo,
    status: 'dialing',
    createdAt: serverTimestamp()
  });

  onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data();
    if (peerConnection && !peerConnection.currentRemoteDescription && data?.answer) {
      const answerDescription = new provider.RTCSessionDescription(data.answer);
      peerConnection.setRemoteDescription(answerDescription);
    }
  });

  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" && peerConnection) {
        const candidate = new provider.RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate).catch(e => {});
      }
    });
  });

  return callDoc.id;
}

export async function joinCall(callId: string) {
  const provider = getRTCProvider();
  if (!provider) return;

  const callDoc = doc(db, "calls", callId);
  const offerCandidates = collection(callDoc, "offerCandidates");
  const answerCandidates = collection(callDoc, "answerCandidates");

  peerConnection = new provider.RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach((track: any) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.ontrack = (event: any) => {
    const stream = event.streams[0];
    if (stream && stream.id !== remoteStream?.id) {
      remoteStream = stream;
      if (onRemoteStreamUpdate) onRemoteStreamUpdate(remoteStream);
    }
  };

  peerConnection.onicecandidate = (event: any) => {
    if (event.candidate) {
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  };

  const callSnap = await getDoc(callDoc);
  const callData = callSnap.data();
  if (!callData) return;

  await peerConnection.setRemoteDescription(new provider.RTCSessionDescription(callData.offer));

  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);

  const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
  await updateDoc(callDoc, { answer, status: 'connected' });

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" && peerConnection) {
        peerConnection.addIceCandidate(new provider.RTCIceCandidate(change.doc.data())).catch(e => {});
      }
    });
  });
}

export function endCall(): void {
  if (localStream) {
    localStream.getTracks().forEach((track: any) => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteStream = null;
  onRemoteStreamUpdate = null;
}

export function getLocalStream() { return localStream; }
export function getRemoteStream() { return remoteStream; }
