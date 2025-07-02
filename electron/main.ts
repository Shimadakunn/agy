import "dotenv/config";
import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Mistral } from "@mistralai/mistralai";
import type { ChatCompletionStreamRequestMessages } from "@mistralai/mistralai/models/components/chatcompletionstreamrequest.js";
import type { ToolCall } from "@mistralai/mistralai/models/components/toolcall.js";
import { toolDefinitions, executeTool } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

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

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
});

const SYSTEM_PROMPT = `You are an AI desktop assistant running on macOS. You can control the user's computer using the provided tools.

When the user asks you to perform an action (open apps, manage files, control volume, etc.), use the appropriate tool. When the user asks a general question, respond with text only.

Be concise in your responses. After performing an action, briefly confirm what you did.`;

const MAX_AGENTIC_ITERATIONS = 10;

ipcMain.handle("transcribe-audio", async (_event, audioBuffer: ArrayBuffer) => {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `recording-${Date.now()}.webm`);
  await fs.writeFile(filePath, new Uint8Array(audioBuffer));
  console.log("[transcribe] Audio saved to:", filePath);

  const response = await mistral.audio.transcriptions.complete({
    model: "voxtral-mini-latest",
    file: {
      fileName: "recording.webm",
      content: new Uint8Array(audioBuffer),
    },
  });
  return response.text;
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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
