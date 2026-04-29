export type LogLevel = "error" | "warn" | "info" | "log" | "debug" | "success";
export type LogSeverityLevel = Exclude<LogLevel, "success">;

export type AddLog = (message: string, level?: LogLevel) => void;
export type RenderDevice = () => void;

export interface DeviceAlert {
  title: string;
  text: string;
}

export interface DevicePanel {
  id: string;
  name: string;
  activityType: string;
  icon?: string;
  location?: string;
  rawXml?: string;
}

export type MeetingProvider =
  | "webex"
  | "microsoftTeams"
  | "microsoftCvi"
  | "microsoftVimt"
  | "zoomCsrSip"
  | "zoomEnhanced";

export type MeetingJoinState = "idle" | "scheduled" | "joining" | "joined" | "failed";

export interface MeetingState {
  provider: MeetingProvider;
  joinState: MeetingJoinState;
  meetingTitle: string;
  meetingStartTime: string | null;
  meetingEndTime: string | null;
}

export interface SchedulerState {
  busy: boolean;
  title: string;
  subtitle: string;
  nextMeeting: string;
  presenter: string;
  progress: number;
}

export interface Booking {
  id: string;
  title: string;
  organizerName: string;
  organizerEmail: string;
  meetingPlatform: string;
  number: string;
  protocol: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  state: "scheduled" | "started" | "ended";
}

export interface DeviceState {
  alert: DeviceAlert | null;
  panels: DevicePanel[];
  activePanel: string;
  workspaceName: string;
  meeting: MeetingState;
  scheduler: SchedulerState;
  bookings: Booking[];
}

export type DeviceStateOverrides = Partial<Omit<DeviceState, "meeting" | "scheduler">> & {
  meeting?: Partial<MeetingState>;
  scheduler?: Partial<SchedulerState>;
};

export interface DeviceRuntime {
  getState(): DeviceState;
  reset(nextState?: DeviceStateOverrides): DeviceState;
  update(mutator: (device: DeviceState) => void): DeviceState;
}

export type DeviceSurface = "osd" | "controller" | "scheduler";

export interface DeviceProfile {
  productId: string;
  productName: string;
  mode: string;
  surfaces: DeviceSurface[];
}

export interface DeviceFixture extends DeviceProfile {
  id: string;
  state: DeviceState;
}

export interface DeviceSnapshot {
  id: string;
  profile: DeviceProfile;
  state: DeviceState;
}

export interface DeviceInstance {
  id: string;
  profile: DeviceProfile;
  runtime: DeviceRuntime;
  getSnapshot(): DeviceSnapshot;
}

export interface AppFile {
  id: string;
  name: string;
  content: string;
  deviceContent: string;
  enabled: boolean;
}

export interface RuntimeLog {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
}

export interface AppState {
  files: AppFile[];
  activeFileId: string | null;
  openFileMenuId: string | null;
  helpVisible: boolean;
  logVisible: boolean;
  macroSidebarVisible: boolean;
  logs: RuntimeLog[];
  logFilterText: string;
  logSeverityMenuOpen: boolean;
  logSeverityLevels: Set<LogSeverityLevel>;
  device: DeviceState;
}

export interface DeviceRendererAdapter {
  render(device: DeviceState): void;
}
