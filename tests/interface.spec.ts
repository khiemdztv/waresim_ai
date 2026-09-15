import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator('.sim-app[data-hydrated="true"]')).toBeVisible({ timeout: 20000 });
}

async function exportCsv(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^waresim-.*\.csv$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks)
    .toString("utf8")
    .replace(/^\uFEFF/, "");
}

test("simulation always runs, shows red rule alerts, smoothly animated actors and exports CSV", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  const before = await page.getByTestId("simulation-clock").innerText();
  await page.waitForTimeout(1250);
  await expect(page.getByTestId("simulation-clock")).not.toHaveText(before);
  await expect(page.getByLabel("Mô phỏng luôn chạy")).toBeVisible();
  await expect(page.getByRole("button", { name: /Mở .* cảnh báo vận hành/ })).toBeVisible();
  await expect(page.locator(".scene-alert-badge")).not.toHaveCount(0);
  expect(
    await page
      .locator(".scene-forklift-motion")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("scene-forklift-drive");

  await page.getByRole("button", { name: /Xem .* cảnh báo/, exact: true }).click();
  const alertCenter = page.getByRole("dialog", { name: "Trung tâm cảnh báo vận hành" });
  await expect(alertCenter).toBeVisible();
  await expect(alertCenter).toContainText("Phát hiện gì?");
  await expect(alertCenter).toContainText("Bằng chứng Live State");
  await expect(alertCenter).toContainText("Đề xuất xử lý có căn cứ");
  await alertCenter.screenshot({ path: "test-results/alert-center-desktop.png" });
  await alertCenter.getByRole("button", { name: "Hỏi RAG sâu hơn" }).click();
  const ragMessages = page.locator(".warehouse-chat-messages article.bot");
  await expect(ragMessages.last()).toContainText("Đề xuất Hybrid RAG:");
  await page.getByRole("button", { name: "Đóng trợ lý" }).click();

  await page.getByRole("button", { name: "Kệ kho A1", exact: true }).click();
  await page.getByRole("button", { name: "Bổ sung hàng", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("spinbutton").fill("7");
  await modal.getByRole("button", { name: "Tạo quy trình" }).click();
  const liveTransfer = page.locator(".scene-live-action.transfer");
  await expect(liveTransfer).toBeVisible();
  await expect(liveTransfer).toContainText("Chọn lô FEFO");
  expect(
    await liveTransfer
      .locator(".scene-action-route")
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("scene-route-flow");
  await page.screenshot({ path: "test-results/simulation-action-motion.png", fullPage: true });
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await expect
    .poll(() => page.locator(".sim-jobs-table").getByText("Hoàn tất").count())
    .toBeGreaterThan(0);

  const csv = await exportCsv(page);
  const lines = csv.split("\r\n");
  expect(lines).toHaveLength(9026);
  expect(lines[0]).toContain('"sku","ten_san_pham"');
  expect(lines[0]).toContain('"ma_lo"');
  expect(lines[1]).toContain('"SKU-0001"');
  expect(csv).not.toContain('{"products"');
  await page.screenshot({ path: "test-results/grocery-alerts-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("inventory filters, lot details and expiry rollover remain live", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Quản lý tồn kho", exact: true }).click();
  await expect(page.locator(".grocery-table tbody tr")).toHaveCount(50);
  await expect(page.locator(".grocery-pagination")).toContainText("Trang 1 / 60");
  await page.getByRole("combobox", { name: "Nhóm hàng", exact: true }).selectOption("dairy");
  await expect(page.locator(".grocery-pagination")).toContainText("280 SKU");
  await page.getByRole("combobox", { name: "Nhóm hàng", exact: true }).selectOption("all");
  await page.getByRole("textbox", { name: "Lọc danh mục sản phẩm" }).fill("SKU-0001");
  await page.getByRole("button", { name: "Xem lô", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.locator(".grocery-lot-table tbody tr")).toHaveCount(4);
  await expect(modal).toContainText("Đã hết hạn");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Qua ngày/ }).click();
  await expect(page.getByRole("button", { name: /Qua ngày/ })).toContainText("15/09/2026");
  await expect(page.getByText(/tiếp tục mô phỏng/)).toBeVisible();
});

test("chatbot answers from current state and updates after a completed POS sale on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await page.getByRole("button", { name: "Mở trợ lý kho thời gian thực" }).click();
  await page.getByRole("button", { name: "SKU-0001 còn bao nhiêu?" }).click();
  const messages = page.locator(".warehouse-chat-messages article.bot");
  await expect(messages.last()).toContainText("kệ A1: 16/60");
  await expect(messages.last()).toContainText("LIVE STATE · snapshot");
  await page.getByLabel("Câu hỏi cho trợ lý kho").fill("Kệ A1 đang có gì?");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(messages.last()).toContainText("180 SKU");
  await page.getByLabel("Câu hỏi cho trợ lý kho").fill("Có cảnh báo nào?");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(messages.last()).toContainText("cảnh báo theo luật");
  await page.getByRole("button", { name: "Đóng trợ lý" }).click();

  await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await page.getByRole("button", { name: "Quản lý tồn kho", exact: true }).click();
  await page.getByRole("textbox", { name: "Lọc danh mục sản phẩm" }).fill("SKU-0001");
  await page.getByRole("button", { name: "Bán", exact: true }).click();
  await page.getByRole("dialog").getByRole("spinbutton").fill("2");
  await page.getByRole("dialog").getByRole("button", { name: "Tạo quy trình" }).click();
  await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await page.getByRole("button", { name: "Mô phỏng không gian", exact: true }).click();
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Mở trợ lý kho thời gian thực" }).click();
  await page.getByLabel("Câu hỏi cho trợ lý kho").fill("SKU-0001 còn bao nhiêu?");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(messages.last()).toContainText("kệ A1: 14/60");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/grocery-chat-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("manager creates a business order and controls Auto Order", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await page.getByRole("button", { name: "Đơn đặt hàng", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đơn đặt hàng khách cá nhân & doanh nghiệp" }),
  ).toBeVisible();

  const autoOrder = page.getByRole("button", { name: /Auto Order/ });
  await expect(autoOrder).toHaveAttribute("aria-pressed", "true");
  await autoOrder.click();
  await expect(autoOrder).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Tạo đơn mới" }).click();
  const modal = page.getByRole("dialog", { name: "Tạo đơn đặt hàng" });
  await modal.getByLabel("Loại khách hàng").selectOption("business");
  await modal.getByLabel("Tên khách hàng hoặc đơn vị").fill("Công ty Local Test");
  await modal.getByRole("spinbutton").fill("5");
  await modal.getByRole("button", { name: "Xác nhận đơn" }).click();

  await expect(page.locator(".orders-table tbody tr").first()).toContainText("Công ty Local Test");
  await expect(page.locator(".orders-table tbody tr").first()).toContainText("Doanh nghiệp");
  await expect(page.locator(".orders-table tbody tr").first()).toContainText("Nhập tay");
  expect(errors).toEqual([]);
});
