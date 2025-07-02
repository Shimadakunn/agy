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
  transcribeAudio: (buffer: ArrayBuffer) =>
    ipcRenderer.invoke("transcribe-audio", buffer),
  chatWithMistral: (prompt: string) =>
    ipcRenderer.invoke("chat-with-mistral", prompt),
  onChatChunk: (callback: (chunk: string) => void) =>
    onIpc("chat-chunk", callback),
  onToolExecuting: (callback: (data: ToolExecutingPayload) => void) =>
    onIpc("tool-executing", callback),
  onToolResult: (callback: (data: ToolResultPayload) => void) =>
    onIpc("tool-result", callback),
});
