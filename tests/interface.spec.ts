import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator('.sim-app[data-hydrated="true"]')).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Tạm dừng mô phỏng", exact: true }).click();
}
async function exportState(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất dữ liệu", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("waresim-simulation.json");
  const stream = await download.createReadStream(),
    chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test("desktop grouped scenes, FEFO transfer, pause and 3,000-SKU export", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  const time = await page.getByTestId("simulation-clock").innerText();
  await page.waitForTimeout(1100);
  await expect(page.getByTestId("simulation-clock")).toHaveText(time);
  await expect(page.getByRole("button", { name: /^Kệ kho / })).toHaveCount(13);
  await page.getByRole("button", { name: "Kệ kho A1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kệ kho A1" })).toBeVisible();
  await page.getByRole("button", { name: "Bổ sung hàng", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByRole("spinbutton").fill("1000");
  await modal.getByRole("button", { name: "Tạo quy trình" }).click();
  await expect(modal.getByRole("alert")).toContainText("Chỉ còn");
  await modal.getByRole("spinbutton").fill("7");
  await modal.getByRole("button", { name: "Tạo quy trình" }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole("button", { name: "Cửa hàng ST-01", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Kệ cửa hàng / })).toHaveCount(21);
  await expect(page.locator(".sim-scene-svg")).toContainText("RAU LÁ");
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.getByRole("button", { name: "Chạy mô phỏng", exact: true }).click();
  await expect(page.locator(".sim-jobs-table").getByText("Hoàn tất")).toHaveCount(1);
  await page.getByRole("button", { name: "Tạm dừng mô phỏng", exact: true }).click();
  const data = await exportState(page);
  expect(data.products).toHaveLength(3000);
  expect(data.products[0].shelf).toBe(23);
  expect(data.products[0].warehouse).toBe(21);
  expect(data.jobs[0].allocations.length).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/grocery-store-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("inventory pagination, storage filters, batch details and expiry rollover", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Quản lý tồn kho", exact: true }).click();
  await expect(page.locator(".grocery-table tbody tr")).toHaveCount(50);
  await expect(page.locator(".grocery-pagination")).toContainText("Trang 1 / 60");
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page.locator(".grocery-pagination")).toContainText("51–100");
  await page.getByRole("combobox", { name: "Nhóm hàng", exact: true }).selectOption("dairy");
  await expect(page.locator(".grocery-pagination")).toContainText("280 SKU");
  await page.getByRole("combobox", { name: "Bảo quản", exact: true }).selectOption("frozen");
  await expect(page.getByText("Không tìm thấy sản phẩm", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Nhóm hàng", exact: true }).selectOption("all");
  await expect(page.locator(".grocery-pagination")).toContainText("90 SKU");
  await page.getByRole("combobox", { name: "Bảo quản", exact: true }).selectOption("all");
  await page.getByRole("textbox", { name: "Lọc danh mục sản phẩm" }).fill("do hop");
  await expect(page.locator(".grocery-pagination")).toContainText("150 SKU");
  await page.getByRole("textbox", { name: "Lọc danh mục sản phẩm" }).fill("SKU-0001");
  await page.getByRole("button", { name: "Xem lô", exact: true }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.locator(".grocery-lot-table tbody tr")).toHaveCount(4);
  expect((await modal.boundingBox())!.width).toBeGreaterThan(900);
  await expect(modal).toContainText("Đã hết hạn");
  await expect(modal).toContainText("16/09/2026");
  await modal.screenshot({ path: "test-results/grocery-lot-detail.png" });
  await modal.getByRole("button", { name: "Nhập lô mới", exact: true }).click();
  await expect(modal.getByLabel("Hạn sử dụng lô nhập")).toHaveValue("2027-06-11");
  await modal.getByLabel("Hạn sử dụng lô nhập").fill("2026-09-13");
  await modal.getByRole("button", { name: "Tạo quy trình" }).click();
  await expect(modal).toBeVisible();
  expect(
    await modal
      .getByLabel("Hạn sử dụng lô nhập")
      .evaluate((e: HTMLInputElement) => e.validity.rangeUnderflow),
  ).toBe(true);
  await modal.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("button", { name: /Qua ngày/ }).click();
  await expect(page.getByRole("button", { name: /Qua ngày/ })).toContainText("15/09/2026");
  const data = await exportState(page);
  expect(
    data.products.reduce((n: number, p: { expired: number }) => n + p.expired, 0),
  ).toBeGreaterThan(50);
  expect(data.totals.sold).toBe(0);
  await page.getByRole("button", { name: /hết hạn · đã cách ly/ }).click();
  await expect(page.getByRole("combobox", { name: "Tình trạng hạn dùng" })).toHaveValue("expired");
  await page.screenshot({ path: "test-results/grocery-inventory-desktop.png", fullPage: true });
});

test("mobile search, POS sale, automatic customers, camera and reset", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await page.getByRole("button", { name: "Quản lý tồn kho", exact: true }).click();
  await page.getByRole("textbox", { name: "Lọc danh mục sản phẩm" }).fill("SKU-0003");
  await expect(page.locator(".grocery-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Bán", exact: true }).click();
  await page.getByRole("dialog").getByRole("spinbutton").fill("2");
  await page.getByRole("dialog").getByRole("button", { name: "Tạo quy trình" }).click();
  await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await page.getByRole("button", { name: "Mô phỏng không gian", exact: true }).click();
  await page.getByRole("button", { name: "60×", exact: true }).click();
  await page.getByRole("button", { name: "Chạy mô phỏng", exact: true }).click();
  await expect(page.locator(".sim-jobs-table").getByText("Hoàn tất")).toHaveCount(1);
  await page.getByRole("button", { name: "Bật khách mua tự động", exact: true }).click();
  await expect(page.locator(".grocery-retail-controls > strong")).not.toContainText(
    "2 đơn vị đã bán",
  );
  await page.getByRole("button", { name: "Tạm dừng mô phỏng", exact: true }).click();
  await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
  await page.getByRole("button", { name: "Hệ thống camera 08", exact: true }).click();
  await expect(page.locator(".sim-camera-grid>button")).toHaveCount(4);
  await page.locator(".sim-camera-grid>button").first().click();
  await expect(page.getByRole("heading", { name: "Camera 01" })).toBeVisible();
  await page.getByRole("button", { name: "Khởi động lại mô phỏng", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Khởi động lại", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bật khách mua tự động", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".grocery-retail-controls > strong")).toContainText("0 đơn vị đã bán");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/grocery-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
