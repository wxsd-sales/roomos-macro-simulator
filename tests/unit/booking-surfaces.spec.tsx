import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDeviceState } from "../../src/modules/devices/index.ts";
import { ControllerSurface } from "../../src/features/device/surfaces/ControllerSurface.tsx";
import { OsdSurface } from "../../src/features/device/surfaces/OsdSurface.tsx";
import { SchedulerSurface } from "../../src/features/device/surfaces/SchedulerSurface.tsx";
import type { Booking, DeviceState } from "../../src/modules/types.ts";

/**
 * Surfaces render local wall-clock times, so fixtures are built from local
 * components against a pinned clock to keep assertions stable.
 */
function at(hours: number, minutes = 0): string {
  return new Date(2026, 3, 27, hours, minutes, 0, 0).toISOString();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(at(10, 4)));
});

afterEach(() => {
  vi.useRealTimers();
});

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

function createDevice(bookings: Booking[]): DeviceState {
  return { ...createDefaultDeviceState(), workspaceName: "Queenshead", bookings };
}

function renderScheduler(bookings: Booking[]) {
  return render(<SchedulerSurface device={createDevice(bookings)} />).container;
}

function renderOsd(bookings: Booking[]) {
  return render(<OsdSurface device={createDevice(bookings)} onSelectPanel={() => {}} />).container;
}

function renderController(bookings: Booking[]) {
  return render(
    <ControllerSurface
      device={createDevice(bookings)}
      onSelectPanel={() => {}}
      onDismissAlert={() => {}}
    />,
  ).container;
}

describe("Room Scheduler availability", () => {
  it("shows the room as available all day with no bookings", () => {
    const container = renderScheduler([]);

    expect(container.querySelector("[data-scheduler-availability]")?.getAttribute("data-scheduler-availability")).toBe(
      "available",
    );
    expect(container.querySelector("[data-booking-state]")?.textContent).toBe("Available all day");
    expect(container.querySelector(".scheduler-primary-action")).toBeTruthy();
  });

  it("shows available until the next booking claims the room", () => {
    const container = renderScheduler([
      createBooking({ state: "scheduled", startTime: at(14, 30), endTime: at(15, 30) }),
    ]);

    expect(container.querySelector("[data-scheduler-availability]")?.getAttribute("data-scheduler-availability")).toBe(
      "availableUntil",
    );
    expect(container.querySelector("[data-booking-state]")?.textContent).toBe("Available until 14:30");
  });

  it("shows the in-progress meeting details and hides Book room when booked", () => {
    const container = renderScheduler([createBooking()]);

    expect(container.querySelector(".scheduler-stage")?.className).toContain("booked");
    expect(container.querySelector("[data-booking-state]")?.textContent).toBe("Project planning");
    expect(container.querySelector("[data-scheduler-meeting-timing]")?.textContent).toBe("In progress");
    expect(container.querySelector("[data-scheduler-meeting-organizer]")?.textContent).toBe(
      "Organizer: Umar Patel",
    );
    expect(container.querySelector("[data-scheduler-meeting-range]")?.textContent).toBe("10:00 - 11:30");
    expect(container.querySelector("[data-meeting-platform]")?.getAttribute("data-meeting-platform")).toBe("Webex");
    expect(container.querySelector(".scheduler-primary-action")).toBeNull();
    expect(container.querySelector(".scheduler-secondary-action")).toBeTruthy();
  });
});

describe("OSD availability banner", () => {
  it("invites the user to book when the room is free", () => {
    const container = renderOsd([]);

    expect(container.querySelector("[data-osd-availability]")?.getAttribute("data-osd-availability")).toBe(
      "available",
    );
    expect(container.querySelector("[data-osd-booking-state]")?.textContent).toBe("Room available all day");
    expect(container.querySelector(".osd-booking-action")).toBeTruthy();
  });

  it("shows the available-until time when a booking is due later today", () => {
    const container = renderOsd([
      createBooking({ state: "scheduled", startTime: at(14, 30), endTime: at(15, 30) }),
    ]);

    expect(container.querySelector("[data-osd-booking-state]")?.textContent).toBe("Available until 14:30");
  });

  it("shows the meeting in progress", () => {
    const container = renderOsd([createBooking()]);

    expect(container.querySelector("[data-osd-availability]")?.getAttribute("data-osd-availability")).toBe("booked");
    expect(container.querySelector("[data-osd-booking-state]")?.textContent).toBe("Project planning");
    expect(container.querySelector("[data-osd-booking-timing]")?.textContent).toBe("In progress");
    expect(container.querySelector("[data-osd-booking-range]")?.textContent).toBe("10:00 - 11:30");
    expect(container.querySelector(".osd-booking-action")).toBeNull();
  });
});

describe("Navigator meeting panel", () => {
  it("reports an empty calendar", () => {
    const container = renderController([]);

    expect(container.querySelector("[data-controller-booking-state]")?.textContent).toBe(
      "Room available all day",
    );
    expect(container.querySelector("[data-controller-booking-more]")).toBeNull();
  });

  it("features the meeting in progress and counts the rest of the day", () => {
    const container = renderController([
      createBooking(),
      createBooking({ id: "later", title: "Sprint planning", state: "scheduled", startTime: at(12), endTime: at(12, 30) }),
      createBooking({ id: "latest", title: "UX review", state: "scheduled", startTime: at(14), endTime: at(14, 30) }),
    ]);

    expect(container.querySelector("[data-controller-availability]")?.getAttribute("data-controller-availability")).toBe(
      "booked",
    );
    expect(container.querySelector("[data-controller-booking-state]")?.textContent).toBe("Project planning");
    expect(container.querySelector("[data-controller-booking-timing]")?.textContent).toBe("In progress");
    expect(container.querySelector("[data-controller-booking-organizer]")?.textContent).toBe(
      "Organizer: Umar Patel",
    );
    expect(container.querySelector("[data-controller-booking-range]")?.textContent).toBe("10:00 - 11:30");
    expect(container.querySelector("[data-controller-booking-more]")?.textContent).toContain("2 more meetings today");
  });

  it("features the next booking and excludes it from the remaining count", () => {
    const container = renderController([
      createBooking({ state: "scheduled", startTime: at(12), endTime: at(12, 30) }),
      createBooking({ id: "later", title: "Sprint planning", state: "scheduled", startTime: at(14), endTime: at(14, 30) }),
    ]);

    expect(container.querySelector("[data-controller-booking-state]")?.textContent).toBe("Project planning");
    expect(container.querySelector("[data-controller-booking-more]")?.textContent).toContain("1 more meeting today");
  });
});
