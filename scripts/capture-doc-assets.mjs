import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.WARESIM_URL || "http://127.0.0.1:3000";
const output = resolve("docs", "assets");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator('.sim-app[data-hydrated="true"]').waitFor({ timeout: 20_000 });

async function nav(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(450);
}

async function shot(name) {
  await page.screenshot({ path: resolve(output, name), fullPage: true });
}

await nav("Tổng quan");
await shot("01-overview.png");

await nav("Mô phỏng không gian");
await page.getByRole("button", { name: "Kệ kho A1", exact: true }).click();
await page.getByRole("button", { name: "Bổ sung hàng", exact: true }).click();
await page.getByRole("dialog").getByRole("spinbutton").fill("7");
await page.getByRole("dialog").getByRole("button", { name: "Tạo quy trình" }).click();
await page.waitForTimeout(600);
await shot("02-simulation-action.png");

await nav("Đơn đặt hàng");
await shot("03-orders.png");

await nav("Chỉ số & đánh giá");
await shot("04-metrics.png");
await page.getByRole("button", { name: "Mở Food Rescue" }).click();
await page.waitForTimeout(350);
await shot("05-food-rescue.png");
await page.keyboard.press("Escape");

await nav("Kịch bản What‑If");
await page.getByRole("button", { name: "Chạy mô phỏng" }).click();
await page.waitForTimeout(350);
await shot("06-what-if.png");

await page.locator(".warehouse-chat-launcher").click();
const input = page.locator(".warehouse-chat form input");
await input.fill("Các chức năng AI và bằng chứng kiểm chứng của WareSim là gì?");
await page.locator(".warehouse-chat form button[type=submit]").click();
await page.locator(".warehouse-chat-messages article.bot").nth(1).waitFor({ timeout: 30_000 });
await shot("07-groq-rag.png");

await browser.close();
console.log(`Captured documentation assets in ${output}`);
