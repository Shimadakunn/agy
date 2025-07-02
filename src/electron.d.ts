interface ToolExecutingPayload {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResultPayload {
  name: string;
  success: boolean;
  result: string;
}

interface Window {
  electron: {
    platform: NodeJS.Platform;
    transcribeAudio(buffer: ArrayBuffer): Promise<string>;
    chatWithMistral(prompt: string): Promise<void>;
    onChatChunk(callback: (chunk: string) => void): () => void;
    onToolExecuting(callback: (data: ToolExecutingPayload) => void): () => void;
    onToolResult(callback: (data: ToolResultPayload) => void): () => void;
  };
}
