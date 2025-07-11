interface ToolExecutingPayload {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResultPayload {
  name: string;
  success: boolean;
  result: string;
}

interface HotkeyCapturedPayload {
  keycode: number;
  keyName: string;
}

type ThemeMode = "system" | "light" | "dark";

interface AppSettings {
  audio: {
    deviceId: string | null;
  };
  hotkey: {
    keycode: number;
    keyName: string;
    mode: "hold" | "toggle";
  };
  appearance: {
    theme: ThemeMode;
  };
}

type AppPermStatus =
  | "granted"
  | "denied"
  | "not-determined"
  | "restricted"
  | "unknown";

interface PermissionsState {
  microphone: AppPermStatus;
  accessibility: AppPermStatus;
  screenRecording: AppPermStatus;
}

interface Window {
  electron: {
    platform: NodeJS.Platform;

    // Transcription
    startTranscription(): Promise<void>;
    sendAudioChunk(buffer: ArrayBuffer): void;
    stopTranscription(): Promise<void>;
    onTranscriptionDelta(callback: (text: string) => void): () => void;
    onTranscriptionDone(callback: (text: string) => void): () => void;
    onTranscriptionConfirmed(callback: (text: string) => void): () => void;
    onTranscriptionConfirmedError(callback: () => void): () => void;
    onTranscriptionError(callback: (error: string) => void): () => void;

    // Chat
    chatWithMistral(prompt: string): Promise<void>;
    onChatChunk(callback: (chunk: string) => void): () => void;
    onToolExecuting(callback: (data: ToolExecutingPayload) => void): () => void;
    onToolResult(callback: (data: ToolResultPayload) => void): () => void;

    // Overlay
    setRecordingGlow(active: boolean): Promise<void>;
    onRecordingGlow(callback: (active: boolean) => void): () => void;
    onGlowPhase(callback: (phase: string) => void): () => void;
    hideOverlay(): void;

    // Push-to-talk
    onPushToTalkDown(callback: () => void): () => void;
    onPushToTalkUp(callback: () => void): () => void;

    // Settings
    getSettings(): Promise<AppSettings>;
    setAudioSettings(audio: AppSettings["audio"]): Promise<AppSettings>;
    setHotkeySettings(hotkey: AppSettings["hotkey"]): Promise<AppSettings>;
    startHotkeyCapture(): Promise<void>;
    cancelHotkeyCapture(): Promise<void>;
    onHotkeyCaptured(
      callback: (data: HotkeyCapturedPayload) => void,
    ): () => void;
    setAppearanceSettings(
      appearance: AppSettings["appearance"],
    ): Promise<AppSettings>;

    // Permissions
    checkPermissions(): Promise<PermissionsState>;
    requestPermission(type: string): Promise<boolean>;
  };
}
