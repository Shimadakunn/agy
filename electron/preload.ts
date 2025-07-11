import { contextBridge, ipcRenderer } from "electron";

type ToolExecutingPayload = {
  name: string;
  arguments: Record<string, unknown>;
};
type ToolResultPayload = { name: string; success: boolean; result: string };
type HotkeyCapturedPayload = { keycode: number; keyName: string };

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

  // Transcription
  startTranscription: () => ipcRenderer.invoke("start-transcription"),
  sendAudioChunk: (buffer: ArrayBuffer) =>
    ipcRenderer.send("send-audio-chunk", buffer),
  stopTranscription: () => ipcRenderer.invoke("stop-transcription"),
  onTranscriptionDelta: (callback: (text: string) => void) =>
    onIpc("transcription-delta", callback),
  onTranscriptionDone: (callback: (text: string) => void) =>
    onIpc("transcription-done", callback),
  onTranscriptionConfirmed: (
    callback: (text: string, isFinal: boolean) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      text: string,
      isFinal: boolean,
    ) => callback(text, isFinal);
    ipcRenderer.on("transcription-confirmed", handler);
    return () => {
      ipcRenderer.removeListener("transcription-confirmed", handler);
    };
  },
  onTranscriptionConfirmedError: (callback: () => void) =>
    onIpc("transcription-confirmed-error", callback),
  onTranscriptionError: (callback: (error: string) => void) =>
    onIpc("transcription-error", callback),

  // Chat
  chatWithMistral: (prompt: string) =>
    ipcRenderer.invoke("chat-with-mistral", prompt),
  onChatChunk: (callback: (chunk: string) => void) =>
    onIpc("chat-chunk", callback),
  onToolExecuting: (callback: (data: ToolExecutingPayload) => void) =>
    onIpc("tool-executing", callback),
  onToolResult: (callback: (data: ToolResultPayload) => void) =>
    onIpc("tool-result", callback),

  // Overlay
  setRecordingGlow: (active: boolean) =>
    ipcRenderer.invoke("set-recording-glow", active),
  onRecordingGlow: (callback: (active: boolean) => void) =>
    onIpc("recording-glow", callback),
  onGlowPhase: (callback: (phase: string) => void) =>
    onIpc("glow-phase", callback),
  hideOverlay: () => ipcRenderer.send("hide-overlay"),

  // Push-to-talk
  onPushToTalkDown: (callback: () => void) =>
    onIpc("push-to-talk-down", callback),
  onPushToTalkUp: (callback: () => void) => onIpc("push-to-talk-up", callback),

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  setAudioSettings: (audio: { deviceId: string | null }) =>
    ipcRenderer.invoke("set-audio-settings", audio),
  setHotkeySettings: (hotkey: {
    keycode: number;
    keyName: string;
    mode: "hold" | "toggle";
  }) => ipcRenderer.invoke("set-hotkey-settings", hotkey),
  startHotkeyCapture: () => ipcRenderer.invoke("start-hotkey-capture"),
  cancelHotkeyCapture: () => ipcRenderer.invoke("cancel-hotkey-capture"),
  onHotkeyCaptured: (callback: (data: HotkeyCapturedPayload) => void) =>
    onIpc("hotkey-captured", callback),
  setAppearanceSettings: (appearance: { theme: "system" | "light" | "dark" }) =>
    ipcRenderer.invoke("set-appearance-settings", appearance),

  // Permissions
  checkPermissions: () => ipcRenderer.invoke("check-permissions"),
  requestPermission: (type: string) =>
    ipcRenderer.invoke("request-permission", type),
});
