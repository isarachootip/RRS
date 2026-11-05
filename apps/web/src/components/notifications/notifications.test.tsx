import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationRulesTab } from "@/components/settings/notification-rules-tab";
import { NotificationBell } from "./notification-bell";
import { NotificationsView } from "./notifications-view";

const apiMock = vi.fn();

vi.mock("@/lib/api", () => ({
  API_URL: "http://localhost:4000",
  api: (...args: unknown[]) => apiMock(...args),
  getAccessToken: () => null,
}));

const sampleNotifications = {
  unreadCount: 2,
  items: [
    {
      id: "n-1",
      event: "appointment.reminder",
      title: "เตือนนัดดูห้อง AP-0001 (อีก 2 ชั่วโมง)",
      body: "ลูกค้า: คุณสมชาย สถานที่: ล็อบบี้",
      link: "/appointments",
      delivery: { IN_APP: "sent", LINE: "sent" },
      readAt: null,
      createdAt: "2026-11-10T08:00:00.000Z",
    },
  ],
};

const samplePrefs = {
  lineUserId: "U1234567890",
  preferences: { "appointment.reminder": ["IN_APP", "LINE"] },
  rules: [
    {
      id: "r-1",
      event: "appointment.reminder",
      description: "ใกล้ถึงเวลานัดดูห้อง",
      isEnabled: true,
      recipients: ["APPOINTMENT_AGENT", "APPOINTMENT_COORDINATOR"],
      timing: { minutesBefore: [1440, 120] },
      channels: ["IN_APP", "LINE"],
      updatedAt: "2026-11-10T00:00:00.000Z",
    },
  ],
};

describe("Notifications UI (P17)", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders NotificationBell with unread badge and opens dropdown to mark all read", async () => {
    apiMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/v1/notifications")) return Promise.resolve(sampleNotifications);
      return Promise.resolve({});
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId("notification-unread-badge").textContent).toBe("2");
    });

    fireEvent.click(screen.getByTestId("notification-bell"));

    await waitFor(() => {
      expect(screen.getByTestId("notification-dropdown")).toBeTruthy();
    });
    expect(screen.getByText(/เตือนนัดดูห้อง AP-0001/)).toBeTruthy();

    fireEvent.click(screen.getByText("อ่านทั้งหมด"));
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/api/v1/notifications/read-all", { method: "POST" });
    });
  });

  it("renders NotificationsView preferences tab, links LINE account, and toggles channel preference", async () => {
    apiMock.mockImplementation((url: string) => {
      if (url === "/api/v1/notifications/preferences") return Promise.resolve(samplePrefs);
      if (url.startsWith("/api/v1/notifications")) return Promise.resolve(sampleNotifications);
      return Promise.resolve({});
    });

    render(<NotificationsView />);

    await waitFor(() => {
      expect(screen.getByText(/รายการแจ้งเตือน/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText("ผูก LINE & ตั้งค่าช่องทาง"));

    await waitFor(() => {
      expect(screen.getByLabelText("LINE User ID")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("LINE User ID"), { target: { value: "U999999" } });
    fireEvent.click(screen.getByText("ผูกบัญชี LINE"));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/api/v1/notifications/line/link",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByLabelText("appointment.reminder-EMAIL"));
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/api/v1/notifications/preferences",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("renders NotificationRulesTab for Admin and updates notification_rules", async () => {
    apiMock.mockImplementation((url: string) => {
      if (url === "/api/v1/notifications/rules") return Promise.resolve({ items: samplePrefs.rules });
      return Promise.resolve({ totalSent: 3 });
    });

    render(<NotificationRulesTab />);

    await waitFor(() => {
      expect(screen.getByText("ใกล้ถึงเวลานัดดูห้อง")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("rule-appointment.reminder-EMAIL"));
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/api/v1/notifications/rules/appointment.reminder",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});
