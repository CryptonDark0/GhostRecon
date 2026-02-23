import { apiCall, getToken } from './api';
import { API_BASE } from './constants';

// WebRTC configuration
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;

export interface RTCConfig {
  iceServers: Array<{ urls: string | string[] }>;
  iceCandidatePoolSize: number;
}

export async function getWebRTCConfig(): Promise<RTCConfig> {
  try {
    return await apiCall('/webrtc/config');
  } catch {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };
  }
}

export async function initializeCall(
  callId: string,
  isVideo: boolean,
  onRemoteStream: (stream: MediaStream) => void,
  onIceCandidate: (candidate: string) => void
): Promise<MediaStream | null> {
  try {
    // Dynamic import for react-native-webrtc (only available in dev builds)
    const {
      RTCPeerConnection,
      RTCSessionDescription,
      RTCIceCandidate,
      mediaDevices,
    } = await import('react-native-webrtc');

    const config = await getWebRTCConfig();
    peerConnection = new RTCPeerConnection(config);

    // Get local media
    const constraints = {
      audio: true,
      video: isVideo ? { facingMode: 'user', width: 640, height: 480 } : false,
    };

    localStream = await mediaDevices.getUserMedia(constraints);

    // Add tracks to peer connection
    localStream.getTracks().forEach((track: any) => {
      if (peerConnection && localStream) {
        peerConnection.addTrack(track, localStream);
      }
    });

    // Handle remote stream
    peerConnection.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
        onRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        onIceCandidate(JSON.stringify(event.candidate));
      }
    };

    return localStream;
  } catch (err) {
    console.log('[WebRTC] Not available (Expo Go). Use EAS build for real calls:', err);
    return null;
  }
}

export async function createOffer(callId: string): Promise<string | null> {
  if (!peerConnection) return null;
  try {
    const { RTCSessionDescription } = await import('react-native-webrtc');
    const offer = await peerConnection.createOffer({});
    await peerConnection.setLocalDescription(offer);

    // Send offer via signaling server
    await apiCall('/calls/signal', {
      method: 'POST',
      body: JSON.stringify({
        call_id: callId,
        signal_type: 'offer',
        signal_data: JSON.stringify(offer),
      }),
    });

    return JSON.stringify(offer);
  } catch (err) {
    console.log('[WebRTC] Create offer error:', err);
    return null;
  }
}

export async function handleAnswer(answerSdp: string): Promise<void> {
  if (!peerConnection) return;
  try {
    const { RTCSessionDescription } = await import('react-native-webrtc');
    const answer = JSON.parse(answerSdp);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.log('[WebRTC] Handle answer error:', err);
  }
}

export async function handleOffer(callId: string, offerSdp: string): Promise<string | null> {
  if (!peerConnection) return null;
  try {
    const { RTCSessionDescription } = await import('react-native-webrtc');
    const offer = JSON.parse(offerSdp);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await apiCall('/calls/signal', {
      method: 'POST',
      body: JSON.stringify({
        call_id: callId,
        signal_type: 'answer',
        signal_data: JSON.stringify(answer),
      }),
    });

    return JSON.stringify(answer);
  } catch (err) {
    console.log('[WebRTC] Handle offer error:', err);
    return null;
  }
}

export async function addIceCandidate(candidateStr: string): Promise<void> {
  if (!peerConnection) return;
  try {
    const { RTCIceCandidate } = await import('react-native-webrtc');
    const candidate = JSON.parse(candidateStr);
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.log('[WebRTC] Add ICE candidate error:', err);
  }
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
}

export function getLocalStream(): MediaStream | null {
  return localStream;
}

export function getRemoteStream(): MediaStream | null {
  return remoteStream;
}
