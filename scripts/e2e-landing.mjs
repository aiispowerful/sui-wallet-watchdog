/**
 * Headless check: empty landing input, Connect Wallet opens a dialog,
 * and a typed address is cleared after reload (no persistence).
 *
 *   BASE_URL=http://127.0.0.1:3000 node scripts/e2e-landing.mjs
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH ?? "/opt/google/chrome/chrome";

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "Connect Wallet" }).waitFor({ timeout: 20000 });

  const input = page.getByRole("textbox", { name: "Sui address" });
  const value = await input.inputValue();
  if (value.trim() !== "") failures.push(`landing input was prefilled: ${value}`);

  await page.getByRole("button", { name: "Connect Wallet" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 5000 });
  const dialogText = await dialog.innerText();
  const opened =
    /connect a wallet|no wallets installed|install slush|slush/i.test(dialogText);
  if (!opened) failures.push(`connect modal missing expected copy: ${dialogText.slice(0, 200)}`);

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {
    failures.push("connect modal did not close on Escape");
  });

  const typed = "0x" + "ab".repeat(32);
  await input.fill(typed);
  if ((await input.inputValue()) !== typed) failures.push("could not type an address");
  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "Connect Wallet" }).waitFor({ timeout: 20000 });
  const after = await page.getByRole("textbox", { name: "Sui address" }).inputValue();
  if (after.trim() !== "") failures.push(`typed address survived reload: ${after}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("E2E FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("E2E passed: empty landing, connect modal opens, typed address clears on reload.");
