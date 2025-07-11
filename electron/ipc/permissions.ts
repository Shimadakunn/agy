import { ipcMain, systemPreferences, shell } from "electron";

export type PermissionStatus =
  | "granted"
  | "denied"
  | "not-determined"
  | "restricted"
  | "unknown";

export interface PermissionsState {
  microphone: PermissionStatus;
  accessibility: PermissionStatus;
  screenRecording: PermissionStatus;
}

function getAccessibilityStatus(): PermissionStatus {
  return systemPreferences.isTrustedAccessibilityClient(false)
    ? "granted"
    : "denied";
}

export function registerPermissionsHandlers(): void {
  ipcMain.handle(
    "check-permissions",
    (): PermissionsState => ({
      microphone: systemPreferences.getMediaAccessStatus(
        "microphone",
      ) as PermissionStatus,
      accessibility: getAccessibilityStatus(),
      screenRecording: systemPreferences.getMediaAccessStatus(
        "screen",
      ) as PermissionStatus,
    }),
  );

  ipcMain.handle("request-permission", async (_event, type: string) => {
    switch (type) {
      case "microphone":
        return systemPreferences.askForMediaAccess("microphone");
      case "accessibility":
        systemPreferences.isTrustedAccessibilityClient(true);
        return false;
      case "screenRecording":
        shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
        );
        return false;
      default:
        return false;
    }
  });
}
