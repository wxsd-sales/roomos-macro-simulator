import { createDefaultMeetingState } from "../meetings/providers.ts";
import type { DeviceRuntime, DeviceState, DeviceStateOverrides } from "../types.ts";

export function createDefaultDeviceState(overrides: DeviceStateOverrides = {}): DeviceState {
  const { meeting, scheduler, ...deviceOverrides } = overrides;

  return {
    alert: null,
    panels: [],
    activePanel: "Home",
    workspaceName: "Workspace Name",
    bookings: [],
    ...deviceOverrides,
    meeting: createDefaultMeetingState(meeting),
    scheduler: {
      busy: false,
      title: "Focus Room 3A",
      subtitle: "No active booking",
      nextMeeting: "Not scheduled",
      presenter: "Awaiting macro input",
      progress: 0,
      ...scheduler,
    },
  };
}

export function createDeviceRuntime({
  initialState,
}: { initialState?: DeviceStateOverrides } = {}): DeviceRuntime {
  let state = createDefaultDeviceState(initialState);

  return {
    getState() {
      return state;
    },
    reset(nextState = {}) {
      state = createDefaultDeviceState(nextState);
      return state;
    },
    update(mutator) {
      mutator(state);
      return state;
    },
  };
}
