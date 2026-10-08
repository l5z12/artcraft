import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const resultsDirectory = fileURLToPath(new URL("../../test-results/", import.meta.url));

export function launchTestBrowser(chromium) {
  // Local developers may use installed Chrome; CI installs Playwright Chromium.
  const channel = process.env.PLAYWRIGHT_CHANNEL || "chrome";
  return chromium.launch({
    ...(channel === "chromium" ? {} : { channel }),
    headless: true,
  });
}

export async function captureBrowserFailure(browser, name) {
  try {
    await mkdir(resultsDirectory, { recursive: true });
    let index = 0;
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (page.isClosed()) continue;
        const prefix = resolve(resultsDirectory, `${name}-${index++}`);
        await page.screenshot({ path: `${prefix}.png`, timeout: 5000 });
        await writeFile(`${prefix}.html`, await page.content());
      }
    }
  } catch (error) {
    console.error("Could not capture browser failure:", error);
  }
}
