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

export function registerChatHandlers(
  getMainWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("chat-with-mistral", async (_event, prompt: string) => {
    const mainWindow = getMainWindow();
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

      let textContent = "";
      const toolCalls: ToolCall[] = [];

      for await (const event of stream) {
        const choice = event.data?.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (typeof delta.content === "string" && delta.content) {
          textContent += delta.content;
          mainWindow.webContents.send("chat-chunk", delta.content);
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

          mainWindow.webContents.send("tool-executing", {
            name: tc.function.name,
            arguments: args,
          });

          const result = await executeTool(tc.function.name, args);

          mainWindow.webContents.send("tool-result", result);

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
  });
}
