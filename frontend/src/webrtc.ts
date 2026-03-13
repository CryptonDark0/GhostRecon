import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp
} from "firebase/firestore";

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

const getRTC = async () => {
  try {
    return await import('react-native-webrtc');
  } catch (e) {
    console.warn("WebRTC not available in this environment.");
    return null;
  }
};

export const setOnRemoteStreamUpdate = (callback: (stream: any) => void) => {
  onRemoteStreamUpdate = callback;
};

export async function startLocalStream(isVideo: boolean) {
  const rtc = await getRTC();
  if (!rtc) return null;

  const constraints = {
    audio: true,
    video: isVideo ? { facingMode: 'user' } : false,
  };

  localStream = await rtc.mediaDevices.getUserMedia(constraints);
  return localStream;
}

export async function createCall(targetUserId: string, callerId: string, isVideo: boolean) {
  const rtc = await getRTC();
  if (!rtc) return null;

  const callDoc = doc(collection(db, "calls"));
  const offerCandidates = collection(callDoc, "offerCandidates");
  const answerCandidates = collection(callDoc, "answerCandidates");

  peerConnection = new rtc.RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach((track: any) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.ontrack = (event: any) => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
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
    if (!peerConnection.currentRemoteDescription && data?.answer) {
      const answerDescription = new rtc.RTCSessionDescription(data.answer);
      peerConnection.setRemoteDescription(answerDescription);
    }
  });

  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new rtc.RTCIceCandidate(change.doc.data());
        peerConnection.addIceCandidate(candidate);
      }
    });
  });

  return callDoc.id;
}

export async function joinCall(callId: string) {
  const rtc = await getRTC();
  if (!rtc) return;

  const callDoc = doc(db, "calls", callId);
  const offerCandidates = collection(callDoc, "offerCandidates");
  const answerCandidates = collection(callDoc, "answerCandidates");

  peerConnection = new rtc.RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach((track: any) => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.ontrack = (event: any) => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
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

  await peerConnection.setRemoteDescription(new rtc.RTCSessionDescription(callData.offer));

  const answerDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answerDescription);

  const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
  await updateDoc(callDoc, { answer, status: 'connected' });

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        peerConnection.addIceCandidate(new rtc.RTCIceCandidate(change.doc.data()));
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
