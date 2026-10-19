import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, refreshSession, setAccessToken } from "./api";

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, statusText: "", json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setAccessToken(null);
});

describe("api client", () => {
  it("แนบ access token และส่ง cookie", async () => {
    setAccessToken("A1");
    fetchMock.mockReturnValueOnce(reply(200, { ok: 1 }));
    await api("/x");
    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers.authorization).toBe("Bearer A1");
    expect(init.credentials).toBe("include");
  });

  it("token หมดอายุ → refresh อัตโนมัติแล้วเรียกซ้ำด้วย token ใหม่", async () => {
    setAccessToken("old");
    fetchMock
      .mockReturnValueOnce(reply(401, { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบ" }))
      .mockReturnValueOnce(reply(200, { accessToken: "new", expiresIn: 900, user: {} }))
      .mockReturnValueOnce(reply(200, { ok: 2 }));
    expect(await api("/x")).toEqual({ ok: 2 });
    expect(fetchMock.mock.calls[1]![0]).toMatch(/\/auth\/refresh$/);
    expect(fetchMock.mock.calls[2]![1].headers.authorization).toBe("Bearer new");
  });

  it("refresh หลายที่พร้อมกัน → ยิงจริงครั้งเดียว", async () => {
    fetchMock.mockReturnValue(reply(200, { accessToken: "n", expiresIn: 900, user: {} }));
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refresh ไม่ผ่าน → คืน null และ error เดิม", async () => {
    fetchMock
      .mockReturnValueOnce(reply(401, { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบ" }))
      .mockReturnValueOnce(reply(401, { code: "SESSION_EXPIRED", message: "x" }));
    await expect(api("/x")).rejects.toMatchObject({ statusCode: 401 });
  });
});
