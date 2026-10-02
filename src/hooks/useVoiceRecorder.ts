import { useCallback, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

export interface UseVoiceRecorderResult {
  status: RecorderStatus;
  durationSeconds: number;
  audioUrl: string | null;
  errorMessage: string | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    setErrorMessage(null);
    setAudioUrl(null);
    setDurationSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stopTracks();
      };

      recorder.start();
      setStatus('recording');
      intervalRef.current = window.setInterval(() => {
        setDurationSeconds(d => d + 1);
      }, 1000);
    } catch {
      setErrorMessage('Microphone access unavailable or denied. Switch to text note entry instead.');
      setStatus('error');
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.pause();
      clearTimer();
      setStatus('paused');
    }
  }, [status]);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current && status === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
      intervalRef.current = window.setInterval(() => {
        setDurationSeconds(d => d + 1);
      }, 1000);
    }
  }, [status]);

  const stop = useCallback(() => {
    clearTimer();
    if (mediaRecorderRef.current && (status === 'recording' || status === 'paused')) {
      mediaRecorderRef.current.stop();
    }
    setStatus('stopped');
  }, [status]);

  const reset = useCallback(() => {
    clearTimer();
    stopTracks();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setStatus('idle');
    setDurationSeconds(0);
    setAudioUrl(null);
    setErrorMessage(null);
  }, []);

  return { status, durationSeconds, audioUrl, errorMessage, start, pause, resume, stop, reset };
}
