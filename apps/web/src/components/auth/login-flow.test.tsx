import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginFlow } from "./login-flow";

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, statusText: "", json: async () => body });
const session = { status: "OK", accessToken: "tok", expiresIn: 900, user: { id: "u", email: "a@b.c", fullName: "A" } };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

async function submitCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("อีเมล"), "agent1@rrs.local");
  await user.type(screen.getByLabelText("รหัสผ่าน"), "RrsDev#2026");
  await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
  return user;
}

describe("LoginFlow", () => {
  it("รหัสผ่านถูก → เรียก onSuccess พร้อม session", async () => {
    const onSuccess = vi.fn();
    fetchMock.mockReturnValueOnce(reply(200, session));
    render(<LoginFlow onSuccess={onSuccess} />);
    await submitCredentials();
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "tok" }));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({ email: "agent1@rrs.local", password: "RrsDev#2026" });
  });

  it("บัญชีถูกล็อก → แสดงข้อความจาก API", async () => {
    fetchMock.mockReturnValueOnce(reply(423, { code: "ACCOUNT_LOCKED", message: "บัญชีถูกล็อกชั่วคราว" }));
    render(<LoginFlow onSuccess={vi.fn()} />);
    await submitCredentials();
    expect(await screen.findByRole("alert")).toHaveTextContent("บัญชีถูกล็อกชั่วคราว");
  });

  it("ต้องใช้ 2FA → ถามรหัส 6 หลัก แล้วส่งไป /mfa/verify", async () => {
    const onSuccess = vi.fn();
    fetchMock
      .mockReturnValueOnce(reply(200, { status: "MFA_REQUIRED", challengeToken: "ch1" }))
      .mockReturnValueOnce(reply(200, session));
    render(<LoginFlow onSuccess={onSuccess} />);
    const user = await submitCredentials();
    expect(await screen.findByRole("heading", { name: "ยืนยันตัวตนอีกขั้น" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("รหัส 6 หลัก"), "123 456");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toMatch(/\/mfa\/verify$/);
    expect(JSON.parse(init.body)).toEqual({ challengeToken: "ch1", code: "123456" });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("ต้องตั้ง 2FA ครั้งแรก → แสดง QR และรหัสสำรอง แล้วส่งไป /mfa/enable", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { status: "MFA_SETUP_REQUIRED", challengeToken: "ch2" }))
      .mockReturnValueOnce(reply(200, { secret: "JBSWY3DPEHPK3PXP", qrDataUrl: "data:image/png;base64,AAAA" }))
      .mockReturnValueOnce(reply(200, session));
    const onSuccess = vi.fn();
    render(<LoginFlow onSuccess={onSuccess} />);
    const user = await submitCredentials();
    expect(await screen.findByAltText(/QR code/)).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    await user.type(screen.getByLabelText("รหัส 6 หลัก"), "654321");
    await user.click(screen.getByRole("button", { name: "เปิดใช้และเข้าสู่ระบบ" }));
    expect(fetchMock.mock.calls[2]![0]).toMatch(/\/mfa\/enable$/);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("รหัส 2FA ผิด → แสดงข้อความและอยู่หน้าเดิม", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { status: "MFA_REQUIRED", challengeToken: "ch1" }))
      .mockReturnValueOnce(reply(401, { code: "INVALID_MFA_CODE", message: "รหัสยืนยันไม่ถูกต้อง" }));
    render(<LoginFlow onSuccess={vi.fn()} />);
    const user = await submitCredentials();
    await user.type(await screen.findByLabelText("รหัส 6 หลัก"), "000000");
    await user.click(screen.getByRole("button", { name: "ยืนยัน" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("รหัสยืนยันไม่ถูกต้อง");
    expect(screen.getByRole("heading", { name: "ยืนยันตัวตนอีกขั้น" })).toBeInTheDocument();
  });
});
