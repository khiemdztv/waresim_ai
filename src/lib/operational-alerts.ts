import { expiryInfo, type Simulation } from "./simulation";
import type { Product } from "./grocery-catalog";

export type AlertSeverity = "critical" | "warning";
export type AlertCode = "OUT_OF_STOCK" | "LOW_STOCK" | "EXPIRY_NEAR" | "EXPIRED_QUARANTINE";

export type OperationalAlert = {
  id: string;
  code: AlertCode;
  severity: AlertSeverity;
  sku: string;
  categoryId: string;
  title: string;
  detail: string;
  recommendation: string;
  filter: "low" | "near" | "expired";
};

export function productAlerts(product: Product, state: Simulation): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const expiry = expiryInfo(product, state.time);
  if (product.shelf === 0) {
    alerts.push({
      id: `OUT_OF_STOCK:${product.id}`,
      code: "OUT_OF_STOCK",
      severity: "critical",
      sku: product.id,
      categoryId: product.categoryId,
      title: `${product.name} đã hết trên kệ`,
      detail: `Kệ ${product.displayBay} còn 0, ngưỡng bổ sung ${product.reorderPoint} ${product.unit}.`,
      recommendation:
        product.warehouse + product.backroom > 0
          ? `Bổ sung tối đa ${Math.min(product.shelfCapacity, product.warehouse + product.backroom)} ${product.unit}.`
          : "Tạo lệnh nhập từ nhà cung cấp.",
      filter: "low",
    });
  } else if (product.shelf <= product.reorderPoint) {
    alerts.push({
      id: `LOW_STOCK:${product.id}`,
      code: "LOW_STOCK",
      severity: "warning",
      sku: product.id,
      categoryId: product.categoryId,
      title: `${product.name} sắp hết trên kệ`,
      detail: `Kệ ${product.displayBay} còn ${product.shelf}, ngưỡng bổ sung ${product.reorderPoint} ${product.unit}.`,
      recommendation:
        product.warehouse + product.backroom > 0
          ? `Bổ sung ${Math.min(product.shelfCapacity - product.shelf, product.warehouse + product.backroom)} ${product.unit} theo FEFO.`
          : "Tạo lệnh nhập từ nhà cung cấp.",
      filter: "low",
    });
  }
  if (expiry.nearUnits > 0) {
    alerts.push({
      id: `EXPIRY_NEAR:${product.id}`,
      code: "EXPIRY_NEAR",
      severity: expiry.days === 0 ? "critical" : "warning",
      sku: product.id,
      categoryId: product.categoryId,
      title: `${product.name} có lô cận hạn`,
      detail: `${expiry.nearUnits} ${product.unit} · HSD gần nhất ${expiry.next ?? "không xác định"}.`,
      recommendation: "Ưu tiên bán và bổ sung đúng lô FEFO; kiểm tra chất lượng trước khi lên kệ.",
      filter: "near",
    });
  }
  if (product.expired > 0) {
    alerts.push({
      id: `EXPIRED_QUARANTINE:${product.id}`,
      code: "EXPIRED_QUARANTINE",
      severity: "critical",
      sku: product.id,
      categoryId: product.categoryId,
      title: `${product.name} có hàng hết hạn`,
      detail: `${product.expired} ${product.unit} đã được tách khỏi tồn khả dụng.`,
      recommendation: "Kiểm đếm khu cách ly và xử lý theo SOP hàng hết hạn.",
      filter: "expired",
    });
  }
  return alerts;
}

export function deriveOperationalAlerts(state: Simulation): OperationalAlert[] {
  return state.products
    .flatMap((product) => productAlerts(product, state))
    .sort(
      (a, b) =>
        Number(b.severity === "critical") - Number(a.severity === "critical") ||
        a.code.localeCompare(b.code) ||
        a.sku.localeCompare(b.sku),
    );
}

export function categoryAlertCount(state: Simulation, categoryId: string, site: "warehouse" | "store") {
  const codes: AlertCode[] =
    site === "store" ? ["OUT_OF_STOCK", "LOW_STOCK", "EXPIRY_NEAR"] : ["EXPIRY_NEAR"];
  return state.products
    .filter((product) => product.categoryId === categoryId)
    .flatMap((product) => productAlerts(product, state))
    .filter((alert) => codes.includes(alert.code)).length;
}
