import { contextBridge, ipcRenderer } from "electron";

type ToolExecutingPayload = {
  name: string;
  arguments: Record<string, unknown>;
};
type ToolResultPayload = { name: string; success: boolean; result: string };

function onIpc<T>(channel: string, callback: (data: T) => void) {
  const handler = (_event: Electron.IpcRendererEvent, data: T) =>
    callback(data);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  startTranscription: () => ipcRenderer.invoke("start-transcription"),
  sendAudioChunk: (buffer: ArrayBuffer) =>
    ipcRenderer.send("send-audio-chunk", buffer),
  stopTranscription: () => ipcRenderer.invoke("stop-transcription"),
  onTranscriptionDelta: (callback: (text: string) => void) =>
    onIpc("transcription-delta", callback),
  onTranscriptionDone: (callback: (text: string) => void) =>
    onIpc("transcription-done", callback),
  onTranscriptionError: (callback: (error: string) => void) =>
    onIpc("transcription-error", callback),
  chatWithMistral: (prompt: string) =>
    ipcRenderer.invoke("chat-with-mistral", prompt),
  setRecordingGlow: (active: boolean) =>
    ipcRenderer.invoke("set-recording-glow", active),
  onChatChunk: (callback: (chunk: string) => void) =>
    onIpc("chat-chunk", callback),
  onToolExecuting: (callback: (data: ToolExecutingPayload) => void) =>
    onIpc("tool-executing", callback),
  onToolResult: (callback: (data: ToolResultPayload) => void) =>
    onIpc("tool-result", callback),
  onRecordingGlow: (callback: (active: boolean) => void) =>
    onIpc("recording-glow", callback),
  onGlowPhase: (callback: (phase: string) => void) =>
    onIpc("glow-phase", callback),
  onPushToTalkDown: (callback: () => void) =>
    onIpc("push-to-talk-down", callback),
  onPushToTalkUp: (callback: () => void) => onIpc("push-to-talk-up", callback),
});
