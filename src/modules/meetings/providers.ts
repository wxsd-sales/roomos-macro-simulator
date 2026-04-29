import type { MeetingJoinState, MeetingProvider, MeetingState } from "../types.ts";

export const MEETING_PROVIDERS = Object.freeze({
  webex: "webex",
  microsoftTeams: "microsoftTeams",
  microsoftCvi: "microsoftCvi",
  microsoftVimt: "microsoftVimt",
  zoomCsrSip: "zoomCsrSip",
  zoomEnhanced: "zoomEnhanced",
} satisfies Record<string, MeetingProvider>);

export const MEETING_JOIN_STATES = Object.freeze({
  idle: "idle",
  scheduled: "scheduled",
  joining: "joining",
  joined: "joined",
  failed: "failed",
} satisfies Record<string, MeetingJoinState>);

export function createDefaultMeetingState(overrides: Partial<MeetingState> = {}): MeetingState {
  return {
    provider: MEETING_PROVIDERS.webex,
    joinState: MEETING_JOIN_STATES.idle,
    meetingTitle: "",
    meetingStartTime: null,
    meetingEndTime: null,
    ...overrides,
  };
}
