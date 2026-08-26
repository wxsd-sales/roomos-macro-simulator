import { describe, expect, it } from "vitest";
import {
  describeBookingTiming,
  formatBookingRange,
  formatBookingTime,
  getCurrentBooking,
  getNextBooking,
  getUpcomingBookings,
  isActiveBooking,
  resolveRoomAvailability,
} from "../../src/modules/bookings/availability.ts";
import type { Booking } from "../../src/modules/types.ts";

/**
 * Surfaces render local wall-clock times, so fixtures are built from local
 * components to keep these assertions timezone independent.
 */
function at(hours: number, minutes = 0, dayOffset = 0): string {
  return new Date(2026, 3, 27 + dayOffset, hours, minutes, 0, 0).toISOString();
}

const NOW = new Date(at(10, 4));

function createBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    title: "Project planning",
    organizerName: "Umar Patel",
    organizerEmail: "umar@example.com",
    meetingPlatform: "Webex",
    number: "123456789@webex.com",
    protocol: "spark",
    startTime: at(10),
    endTime: at(11, 30),
    durationMinutes: 90,
    state: "started",
    ...overrides,
  };
}

describe("booking time formatting", () => {
  it("formats times as 24-hour clock values", () => {
    expect(formatBookingTime(at(14, 30))).toBe("14:30");
    expect(formatBookingRange(createBooking())).toBe("10:00 - 11:30");
  });

  it("falls back to a placeholder for unparseable times", () => {
    expect(formatBookingTime("not-a-date")).toBe("--:--");
  });
});

describe("booking selectors", () => {
  it("treats only in-window, unfinished bookings as active", () => {
    expect(isActiveBooking(createBooking(), NOW)).toBe(true);
    expect(isActiveBooking(createBooking({ state: "ended" }), NOW)).toBe(false);
    expect(
      isActiveBooking(createBooking({ startTime: at(12) }), NOW),
    ).toBe(false);
  });

  it("returns the earliest active booking as the current one", () => {
    const bookings = [
      createBooking({ id: "later", startTime: at(10, 2) }),
      createBooking({ id: "earlier", startTime: at(9, 30) }),
    ];

    expect(getCurrentBooking(bookings, NOW)?.id).toBe("earlier");
  });

  it("lists upcoming bookings for today only, earliest first", () => {
    const bookings = [
      createBooking({ id: "tomorrow", startTime: at(9, 0, 1), state: "scheduled" }),
      createBooking({ id: "late", startTime: at(16), state: "scheduled" }),
      createBooking({ id: "soon", startTime: at(14, 30), state: "scheduled" }),
      createBooking({ id: "ended", startTime: at(15), state: "ended" }),
    ];

    expect(getUpcomingBookings(bookings, NOW).map((booking) => booking.id)).toEqual(["soon", "late"]);
    expect(getNextBooking(bookings, NOW)?.id).toBe("soon");
  });

  it("describes timing relative to now", () => {
    expect(describeBookingTiming(createBooking(), NOW)).toBe("In progress");
    expect(
      describeBookingTiming(createBooking({ startTime: at(10, 9) }), NOW),
    ).toBe("Starting in 5 minutes");
    expect(
      describeBookingTiming(createBooking({ startTime: at(10, 5) }), NOW),
    ).toBe("Starting in 1 minute");
    expect(
      describeBookingTiming(createBooking({ startTime: at(14, 30) }), NOW),
    ).toBe("Starting at 14:30");
  });
});

describe("resolveRoomAvailability", () => {
  it("reports the room as available all day with no bookings", () => {
    expect(resolveRoomAvailability([], NOW)).toMatchObject({
      state: "available",
      headline: "Available all day",
      current: null,
      next: null,
      availableUntil: null,
    });
  });

  it("reports available until the next booking starts", () => {
    const next = createBooking({ startTime: at(14, 30), state: "scheduled" });

    expect(resolveRoomAvailability([next], NOW)).toMatchObject({
      state: "availableUntil",
      headline: "Available until 14:30",
      current: null,
      availableUntil: "14:30",
    });
  });

  it("reports the room as booked while a meeting is in progress", () => {
    const current = createBooking();
    const later = createBooking({
      id: "later",
      title: "Sprint planning",
      startTime: at(13),
      endTime: at(14),
      state: "scheduled",
    });

    const availability = resolveRoomAvailability([current, later], NOW);

    expect(availability).toMatchObject({
      state: "booked",
      headline: "Project planning",
      availableUntil: "11:30",
    });
    expect(availability.current?.id).toBe("booking-1");
    expect(availability.next?.id).toBe("later");
    expect(availability.upcomingToday).toHaveLength(1);
  });

  it("ignores bookings that already ended", () => {
    const ended = createBooking({ state: "ended" });
    expect(resolveRoomAvailability([ended], NOW).state).toBe("available");
  });
});
