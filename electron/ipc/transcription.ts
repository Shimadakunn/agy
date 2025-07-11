import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import { AudioEncoding } from "@mistralai/mistralai/extra/realtime";
import type { RealtimeConnection } from "@mistralai/mistralai/extra/realtime";
import { mistral, realtimeClient } from "../ai.js";

let activeConnection: RealtimeConnection | null = null;
let audioChunks: Buffer[] = [];
let batchInterval: ReturnType<typeof setInterval> | null = null;
let batchInFlight = false;

const BATCH_INTERVAL_MS = 3000;

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

function sendBatch(
  getAppWindow: () => BrowserWindow | null,
  getAgyWindow: () => BrowserWindow | null,
  wavData: Uint8Array,
  isFinal: boolean,
) {
  mistral.audio.transcriptions
    .complete({
      model: "voxtral-mini-latest",
      file: { fileName: "recording.wav", content: wavData },
    })
    .then((result) => {
      batchInFlight = false;
      console.log(`[batch${isFinal ? " final" : ""}] Confirmed:`, result.text);
      getAppWindow()?.webContents.send(
        "transcription-confirmed",
        result.text,
        isFinal,
      );
      getAgyWindow()?.webContents.send(
        "transcription-confirmed",
        result.text,
        isFinal,
      );
    })
    .catch((err) => {
      batchInFlight = false;
      console.error(`[batch${isFinal ? " final" : ""}] Failed:`, err);
      if (isFinal) {
        getAppWindow()?.webContents.send("transcription-confirmed-error");
        getAgyWindow()?.webContents.send("transcription-confirmed-error");
      }
    });
}

function clearBatchInterval() {
  if (batchInterval) {
    clearInterval(batchInterval);
    batchInterval = null;
  }
  batchInFlight = false;
}

export function registerTranscriptionHandlers(
  getAppWindow: () => BrowserWindow | null,
  getAgyWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("start-transcription", async () => {
    if (activeConnection && !activeConnection.isClosed)
      await activeConnection.close();

    clearBatchInterval();
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

    // Periodic batch confirmations while recording
    batchInterval = setInterval(() => {
      if (audioChunks.length === 0 || batchInFlight) return;
      batchInFlight = true;
      const pcmData = Buffer.concat(audioChunks);
      const wavData = createWavBuffer(pcmData);
      sendBatch(getAppWindow, getAgyWindow, wavData, false);
    }, BATCH_INTERVAL_MS);
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
    clearBatchInterval();

    if (activeConnection && !activeConnection.isClosed)
      await activeConnection.endAudio();

    const chunks = audioChunks;
    audioChunks = [];

    if (chunks.length === 0) return;

    const pcmData = Buffer.concat(chunks);
    const wavData = createWavBuffer(pcmData);

    sendBatch(getAppWindow, getAgyWindow, wavData, true);
  });
}
