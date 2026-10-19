import type { Page } from "playwright";

const NAVIGATION_RETRY_DELAY_MS = 1000;

type GotoOptions = NonNullable<Parameters<Page["goto"]>[1]>;

export interface GotoWithRetryOptions extends GotoOptions {
  retryDelayMs?: number;
}

function isRetryableNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("net::ERR_ABORTED") || message.includes("Timeout");
}

/**
 * page.goto を、一時的な遷移エラー (別の遷移による中断・タイムアウト) に限り 1 回だけ再試行する。
 * 再試行できないエラーと、2 回目の失敗は元のエラーをそのまま投げる。
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  { retryDelayMs = NAVIGATION_RETRY_DELAY_MS, ...gotoOptions }: GotoWithRetryOptions = {},
): Promise<void> {
  const MAX_RETRIES = 1;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.goto(url, gotoOptions);
      return;
    } catch (err) {
      if (page.isClosed()) {
        throw err;
      }

      if (!isRetryableNavigationError(err) || attempt === MAX_RETRIES) {
        throw err;
      }

      // A crashed Playwright page can reject page.waitForTimeout() and mask the
      // original navigation error. Use a process timer between attempts instead.
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}
