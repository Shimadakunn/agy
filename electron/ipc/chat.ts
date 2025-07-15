import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import type { ChatCompletionStreamRequestMessages } from "@mistralai/mistralai/models/components/chatcompletionstreamrequest.js";
import type { ToolCall } from "@mistralai/mistralai/models/components/toolcall.js";
import {
  mistral,
  SYSTEM_PROMPT,
  MAX_AGENTIC_ITERATIONS,
  parseToolCallArgs,
} from "../ai.js";
import { toolDefinitions, executeTool } from "../tools.js";
import { captureContext } from "../context.js";

export function registerChatHandlers(
  getAppWindow: () => BrowserWindow | null,
  getAgyWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("chat-with-mistral", async (_event, prompt: string) => {
    const appWindow = getAppWindow();
    if (!appWindow || !prompt.trim()) return;

    const sendAgy = (channel: string, ...args: unknown[]) =>
      getAgyWindow()?.webContents.send(channel, ...args);

    const agyWin = getAgyWindow();
    if (agyWin && !agyWin.isDestroyed() && !agyWin.isVisible())
      agyWin.showInactive();

    sendAgy("glow-phase", "thinking");

    // Capture context (overlay is content-protected, won't appear in screenshot)
    const ctx = await captureContext();

    const messages: ChatCompletionStreamRequestMessages[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + ctx.text },
      {
        role: "user",
        content: [
          {
            type: "image_url" as const,
            imageUrl: {
              url: `data:image/png;base64,${ctx.screenshotBase64}`,
            },
          },
          { type: "text" as const, text: prompt },
        ],
      },
    ];

    try {
      for (let iteration = 0; iteration < MAX_AGENTIC_ITERATIONS; iteration++) {
        const stream = await mistral.chat.stream({
          model: "mistral-large-latest",
          messages,
          tools: toolDefinitions,
          toolChoice: "auto",
        });

        let textContent = "";
        const toolCalls: ToolCall[] = [];

        for await (const event of stream) {
          const choice = event.data?.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          if (typeof delta.content === "string" && delta.content) {
            textContent += delta.content;
            appWindow.webContents.send("chat-chunk", delta.content);
            sendAgy("chat-chunk", delta.content);
          }

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
              const argChunk =
                typeof tc.function.arguments === "string"
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments);
              toolCalls[idx].function.arguments =
                (toolCalls[idx].function.arguments as string) + argChunk;
            }
          }
        }

        if (toolCalls.length === 0) break;

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

        const toolResults = await Promise.all(
          toolCalls.map(async (tc) => {
            const args = parseToolCallArgs(tc.function.arguments);

            const payload = { name: tc.function.name, arguments: args };
            appWindow.webContents.send("tool-executing", payload);
            sendAgy("tool-executing", payload);

            const result = await executeTool(tc.function.name, args);

            appWindow.webContents.send("tool-result", result);

            return { toolCallId: tc.id!, result };
          }),
        );

        for (const { toolCallId, result } of toolResults) {
          messages.push({
            role: "tool",
            content: result.result,
            toolCallId,
            name: result.name,
          });
        }
      }
    } finally {
      sendAgy("glow-phase", "idle");
    }
  });
}
