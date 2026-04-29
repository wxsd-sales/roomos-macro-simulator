import type { AddLog, Booking, DeviceState } from "../../types.ts";

type XapiPayload = Record<string, unknown>;
type EmitEvent = (path: string, payload: unknown) => void;
type PublishStatus = (path: string, value: unknown) => void;

interface CreateBookingsHandlerOptions {
  device: DeviceState;
  addLog: AddLog;
  emitEvent: EmitEvent;
  publishStatus: PublishStatus;
}

function toPayload(value: unknown): XapiPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as XapiPayload : {};
}

export const BOOKING_COMMAND_PATHS = new Set(["Bookings.Book", "Bookings.List"]);

const AVAILABILITY_STATUS_PATH = "Bookings.Availability.Status";
const AVAILABILITY_TIMESTAMP_PATH = "Bookings.Availability.TimeStamp";

function createBookingId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `booking-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function toStringValue(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function toDurationMinutes(value: unknown): number {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : 30;
}

function parseStartTime(payload: XapiPayload): Date {
  const explicitStart = payload.StartTime ?? payload.TimeStamp ?? payload.Start;
  if (explicitStart) {
    const start = new Date(String(explicitStart));
    if (!Number.isNaN(start.getTime())) {
      return start;
    }
  }
  return new Date();
}

function getBookingPayload(booking: Booking): Record<string, unknown> {
  return {
    BookingId: booking.id,
    Id: booking.id,
    Title: booking.title,
    OrganizerName: booking.organizerName,
    OrganizerEmail: booking.organizerEmail,
    MeetingPlatform: booking.meetingPlatform,
    Number: booking.number,
    Protocol: booking.protocol,
    StartTime: booking.startTime,
    EndTime: booking.endTime,
    Duration: booking.durationMinutes,
    State: booking.state,
  };
}

function getCurrentBooking(device: DeviceState, now = new Date()): Booking | null {
  return (
    device.bookings.find((booking) => {
      if (booking.state === "ended") {
        return false;
      }

      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      return start <= now && end > now;
    }) ?? null
  );
}

function getNextBooking(device: DeviceState, now = new Date()): Booking | null {
  return (
    device.bookings
      .filter((booking) => booking.state !== "ended" && new Date(booking.startTime) > now)
      .sort((first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime())[0] ?? null
  );
}

function schedule(callback: () => void, delayMs: number): void {
  const timer = setTimeout(callback, Math.max(0, delayMs));
  const nodeTimer = timer as unknown as { unref?: () => void };
  nodeTimer.unref?.();
}

export function createBookingsCommandHandler({
  device,
  addLog,
  emitEvent,
  publishStatus,
}: CreateBookingsHandlerOptions) {
  function publishAvailability(): void {
    const currentBooking = getCurrentBooking(device);
    publishStatus(AVAILABILITY_STATUS_PATH, currentBooking ? "Busy" : "Available");
    publishStatus(AVAILABILITY_TIMESTAMP_PATH, new Date().toISOString());
  }

  function updateSchedulerFromBookings(): void {
    const currentBooking = getCurrentBooking(device);
    const nextBooking = getNextBooking(device);

    if (currentBooking) {
      device.scheduler = {
        ...device.scheduler,
        busy: true,
        title: currentBooking.title,
        subtitle: "Meeting in progress",
        nextMeeting: nextBooking?.title ?? "Not scheduled",
        presenter: currentBooking.organizerName,
        progress: 0,
      };
      return;
    }

    device.scheduler = {
      ...device.scheduler,
      busy: false,
      title: "Focus Room 3A",
      subtitle: "No active booking",
      nextMeeting: nextBooking?.title ?? "Not scheduled",
      presenter: "Awaiting macro input",
      progress: 0,
    };
  }

  function startBooking(booking: Booking): void {
    if (booking.state !== "scheduled") {
      return;
    }

    booking.state = "started";
    updateSchedulerFromBookings();
    publishAvailability();
    emitEvent("Bookings.Start", getBookingPayload(booking));
    addLog(`Booking started: ${booking.title}`, "success");
  }

  function endBooking(booking: Booking): void {
    if (booking.state === "ended") {
      return;
    }

    booking.state = "ended";
    updateSchedulerFromBookings();
    publishAvailability();
    emitEvent("Bookings.End", getBookingPayload(booking));
    addLog(`Booking ended: ${booking.title}`, "success");
  }

  function scheduleBookingLifecycle(booking: Booking): void {
    const now = Date.now();
    const startMs = new Date(booking.startTime).getTime();
    const endMs = new Date(booking.endTime).getTime();

    if (startMs <= now) {
      startBooking(booking);
    } else {
      schedule(() => startBooking(booking), startMs - now);
    }

    if (endMs <= now) {
      endBooking(booking);
    } else {
      schedule(() => endBooking(booking), endMs - now);
    }
  }

  function book(payload: XapiPayload = {}): Record<string, unknown> {
    const start = parseStartTime(payload);
    const durationMinutes = toDurationMinutes(payload.Duration);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const booking: Booking = {
      id: createBookingId(),
      title: toStringValue(payload.Title, "Untitled booking"),
      organizerName: toStringValue(payload.OrganizerName, "Unknown organizer"),
      organizerEmail: toStringValue(payload.OrganizerEmail, ""),
      meetingPlatform: toStringValue(payload.MeetingPlatform, "Unknown"),
      number: toStringValue(payload.Number, ""),
      protocol: toStringValue(payload.Protocol, ""),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      state: "scheduled",
    };

    device.bookings.push(booking);
    device.bookings.sort(
      (first, second) => new Date(first.startTime).getTime() - new Date(second.startTime).getTime(),
    );

    addLog(`Booked ${booking.title} until ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`, "success");
    scheduleBookingLifecycle(booking);
    publishAvailability();

    return getBookingPayload(booking);
  }

  function list(): Record<string, unknown>[] {
    return device.bookings.map(getBookingPayload);
  }

  function handle(path: string, args: unknown[] = []): unknown {
    const payload = toPayload(args[0]);

    switch (path) {
      case "Bookings.Book":
        return book(payload);
      case "Bookings.List":
        return list();
      default:
        return undefined;
    }
  }

  function getStatus(path: string): unknown {
    switch (path) {
      case AVAILABILITY_STATUS_PATH:
        return getCurrentBooking(device) ? "Busy" : "Available";
      case AVAILABILITY_TIMESTAMP_PATH:
        return new Date().toISOString();
      default:
        return undefined;
    }
  }

  return {
    canHandle(path: string): boolean {
      return BOOKING_COMMAND_PATHS.has(path);
    },
    handle,
    getStatus,
  };
}
