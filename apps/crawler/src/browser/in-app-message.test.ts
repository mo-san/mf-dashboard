import { chromium, errors, type Browser, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  IN_APP_MESSAGE_ROOT_SELECTOR,
  removeInAppMessagesBeforeActions,
} from "./in-app-message.js";

// HTML fixture の例外: アプリ内メッセージは MoneyForward 側のキャンペーン次第で表示され、
// 読み取り専用の E2E では表示される状態を決定的に作れないため、最小限のマークアップで再現する。
// 構造は実際に失敗したランのログに出た要素 (ab-iam-root 配下の全面 iframe) に合わせている。
const PAGE_WITH_IN_APP_MESSAGE = `
  <a href="#" id="refresh" onclick="document.body.dataset.clicked = 'true'; return false;">一括更新</a>
  <div role="complementary" class="ab-iam-root v3 ab-show"
       style="position: fixed; inset: 0; z-index: 1000;">
    <iframe title="Modal Message" class="ab-in-app-message"
            style="width: 100%; height: 100%; border: 0;"></iframe>
  </div>
`;

const CLICK_TIMEOUT_MS = 1000;

describe("removeInAppMessagesBeforeActions", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setContent(PAGE_WITH_IN_APP_MESSAGE);
  });

  afterEach(async () => {
    await page.close();
  });

  test("ハンドラが無いとアプリ内メッセージがクリックを横取りしてタイムアウトする", async () => {
    const click = page.locator("#refresh").click({ timeout: CLICK_TIMEOUT_MS });

    await expect(click).rejects.toThrow(errors.TimeoutError);
    expect(await page.locator("body").getAttribute("data-clicked")).toBeNull();
  });

  test("ハンドラを登録するとアプリ内メッセージを取り除いてクリックできる", async () => {
    await removeInAppMessagesBeforeActions(page);

    await page.locator("#refresh").click({ timeout: CLICK_TIMEOUT_MS });

    expect(await page.locator("body").getAttribute("data-clicked")).toBe("true");
    expect(await page.locator(IN_APP_MESSAGE_ROOT_SELECTOR).count()).toBe(0);
  });

  test("アプリ内メッセージが無いページの操作には影響しない", async () => {
    await page.evaluate((selector) => {
      for (const element of document.querySelectorAll(selector)) {
        element.remove();
      }
    }, IN_APP_MESSAGE_ROOT_SELECTOR);
    await removeInAppMessagesBeforeActions(page);

    await page.locator("#refresh").click({ timeout: CLICK_TIMEOUT_MS });

    expect(await page.locator("body").getAttribute("data-clicked")).toBe("true");
  });
});
