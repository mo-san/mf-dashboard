import type { Page } from "playwright";
import { warn } from "../logger.js";

// MoneyForward が Braze で配信するアプリ内メッセージのルート要素。
// 画面全体を覆う iframe を含み、表示中はボタンへのクリックを横取りする。
export const IN_APP_MESSAGE_ROOT_SELECTOR = ".ab-iam-root";

/**
 * アプリ内メッセージが操作を塞いだら DOM から取り除くハンドラを登録する。
 * メッセージはキャンペーン次第でどの画面にも現れるため、特定の操作の前ではなく
 * ページ単位で登録し、Playwright の各操作の直前に表示の有無を確かめさせる。
 */
export async function removeInAppMessagesBeforeActions(page: Page): Promise<void> {
  await page.addLocatorHandler(page.locator(IN_APP_MESSAGE_ROOT_SELECTOR), async () => {
    warn("Removing in-app message overlay that blocks page interactions");
    await page.evaluate((selector) => {
      for (const element of document.querySelectorAll(selector)) {
        element.remove();
      }
    }, IN_APP_MESSAGE_ROOT_SELECTOR);
  });
}
