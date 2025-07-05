import { useCallback, useRef } from "react";
import { float32ToPcmS16le } from "@/lib/audio";
import type { Status } from "@/components/transcription/types";

export function useAudioRecording(
  selectedDeviceId: string | null,
  setStatus: (status: Status) => void,
  setError: (error: string | null) => void,
  setTranscript: (transcript: string) => void,
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const cleanupAudio = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");

    const audioConstraints: MediaTrackConstraints = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId } }
      : {};

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
    } catch {
      setError(
        "Microphone access denied. Please allow microphone permissions.",
      );
      return;
    }

    streamRef.current = stream;

    try {
      await window.electron.startTranscription();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start transcription",
      );
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      window.electron.sendAudioChunk(float32ToPcmS16le(input));
    };

    source.connect(processor);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    setStatus("recording");
    window.electron.setRecordingGlow(true);
  }, [selectedDeviceId, cleanupAudio, setError, setTranscript, setStatus]);

  const stopRecording = useCallback(async () => {
    cleanupAudio();
    window.electron.setRecordingGlow(false);
    setStatus("finalizing");
    await window.electron.stopTranscription();
  }, [cleanupAudio, setStatus]);

  return { startRecording, stopRecording };
}
