import { BASE_DATE, type Lot, type Product } from "./grocery-catalog";
import type { Simulation } from "./simulation";

export type RescueStage = "FLASH_24H" | "GOLDEN_8H" | "DONATE_2H";
export type RescueDecisionStatus = "APPROVED" | "REJECTED";

export type RescuePlan = {
  id: string;
  sku: string;
  productName: string;
  lotId: string;
  expiryDate: string;
  hoursRemaining: number;
  units: number;
  stage: RescueStage;
  discountPercent: number;
  channel: string;
  salesVelocityPerHour: number;
  projectedRescuedUnits: number;
  projectedValueVnd: number;
  rationale: string;
};

export type RescueDecision = {
  planId: string;
  sku: string;
  lotId: string;
  status: RescueDecisionStatus;
  units: number;
  decidedAt: number;
  note: string;
};

const lotAvailable = (lot: Lot) => lot.warehouse + lot.shelf + lot.backroom + lot.transit;

export function hoursUntilExpiry(expiryDate: string, simulationTime: number) {
  const current = Date.parse(`${BASE_DATE}T00:00:00Z`) + simulationTime * 1000;
  const expiry = Date.parse(`${expiryDate}T00:00:00Z`) + 86400000;
  return Math.max(0, (expiry - current) / 3600000);
}

function stageFor(hours: number): Pick<RescuePlan, "stage" | "discountPercent" | "channel"> {
  if (hours <= 2)
    return { stage: "DONATE_2H", discountPercent: 100, channel: "Food Bank / từ thiện" };
  if (hours <= 8)
    return { stage: "GOLDEN_8H", discountPercent: 50, channel: "POS + Giờ vàng trên App" };
  return { stage: "FLASH_24H", discountPercent: 25, channel: "POS + Flash Sale trên App" };
}

function planFor(product: Product, lot: Lot, simulationTime: number): RescuePlan | null {
  if (!lot.expiryDate) return null;
  const units = lotAvailable(lot);
  const hoursRemaining = hoursUntilExpiry(lot.expiryDate, simulationTime);
  if (units <= 0 || hoursRemaining <= 0 || hoursRemaining > 24) return null;
  const stage = stageFor(hoursRemaining);
  const velocity = Math.max(0.05, product.dailyDemand / 14);
  const uplift = stage.stage === "FLASH_24H" ? 1.6 : stage.stage === "GOLDEN_8H" ? 2.5 : 1;
  const projectedRescuedUnits =
    stage.stage === "DONATE_2H"
      ? units
      : Math.min(units, Math.max(1, Math.ceil(velocity * hoursRemaining * uplift)));
  const projectedValueVnd = Math.round(
    projectedRescuedUnits * product.price * (1 - stage.discountPercent / 100),
  );
  return {
    id: `${stage.stage}:${product.id}:${lot.id}`,
    sku: product.id,
    productName: product.name,
    lotId: lot.id,
    expiryDate: lot.expiryDate,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    units,
    ...stage,
    salesVelocityPerHour: Math.round(velocity * 100) / 100,
    projectedRescuedUnits,
    projectedValueVnd,
    rationale:
      stage.stage === "DONATE_2H"
        ? "Không còn đủ thời gian bán an toàn; ưu tiên đóng gói chuyển tặng trước HSD."
        : `Tồn cận hạn cao hơn tốc độ bán cơ sở; kích cầu có kiểm soát để ưu tiên lô FEFO.`,
  };
}

export function buildFoodRescuePlans(state: Simulation, limit = 80): RescuePlan[] {
  return state.products
    .flatMap((product) =>
      product.lots
        .map((lot) => planFor(product, lot, state.time))
        .filter((plan): plan is RescuePlan => plan !== null),
    )
    .sort(
      (a, b) =>
        a.hoursRemaining - b.hoursRemaining ||
        b.projectedRescuedUnits - a.projectedRescuedUnits ||
        a.sku.localeCompare(b.sku),
    )
    .slice(0, limit);
}

export const rescueStageLabels: Record<RescueStage, string> = {
  FLASH_24H: "T − 24h · Flash Sale",
  GOLDEN_8H: "T − 8h · Giờ vàng",
  DONATE_2H: "T − 2h · Chuyển tặng",
};
