"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Square, Send, Trash2, Play, Pause } from "lucide-react";

const getMicrophoneErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotFoundError":
        return "No microphone was found. Please connect a microphone and try again.";
      case "NotAllowedError":
        return "Microphone access is blocked. Allow microphone access to record voice messages.";
      case "NotReadableError":
        return "The microphone is currently unavailable. Check your device settings and try again.";
      default:
        return "Microphone access is denied. Please allow access or try again later.";
    }
  }

  return "Microphone access is denied. Please allow microphone access to record voice messages.";
};

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  onCancel: () => void;
  maxDuration?: number; // in seconds
  colors: {
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    danger: string;
  };
}

export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  maxDuration = 300, // 5 minutes
  colors,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(20).fill(0));
  const placeholderLevels = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => {
        const wave = (Math.sin(index * 1.3) + 1) / 2;
        return 0.25 + wave * 0.6;
      }),
    [],
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevels(new Array(20).fill(0));
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start visualization
      const updateLevels = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray.slice(0, 20)).map((v) => v / 255);
        setAudioLevels(levels);
        animationRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError(getMicrophoneErrorMessage(err));
    }
  }, [maxDuration, stopRecording]);

  // Cancel recording
  const handleRetry = useCallback(() => {
    setError(null);
    startRecording();
  }, [startRecording]);

  const cancelRecording = useCallback(() => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  }, [stopRecording, audioUrl, onCancel]);

  // Send recording
  const sendRecording = useCallback(() => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, duration);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    }
  }, [audioBlob, duration, audioUrl, onRecordingComplete]);

  // Play/pause preview
  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Handle audio ended
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Auto-start recording on mount
  useEffect(() => {
    startRecording();
  }, [startRecording]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        background: colors.surface,
        borderRadius: "12px",
        border: `1px solid ${colors.border}`,
      }}
    >
      {error ? (
        // Error state
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ color: colors.danger, fontSize: "0.875rem" }}>{error}</div>
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              onClick={handleRetry}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: colors.accent,
                color: "#000",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Retry
            </button>
            <button
              onClick={cancelRecording}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: colors.textSecondary,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : audioUrl ? (
        // Preview state
        <>
          <audio ref={audioRef} src={audioUrl} />

          {/* Play/Pause button */}
          <button
            onClick={togglePlayback}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "none",
              background: colors.accent,
              color: "#000",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          {/* Waveform placeholder */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "2px", height: "32px" }}>
            {audioLevels.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${20 + (placeholderLevels[i] ?? 0.5) * 60}%`,
                  background: colors.accent,
                  borderRadius: "2px",
                  opacity: 0.6,
                }}
              />
            ))}
          </div>

          {/* Duration */}
          <span style={{ color: colors.text, fontSize: "0.875rem", fontWeight: 500, minWidth: "40px" }}>
            {formatDuration(duration)}
          </span>

          {/* Cancel button */}
          <button
            onClick={cancelRecording}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: colors.danger,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={18} />
          </button>

          {/* Send button */}
          <button
            onClick={sendRecording}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "none",
              background: colors.accent,
              color: "#000",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={18} />
          </button>
        </>
      ) : (
        // Recording state
        <>
          {/* Recording indicator */}
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: colors.danger,
              animation: "recordingPulse 1s ease-in-out infinite",
            }}
          />

          {/* Audio visualization */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "2px", height: "32px" }}>
            {audioLevels.map((level, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(10, level * 100)}%`,
                  background: colors.accent,
                  borderRadius: "2px",
                  transition: "height 0.05s",
                }}
              />
            ))}
          </div>

          {/* Duration */}
          <span style={{ color: colors.text, fontSize: "0.875rem", fontWeight: 500, minWidth: "40px" }}>
            {formatDuration(duration)}
          </span>

          {/* Cancel button */}
          <button
            onClick={cancelRecording}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={18} />
          </button>

          {/* Stop button */}
          <button
            onClick={stopRecording}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "none",
              background: colors.danger,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Square size={18} fill="#fff" />
          </button>

          <style>{`
            @keyframes recordingPulse {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
              }
              50% {
                opacity: 0.5;
                transform: scale(1.2);
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

export default VoiceRecorder;
