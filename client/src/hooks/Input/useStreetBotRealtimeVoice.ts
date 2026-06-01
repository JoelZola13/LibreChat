import { useCallback, useEffect, useRef, useState } from 'react';
import { apiBaseUrl } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

type RealtimeEvent = {
  type?: string;
  error?: {
    message?: string;
  };
};

const REALTIME_MODEL_FALLBACK = 'gpt-realtime-2';

function getPeerConnectionCtor(): typeof RTCPeerConnection | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.RTCPeerConnection;
}

function waitForIceGatheringComplete(peerConnection: RTCPeerConnection) {
  if (peerConnection.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(resolve, 1500);
    const handleStateChange = () => {
      if (peerConnection.iceGatheringState === 'complete') {
        window.clearTimeout(timeoutId);
        peerConnection.removeEventListener('icegatheringstatechange', handleStateChange);
        resolve();
      }
    };

    peerConnection.addEventListener('icegatheringstatechange', handleStateChange);
  });
}

export default function useStreetBotRealtimeVoice({
  onError,
}: {
  onError?: (message: string) => void;
} = {}) {
  const { token } = useAuthContext();
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!getPeerConnectionCtor();

  const cleanup = useCallback(() => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!isSupported || !token) {
      return false;
    }

    const RTCPeerConnectionCtor = getPeerConnectionCtor();
    if (!RTCPeerConnectionCtor) {
      return false;
    }

    cleanup();
    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const peerConnection = new RTCPeerConnectionCtor();
      peerConnectionRef.current = peerConnection;

      stream.getAudioTracks().forEach((track) => peerConnection.addTrack(track, stream));

      const remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
      remoteAudioRef.current = remoteAudio;
      document.body.appendChild(remoteAudio);

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream || !remoteAudioRef.current) {
          return;
        }

        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => undefined);
      };

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (event) => {
        try {
          const realtimeEvent = JSON.parse(event.data) as RealtimeEvent;
          const type = realtimeEvent.type ?? '';

          if (type === 'error') {
            setStatus('error');
            onError?.(realtimeEvent.error?.message ?? 'StreetBot voice had trouble connecting.');
            return;
          }

          if (type.includes('speech_started')) {
            setStatus('listening');
            return;
          }

          if (type.includes('response.audio') || type.includes('output_audio_buffer.started')) {
            setStatus('speaking');
            return;
          }

          if (type.includes('response.done') || type.includes('output_audio_buffer.stopped')) {
            setStatus('listening');
          }
        } catch {
          // Ignore malformed diagnostic events.
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);

      const localDescription = peerConnection.localDescription?.sdp ?? offer.sdp;
      if (!localDescription) {
        throw new Error('Unable to create a StreetBot voice offer.');
      }

      const response = await fetch(`${apiBaseUrl()}/api/voice/realtime/session`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
          'X-StreetBot-Realtime-Model': REALTIME_MODEL_FALLBACK,
        },
        body: localDescription,
      });

      const answer = await response.text();
      if (!response.ok) {
        throw new Error(answer || `StreetBot voice failed with HTTP ${response.status}.`);
      }

      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answer });
      setStatus('listening');
      return true;
    } catch (error) {
      cleanup();
      setStatus('error');
      onError?.(error instanceof Error ? error.message : 'StreetBot voice had trouble connecting.');
      return false;
    }
  }, [cleanup, isSupported, onError, token]);

  useEffect(() => cleanup, [cleanup]);

  return {
    isActive: status === 'connecting' || status === 'listening' || status === 'speaking',
    isConnecting: status === 'connecting',
    isListening: status === 'listening',
    isSpeaking: status === 'speaking',
    isSupported,
    start,
    status,
    stop,
  };
}
