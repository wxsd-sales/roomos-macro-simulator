import type { Booking } from "../types.ts";

/**
 * Room availability as the RoomOS surfaces present it: free for the rest of the
 * day, free until the next booking claims the room, or currently booked.
 */
export type RoomAvailabilityState = "available" | "availableUntil" | "booked";

export interface RoomAvailability {
  state: RoomAvailabilityState;
  /** Primary line: "Available all day", "Available until 14:30", or the meeting title. */
  headline: string;
  /** The booking occupying the room right now, if any. */
  current: Booking | null;
  /** The next booking starting later today, if any. */
  next: Booking | null;
  /** `HH:mm` the room is free until, or null when it is free all day. */
  availableUntil: string | null;
  /** Every booking starting later today, earliest first. */
  upcomingToday: Booking[];
}

/** 24-hour formatting keeps the surfaces consistent regardless of host locale. */
const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function formatBookingTime(isoTime: string): string {
  const date = new Date(isoTime);
  return Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString("en-GB", TIME_FORMAT);
}

export function formatBookingRange(booking: Booking): string {
  return `${formatBookingTime(booking.startTime)} - ${formatBookingTime(booking.endTime)}`;
}

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function byStartTime(first: Booking, second: Booking): number {
  return new Date(first.startTime).getTime() - new Date(second.startTime).getTime();
}

/** True while `now` falls inside the booking window and it has not ended. */
export function isActiveBooking(booking: Booking, now: Date = new Date()): boolean {
  if (booking.state === "ended") {
    return false;
  }

  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  return start <= now && end > now;
}

export function getCurrentBooking(bookings: Booking[], now: Date = new Date()): Booking | null {
  return bookings.filter((booking) => isActiveBooking(booking, now)).sort(byStartTime)[0] ?? null;
}

/** Bookings that start later today, earliest first. */
export function getUpcomingBookings(bookings: Booking[], now: Date = new Date()): Booking[] {
  return bookings
    .filter((booking) => {
      if (booking.state === "ended") {
        return false;
      }
      const start = new Date(booking.startTime);
      return start > now && isSameDay(start, now);
    })
    .sort(byStartTime);
}

export function getNextBooking(bookings: Booking[], now: Date = new Date()): Booking | null {
  return getUpcomingBookings(bookings, now)[0] ?? null;
}

/** Whole minutes until a booking starts, rounded up so "in 0 minutes" never shows. */
export function getMinutesUntilStart(booking: Booking, now: Date = new Date()): number {
  const start = new Date(booking.startTime).getTime();
  return Math.max(0, Math.ceil((start - now.getTime()) / 60000));
}

/** Status line above a meeting title, mirroring the RoomOS wording. */
export function describeBookingTiming(booking: Booking, now: Date = new Date()): string {
  if (isActiveBooking(booking, now)) {
    return "In progress";
  }

  const minutes = getMinutesUntilStart(booking, now);
  if (minutes <= 60) {
    return `Starting in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `Starting at ${formatBookingTime(booking.startTime)}`;
}

export function resolveRoomAvailability(
  bookings: Booking[] = [],
  now: Date = new Date(),
): RoomAvailability {
  const current = getCurrentBooking(bookings, now);
  const upcomingToday = getUpcomingBookings(bookings, now);
  const next = upcomingToday[0] ?? null;

  if (current) {
    return {
      state: "booked",
      headline: current.title,
      current,
      next,
      availableUntil: formatBookingTime(current.endTime),
      upcomingToday,
    };
  }

  if (next) {
    const availableUntil = formatBookingTime(next.startTime);
    return {
      state: "availableUntil",
      headline: `Available until ${availableUntil}`,
      current: null,
      next,
      availableUntil,
      upcomingToday,
    };
  }

  return {
    state: "available",
    headline: "Available all day",
    current: null,
    next: null,
    availableUntil: null,
    upcomingToday,
  };
}
