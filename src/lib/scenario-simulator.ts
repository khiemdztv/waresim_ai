import type { Product } from "./grocery-catalog";
import type { Simulation } from "./simulation";

export type ScenarioKind = "demand-spike" | "supplier-delay" | "cold-chain";

export type ScenarioConfig = {
  kind: ScenarioKind;
  demandMultiplier: number;
  supplierDelayDays: number;
  horizonDays: number;
};

export type ScenarioRisk = {
  sku: string;
  name: string;
  category: string;
  available: number;
  projectedDemand: number;
  coverageHours: number;
  shortage: number;
  suggestedOrder: number;
  severity: "critical" | "warning";
};

export type ScenarioResult = {
  config: ScenarioConfig;
  affectedSkus: number;
  projectedShortageUnits: number;
  firstStockoutHours: number | null;
  suggestedOrderUnits: number;
  risks: ScenarioRisk[];
  agentInsights: Array<{ agent: string; finding: string; action: string }>;
};

const available = (product: Product) => product.warehouse + product.shelf + product.backroom;

export function runWhatIfScenario(state: Simulation, config: ScenarioConfig): ScenarioResult {
  const multiplier = Math.min(10, Math.max(1, config.demandMultiplier));
  const delay = Math.min(14, Math.max(0, config.supplierDelayDays));
  const horizon = Math.min(14, Math.max(1, config.horizonDays));
  const effectiveDays = horizon + (config.kind === "supplier-delay" ? delay : 0);
  const coldFactor = config.kind === "cold-chain" ? 0.35 : 0;

  const risks = state.products
    .map((product): ScenarioRisk | null => {
      const demand = product.dailyDemand * effectiveDays * multiplier;
      const coldLoss =
        config.kind === "cold-chain" && product.storage !== "ambient"
          ? available(product) * coldFactor
          : 0;
      const usable = Math.max(0, available(product) - coldLoss);
      const shortage = Math.max(0, Math.ceil(demand - usable));
      const coverageHours = (usable / Math.max(0.01, product.dailyDemand * multiplier)) * 24;
      const safetyStock = Math.ceil(product.dailyDemand * multiplier * 0.5);
      const suggestedOrder = Math.max(0, shortage + safetyStock);
      if (shortage === 0 && coverageHours >= effectiveDays * 24 * 0.75) return null;
      return {
        sku: product.id,
        name: product.name,
        category: product.category,
        available: Math.round(usable),
        projectedDemand: Math.ceil(demand),
        coverageHours: Math.round(coverageHours * 10) / 10,
        shortage,
        suggestedOrder,
        severity: shortage > 0 || coverageHours < 24 ? "critical" : "warning",
      };
    })
    .filter((risk): risk is ScenarioRisk => risk !== null)
    .sort(
      (a, b) =>
        Number(b.severity === "critical") - Number(a.severity === "critical") ||
        a.coverageHours - b.coverageHours ||
        b.shortage - a.shortage,
    );

  const first = risks
    .filter((risk) => risk.shortage > 0)
    .sort((a, b) => a.coverageHours - b.coverageHours)[0];
  const projectedShortageUnits = risks.reduce((sum, risk) => sum + risk.shortage, 0);
  const suggestedOrderUnits = risks.reduce((sum, risk) => sum + risk.suggestedOrder, 0);
  const topCategory = risks.reduce<Record<string, number>>((counts, risk) => {
    counts[risk.category] = (counts[risk.category] ?? 0) + risk.shortage;
    return counts;
  }, {});
  const category = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "không có";

  return {
    config: {
      ...config,
      demandMultiplier: multiplier,
      supplierDelayDays: delay,
      horizonDays: horizon,
    },
    affectedSkus: risks.length,
    projectedShortageUnits,
    firstStockoutHours: first?.coverageHours ?? null,
    suggestedOrderUnits,
    risks: risks.slice(0, 100),
    agentInsights: [
      {
        agent: "Inventory Guardian",
        finding: `${risks.length.toLocaleString("vi-VN")} SKU cần theo dõi; nhóm rủi ro thiếu hàng lớn nhất là ${category}.`,
        action: `Ưu tiên ${
          risks
            .slice(0, 5)
            .map((risk) => risk.sku)
            .join(", ") || "không cần can thiệp"
        }.`,
      },
      {
        agent: "Logistics Dispatcher",
        finding: `${risks.filter((risk) => risk.coverageHours < 24).length} SKU có độ phủ dưới 24 giờ.`,
        action: "Gom tuyến bổ sung theo khu kệ và ưu tiên FEFO để giảm quãng đường nhặt hàng.",
      },
      {
        agent: "Store Manager Copilot",
        finding: `Thiếu hụt mô phỏng ${projectedShortageUnits.toLocaleString("vi-VN")} đơn vị trong cửa sổ đã chọn.`,
        action: `Đề xuất đặt dự phòng ${suggestedOrderUnits.toLocaleString("vi-VN")} đơn vị; cần quản lý duyệt trước khi phát lệnh.`,
      },
    ],
  };
}
