import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import { AudioEncoding } from "@mistralai/mistralai/extra/realtime";
import type { RealtimeConnection } from "@mistralai/mistralai/extra/realtime";
import { mistral, realtimeClient } from "../ai.js";

let activeConnection: RealtimeConnection | null = null;
let audioChunks: Buffer[] = [];

function createWavBuffer(pcmData: Buffer): Uint8Array {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;

  const buffer = Buffer.alloc(headerSize + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  pcmData.copy(buffer, headerSize);

  return new Uint8Array(buffer);
}

export function registerTranscriptionHandlers(
  getAppWindow: () => BrowserWindow | null,
  getAgyWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("start-transcription", async () => {
    if (activeConnection && !activeConnection.isClosed)
      await activeConnection.close();

    audioChunks = [];

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
    const buf = Buffer.from(chunk);
    audioChunks.push(buf);
    if (activeConnection && !activeConnection.isClosed) {
      activeConnection.sendAudio(new Uint8Array(chunk)).catch((err) => {
        console.error("[realtime] Failed to send audio chunk:", err);
      });
    }
  });

  ipcMain.handle("stop-transcription", async () => {
    if (activeConnection && !activeConnection.isClosed)
      await activeConnection.endAudio();

    const chunks = audioChunks;
    audioChunks = [];

    if (chunks.length === 0) return;

    const pcmData = Buffer.concat(chunks);
    const wavData = createWavBuffer(pcmData);

    // Fire-and-forget: batch re-transcription runs in background,
    // result delivered via IPC events
    (async () => {
      const appWindow = getAppWindow();
      if (!appWindow) return;

      try {
        console.log("[batch] Starting batch transcription…");
        const result = await mistral.audio.transcriptions.complete({
          model: "voxtral-mini-latest",
          file: { fileName: "recording.wav", content: wavData },
        });
        console.log("[batch] Confirmed text:", result.text);
        appWindow.webContents.send("transcription-confirmed", result.text);
        getAgyWindow()?.webContents.send(
          "transcription-confirmed",
          result.text,
        );
      } catch (err) {
        console.error("[batch] Batch transcription failed, falling back:", err);
        appWindow.webContents.send("transcription-confirmed-error");
        getAgyWindow()?.webContents.send("transcription-confirmed-error");
      }
    })();
  });
}
