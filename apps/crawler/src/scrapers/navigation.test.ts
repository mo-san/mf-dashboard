import type { Page } from "playwright";
import { describe, expect, test, vi } from "vitest";
import { gotoWithRetry } from "./navigation.js";

const URL = "https://example.com/page";

function createPage(goto: ReturnType<typeof vi.fn>, closed = false) {
  return {
    goto,
    isClosed: vi.fn<(...args: any[]) => any>().mockReturnValue(closed),
  } as unknown as Page;
}

describe("gotoWithRetry", () => {
  test("成功したら1回だけ遷移する", async () => {
    const goto = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);

    await gotoWithRetry(createPage(goto), URL, { waitUntil: "domcontentloaded" });

    expect(goto).toHaveBeenCalledOnce();
    expect(goto).toHaveBeenCalledWith(URL, { waitUntil: "domcontentloaded" });
  });

  test.each([
    "page.goto: net::ERR_ABORTED at https://example.com/page",
    "page.goto: Timeout 30000ms exceeded.",
  ])("一時的な遷移エラーを1回だけ再試行する: %s", async (message) => {
    const goto = vi
      .fn<(...args: any[]) => any>()
      .mockRejectedValueOnce(new Error(message))
      .mockResolvedValueOnce(null);

    await gotoWithRetry(createPage(goto), URL, { retryDelayMs: 0, timeout: 5000 });

    expect(goto).toHaveBeenCalledTimes(2);
    // retryDelayMs は goto へ渡さない
    expect(goto).toHaveBeenLastCalledWith(URL, { timeout: 5000 });
  });

  test("2回目も失敗したら元のエラーを返す", async () => {
    const error = new Error("page.goto: net::ERR_ABORTED at https://example.com/page");
    const goto = vi.fn<(...args: any[]) => any>().mockRejectedValue(error);

    await expect(gotoWithRetry(createPage(goto), URL, { retryDelayMs: 0 })).rejects.toBe(error);
    expect(goto).toHaveBeenCalledTimes(2);
  });

  test("再試行できないエラーは再試行しない", async () => {
    const error = new Error("page.goto: Page crashed");
    const goto = vi.fn<(...args: any[]) => any>().mockRejectedValue(error);

    await expect(gotoWithRetry(createPage(goto), URL, { retryDelayMs: 0 })).rejects.toBe(error);
    expect(goto).toHaveBeenCalledOnce();
  });

  test("ページが閉じていたら再試行しない", async () => {
    const error = new Error("page.goto: net::ERR_ABORTED at https://example.com/page");
    const goto = vi.fn<(...args: any[]) => any>().mockRejectedValue(error);

    await expect(gotoWithRetry(createPage(goto, true), URL, { retryDelayMs: 0 })).rejects.toBe(
      error,
    );
    expect(goto).toHaveBeenCalledOnce();
  });
});
