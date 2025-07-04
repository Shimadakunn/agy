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
    startTranscription(): Promise<void>;
    sendAudioChunk(buffer: ArrayBuffer): void;
    stopTranscription(): Promise<void>;
    onTranscriptionDelta(callback: (text: string) => void): () => void;
    onTranscriptionDone(callback: (text: string) => void): () => void;
    onTranscriptionError(callback: (error: string) => void): () => void;
    chatWithMistral(prompt: string): Promise<void>;
    setRecordingGlow(active: boolean): Promise<void>;
    onChatChunk(callback: (chunk: string) => void): () => void;
    onToolExecuting(callback: (data: ToolExecutingPayload) => void): () => void;
    onToolResult(callback: (data: ToolResultPayload) => void): () => void;
    onRecordingGlow(callback: (active: boolean) => void): () => void;
  };
}
