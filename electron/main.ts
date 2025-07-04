import "dotenv/config";
import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Mistral } from "@mistralai/mistralai";
import type { ChatCompletionStreamRequestMessages } from "@mistralai/mistralai/models/components/chatcompletionstreamrequest.js";
import type { ToolCall } from "@mistralai/mistralai/models/components/toolcall.js";
import {
  AudioEncoding,
  RealtimeTranscription,
} from "@mistralai/mistralai/extra/realtime";
import type { RealtimeConnection } from "@mistralai/mistralai/extra/realtime";
import { toolDefinitions, executeTool } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let glowWindow: BrowserWindow | null = null;

const GLOW_HTML = /* html */ `<!DOCTYPE html>
<html>
<head>
<style>
  @property --glow-angle {
    syntax: "<angle>";
    initial-value: 0deg;
    inherits: false;
  }

  * { margin: 0; padding: 0; }

  body {
    background: transparent;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
  }

  .glow {
    position: fixed;
    inset: 0;
    opacity: 0;
    transition: opacity 500ms ease;
    --glow-size: 28px;
    --glow-spread: 90px;
    --glow-radius: 16px;
  }

  .glow.active { opacity: 1; }

  .glow::before,
  .glow::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--glow-radius);
    background: conic-gradient(
      from var(--glow-angle),
      #ff3366, #ff6633, #ffcc33, #33ff99,
      #33ccff, #6633ff, #cc33ff, #ff3366
    );
    mask:
      linear-gradient(#000, #000) content-box exclude,
      linear-gradient(#000, #000);
    padding: var(--glow-size);
    opacity: 0.5;
    animation: glow-spin 3s linear infinite;
  }

  .glow::after {
    filter: blur(var(--glow-spread));
    opacity: 0.35;
  }

  @keyframes glow-spin {
    to { --glow-angle: 360deg; }
  }
</style>
</head>
<body>
  <div class="glow" id="glow"></div>
  <script>
    window.electron.onRecordingGlow((active) => {
      document.getElementById("glow").classList.toggle("active", active);
    });
  </script>
</body>
</html>`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL)
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

function createGlowWindow() {
  const { x, y, width, height } = screen.getPrimaryDisplay().bounds;

  glowWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  glowWindow.setAlwaysOnTop(true, "screen-saver");
  glowWindow.setIgnoreMouseEvents(true);
  glowWindow.setVisibleOnAllWorkspaces(true);

  glowWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(GLOW_HTML)}`,
  );

  glowWindow.once("ready-to-show", () => glowWindow!.showInactive());

  glowWindow.on("closed", () => {
    glowWindow = null;
  });
}

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
});

const realtimeClient = new RealtimeTranscription({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
  serverURL: "wss://api.mistral.ai",
});

let activeConnection: RealtimeConnection | null = null;

const SYSTEM_PROMPT = `You are an AI desktop assistant running on macOS. You can control the user's computer using the provided tools.

When the user asks you to perform an action (open apps, manage files, control volume, etc.), use the appropriate tool. When the user asks a general question, respond with text only.

Be concise in your responses. After performing an action, briefly confirm what you did.`;

const MAX_AGENTIC_ITERATIONS = 10;

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
        if (!mainWindow) break;
        if (event.type === "transcription.text.delta" && "text" in event)
          mainWindow.webContents.send("transcription-delta", event.text);
        else if (event.type === "transcription.done" && "text" in event)
          mainWindow.webContents.send("transcription-done", event.text);
        else if (event.type === "error") {
          const msg =
            "error" in event && event.error
              ? typeof event.error.message === "string"
                ? event.error.message
                : JSON.stringify(event.error.message)
              : "Transcription error";
          mainWindow.webContents.send("transcription-error", msg);
          break;
        }
      }
    } catch (err) {
      mainWindow?.webContents.send(
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

function parseToolCallArgs(
  args: Record<string, unknown> | string,
): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return args;
}

ipcMain.handle("chat-with-mistral", async (_event, prompt: string) => {
  if (!mainWindow || !prompt.trim()) return;

  const messages: ChatCompletionStreamRequestMessages[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  for (let iteration = 0; iteration < MAX_AGENTIC_ITERATIONS; iteration++) {
    const stream = await mistral.chat.stream({
      model: "mistral-large-latest",
      messages,
      tools: toolDefinitions,
      toolChoice: "auto",
    });

    // Accumulate the full assistant response from stream deltas
    let textContent = "";
    const toolCalls: ToolCall[] = [];

    for await (const event of stream) {
      const choice = event.data?.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;

      // Accumulate text content and stream it to the UI
      if (typeof delta.content === "string" && delta.content) {
        textContent += delta.content;
        mainWindow.webContents.send("chat-chunk", delta.content);
      }

      // Accumulate tool call deltas
      if (delta.toolCalls) {
        for (const tc of delta.toolCalls) {
          const idx = tc.index ?? toolCalls.length;
          if (!toolCalls[idx]) {
            toolCalls[idx] = {
              id: tc.id,
              function: { name: "", arguments: "" },
              index: idx,
            };
          }
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function.name)
            toolCalls[idx].function.name += tc.function.name;
          // Accumulate arguments as string (streamed as fragments)
          const argChunk =
            typeof tc.function.arguments === "string"
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments);
          toolCalls[idx].function.arguments =
            (toolCalls[idx].function.arguments as string) + argChunk;
        }
      }
    }

    // No tool calls → text response is complete, we're done
    if (toolCalls.length === 0) break;

    // Append the assistant message with tool calls to history
    messages.push({
      role: "assistant",
      content: textContent || null,
      toolCalls: toolCalls.map((tc) => ({
        id: tc.id!,
        type: "function" as const,
        function: tc.function,
        index: tc.index!,
      })),
    });

    // Execute each tool call and collect results
    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        const args = parseToolCallArgs(tc.function.arguments);

        mainWindow!.webContents.send("tool-executing", {
          name: tc.function.name,
          arguments: args,
        });

        const result = await executeTool(tc.function.name, args);

        mainWindow!.webContents.send("tool-result", result);

        return { toolCallId: tc.id!, result };
      }),
    );

    // Append tool result messages for the next iteration
    for (const { toolCallId, result } of toolResults) {
      messages.push({
        role: "tool",
        content: result.result,
        toolCallId,
        name: result.name,
      });
    }

    // Loop continues — model will see tool results and decide next action
  }
});

ipcMain.handle("set-recording-glow", (_event, active: boolean) => {
  glowWindow?.webContents.send("recording-glow", active);
});

app.whenReady().then(() => {
  createWindow();
  createGlowWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createGlowWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    mainWindow = null;
  }
});

// Hot reload preload scripts
process.on("message", (msg) => {
  if (msg === "electron-vite&type=hot-reload") {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.reload();
    }
  }
});
