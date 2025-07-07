import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import { AudioEncoding } from "@mistralai/mistralai/extra/realtime";
import type { RealtimeConnection } from "@mistralai/mistralai/extra/realtime";
import { realtimeClient } from "../ai.js";

let activeConnection: RealtimeConnection | null = null;

export function registerTranscriptionHandlers(
  getAppWindow: () => BrowserWindow | null,
  getAgyWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("start-transcription", async () => {
    if (activeConnection && !activeConnection.isClosed)
      await activeConnection.close();

    activeConnection = await realtimeClient.connect(
      "voxtral-mini-transcribe-realtime-2602",
      {
        audioFormat: {
          encoding: AudioEncoding.PcmS16le,
          sampleRate: 16000,
        },
      },
    );

    const conn = activeConnection;
    (async () => {
      try {
        for await (const event of conn) {
          const appWindow = getAppWindow();
          if (!appWindow) break;
          if (event.type === "transcription.text.delta" && "text" in event) {
            appWindow.webContents.send("transcription-delta", event.text);
            getAgyWindow()?.webContents.send("transcription-delta", event.text);
          } else if (event.type === "transcription.done" && "text" in event)
            appWindow.webContents.send("transcription-done", event.text);
          else if (event.type === "error") {
            const msg =
              "error" in event && event.error
                ? typeof event.error.message === "string"
                  ? event.error.message
                  : JSON.stringify(event.error.message)
                : "Transcription error";
            appWindow.webContents.send("transcription-error", msg);
            break;
          }
        }
      } catch (err) {
        getAppWindow()?.webContents.send(
          "transcription-error",
          err instanceof Error ? err.message : "Transcription failed",
        );
      } finally {
        if (!conn.isClosed) await conn.close();
        if (activeConnection === conn) activeConnection = null;
      }
    })();
  });

  ipcMain.on("send-audio-chunk", (_event, chunk: ArrayBuffer) => {
    if (activeConnection && !activeConnection.isClosed) {
      activeConnection.sendAudio(new Uint8Array(chunk)).catch((err) => {
        console.error("[realtime] Failed to send audio chunk:", err);
      });
    }
  });

  ipcMain.handle("stop-transcription", async () => {
    if (activeConnection && !activeConnection.isClosed)
      await activeConnection.endAudio();
  });
}
