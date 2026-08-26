import type { AddLog, DeviceState } from "../../types.ts";

type XapiPayload = Record<string, unknown>;
type PublishStatus = (path: string, value: unknown) => void;

interface CreateCallHandlerOptions {
  device: DeviceState;
  addLog: AddLog;
  publishStatus: PublishStatus;
}

export const CALL_COMMAND_PATHS = new Set([
  "Call.Accept",
  "Call.Disconnect",
  "Dial",
]);

/** RoomOS exposes call state under the indexed `Call[n]` status branch. */
const CALL_STATUS_PATH = "Call.1.Status";
const CALL_REMOTE_NUMBER_PATH = "Call.1.RemoteNumber";

function toPayload(value: unknown): XapiPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as XapiPayload : {};
}

function toStringValue(value: unknown, fallback = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

/**
 * Minimal call simulation. It exists so UI extension panels placed on
 * `CallControls` and `HomeScreenAndCallControls` can be exercised: entering a
 * call swaps the home-screen panels for the call-control ones.
 */
export function createCallCommandHandler({
  device,
  addLog,
  publishStatus,
}: CreateCallHandlerOptions) {
  function setCallActive(active: boolean, remoteNumber: string): void {
    device.call = { active, remoteNumber: active ? remoteNumber : "" };
    publishStatus(CALL_STATUS_PATH, active ? "Connected" : "Idle");
    publishStatus(CALL_REMOTE_NUMBER_PATH, device.call.remoteNumber);
  }

  function dial(payload: XapiPayload): Record<string, unknown> {
    const remoteNumber = toStringValue(payload.Number ?? payload.Destination, "unknown");
    setCallActive(true, remoteNumber);
    addLog(`Call connected to ${remoteNumber}.`, "success");
    return { CallId: 1, ConferenceId: 1, Status: "Connected" };
  }

  function accept(): Record<string, unknown> {
    setCallActive(true, device.call.remoteNumber || "incoming");
    addLog("Incoming call accepted.", "success");
    return { Status: "Connected" };
  }

  function disconnect(): Record<string, unknown> {
    const wasActive = device.call.active;
    setCallActive(false, "");
    addLog(
      wasActive ? "Call disconnected." : "No active call to disconnect.",
      wasActive ? "success" : "warn",
    );
    return { Status: "Idle" };
  }

  return {
    canHandle(path: string): boolean {
      return CALL_COMMAND_PATHS.has(path);
    },
    handle(path: string, args: unknown[] = []): unknown {
      const payload = toPayload(args[0]);

      switch (path) {
        case "Dial":
          return dial(payload);
        case "Call.Accept":
          return accept();
        case "Call.Disconnect":
          return disconnect();
        default:
          return undefined;
      }
    },
    getStatus(path: string): unknown {
      switch (path) {
        case CALL_STATUS_PATH:
          return device.call.active ? "Connected" : "Idle";
        case CALL_REMOTE_NUMBER_PATH:
          return device.call.remoteNumber;
        default:
          return undefined;
      }
    },
  };
}
