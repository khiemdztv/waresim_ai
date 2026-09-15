import { expiryInfo, reserved, type Simulation } from "./simulation";
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

export type AlertExplanation = {
  cause: string;
  impact: string;
  evidence: string[];
  actions: string[];
  sources: string[];
  suggestedQuestion: string;
};

export function productAlerts(
  product: Product,
  state: Pick<Simulation, "time">,
): OperationalAlert[] {
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

export function deriveOperationalAlerts(
  state: Pick<Simulation, "products" | "time">,
): OperationalAlert[] {
  return state.products
    .flatMap((product) => productAlerts(product, state))
    .sort(
      (a, b) =>
        Number(b.severity === "critical") - Number(a.severity === "critical") ||
        a.code.localeCompare(b.code) ||
        a.sku.localeCompare(b.sku),
    );
}

export function explainOperationalAlert(
  alert: OperationalAlert,
  state: Simulation,
): AlertExplanation {
  const product = state.products.find((item) => item.id === alert.sku);
  if (!product) {
    return {
      cause: alert.detail,
      impact: "Không còn tìm thấy SKU trong snapshot hiện tại.",
      evidence: [`Mã luật: ${alert.code}`, `Snapshot giây mô phỏng: ${state.time}`],
      actions: ["Làm mới trung tâm cảnh báo và đối soát nhật ký thay đổi danh mục."],
      sources: ["Rule Engine", "Live State"],
      suggestedQuestion: `Giải thích cảnh báo ${alert.id}`,
    };
  }

  const expiry = expiryInfo(product, state.time);
  const transit = product.lots.reduce((sum, lot) => sum + lot.transit, 0);
  const transferReserved = reserved(state, product.id, "transfer");
  const usableWarehouse = Math.max(0, product.warehouse - transferReserved);
  const replenishment = Math.max(
    0,
    Math.min(product.shelfCapacity - product.shelf, usableWarehouse + product.backroom),
  );
  const earliestLot = [...product.lots]
    .filter(
      (lot) =>
        lot.expiryDate !== null && lot.warehouse + lot.shelf + lot.backroom + lot.transit > 0,
    )
    .sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!))[0];
  const baseEvidence = [
    `${product.id} · ${product.name}`,
    `Kệ ${product.displayBay}: ${product.shelf}/${product.shelfCapacity}; ngưỡng bổ sung ${product.reorderPoint}`,
    `Kho khả dụng: ${usableWarehouse}; chờ lên kệ: ${product.backroom}; đang di chuyển: ${transit}`,
  ];

  if (alert.code === "OUT_OF_STOCK") {
    return {
      cause: `Tồn tại kệ ${product.displayBay} đã về 0, thấp hơn ngưỡng bổ sung ${product.reorderPoint}.`,
      impact:
        "Sản phẩm không còn để khách lấy, có nguy cơ mất doanh thu cho tới khi kệ được bổ sung.",
      evidence: baseEvidence,
      actions:
        replenishment > 0
          ? [
              `Tạo lệnh bổ sung ${replenishment} ${product.unit} từ kho lên kệ ${product.displayBay}.`,
              `Ưu tiên lô ${earliestLot?.id ?? "có HSD gần nhất"} theo FEFO.`,
              "Kiểm đếm lại kệ sau khi quy trình hoàn tất và đóng cảnh báo khi tồn lớn hơn 0.",
            ]
          : [
              "Tạo lệnh nhập hàng từ nhà cung cấp vì kho không còn lượng khả dụng.",
              "Kiểm tra các tác vụ đang giữ chỗ hoặc hàng chờ lên kệ trước khi đặt thêm.",
            ],
      sources: ["Rule OUT_OF_STOCK", "Live State SKU", "SOP bổ sung kệ", "Chính sách FEFO"],
      suggestedQuestion: `Vì sao ${product.id} hết kệ và nên xử lý thế nào?`,
    };
  }

  if (alert.code === "LOW_STOCK") {
    return {
      cause: `Tồn kệ ${product.shelf} đang bằng hoặc thấp hơn ngưỡng bổ sung ${product.reorderPoint}.`,
      impact: `Nếu tốc độ bán tiếp tục, kệ ${product.displayBay} có thể hết hàng trước lượt bổ sung tiếp theo.`,
      evidence: baseEvidence,
      actions:
        replenishment > 0
          ? [
              `Bổ sung ${replenishment} ${product.unit} để lấp sức chứa còn trống.`,
              `Chọn lô ${earliestLot?.id ?? "có HSD gần nhất"} theo FEFO.`,
              "Theo dõi tác vụ ở Luồng hoạt động cho tới bước Hoàn tất.",
            ]
          : [
              "Kiểm tra hàng đang di chuyển/chờ lên kệ; nếu không có, tạo lệnh nhập từ nhà cung cấp.",
              "Theo dõi nhu cầu bán và điều chỉnh ngưỡng bổ sung nếu cảnh báo lặp lại thường xuyên.",
            ],
      sources: ["Rule LOW_STOCK", "Live State SKU", "SOP bổ sung kệ", "Chính sách FEFO"],
      suggestedQuestion: `Phân tích tồn thấp của ${product.id} và đề xuất bổ sung`,
    };
  }

  if (alert.code === "EXPIRY_NEAR") {
    return {
      cause: `${expiry.nearUnits} ${product.unit} nằm trong cửa sổ cảnh báo HSD; lô gần nhất còn ${expiry.days ?? "?"} ngày.`,
      impact:
        "Hàng có nguy cơ thành tồn hết hạn và phải cách ly nếu không được bán hoặc xử lý kịp thời.",
      evidence: [
        ...baseEvidence,
        `Lô FEFO: ${earliestLot?.id ?? "không xác định"}; HSD ${earliestLot?.expiryDate ?? "không áp dụng"}`,
        `Tổng đơn vị cận hạn: ${expiry.nearUnits}`,
      ],
      actions: [
        `Ưu tiên trưng bày và bán lô ${earliestLot?.id ?? "có HSD gần nhất"}.`,
        "Kiểm tra chất lượng thực tế trước khi đưa thêm hàng lên kệ.",
        "Hạn chế bổ sung lô có HSD xa hơn khi lô FEFO vẫn còn nhiều.",
      ],
      sources: ["Rule EXPIRY_NEAR", "Live State theo lô", "SOP HSD", "Chính sách FEFO"],
      suggestedQuestion: `Giải thích cảnh báo cận hạn và các lô của ${product.id}`,
    };
  }

  return {
    cause: `${product.expired} ${product.unit} đã quá HSD và được chuyển khỏi tồn khả dụng.`,
    impact:
      "Hàng không được phép bán; số lượng thực tế tại khu cách ly cần khớp với dữ liệu theo lô.",
    evidence: [
      ...baseEvidence,
      `Hết hạn/cách ly: ${product.expired}; tổng cách ly: ${product.damaged}`,
    ],
    actions: [
      "Kiểm đếm SKU và lô tại khu cách ly.",
      "Đối soát nhật ký hết hạn, ghi nhận chênh lệch nếu có.",
      "Xử lý tiêu hủy hoặc hoàn nhà cung cấp theo SOP của cửa hàng.",
    ],
    sources: [
      "Rule EXPIRED_QUARANTINE",
      "Live State SKU",
      "Live State theo lô",
      "SOP hàng hết hạn",
    ],
    suggestedQuestion: `Giải thích cảnh báo hàng hết hạn và cách ly của ${product.id}`,
  };
}

export function categoryAlertCount(
  state: Simulation,
  categoryId: string,
  site: "warehouse" | "store",
) {
  const codes: AlertCode[] =
    site === "store" ? ["OUT_OF_STOCK", "LOW_STOCK", "EXPIRY_NEAR"] : ["EXPIRY_NEAR"];
  return state.products
    .filter((product) => product.categoryId === categoryId)
    .flatMap((product) => productAlerts(product, state))
    .filter((alert) => codes.includes(alert.code)).length;
}
