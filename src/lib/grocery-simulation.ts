import {
  createCatalog,
  dateAfter,
  daysBetween,
  simDate,
  syncProduct,
  validDate,
  type Lot,
  type Product,
} from "./grocery-catalog";
import { eventStore } from "./rag/event-store";
import { liveState } from "./rag/live-state";
import { ruleEngine } from "./rag/rule-engine";
export type { Product, Lot } from "./grocery-catalog";
export type Site = "warehouse" | "store";
export type JobKind = "inbound" | "transfer" | "sale";
export type Allocation = { lotId: string; quantity: number };
export type Job = {
  id: string;
  kind: JobKind;
  sku: string;
  quantity: number;
  stage: number;
  elapsed: number;
  done: boolean;
  cancelled?: boolean;
  allocations: Allocation[];
  incomingExpiry?: string | null;
};
export type SimEvent = {
  id: number;
  time: number;
  title: string;
  detail: string;
  tone: "green" | "blue" | "amber";
  site: Site;
};
export type Simulation = {
  time: number;
  products: Product[];
  jobs: Job[];
  events: SimEvent[];
  nextId: number;
  sold: number;
  received: number;
  delivered: number;
  revenue: number;
  autoRetail: boolean;
  demandCursor: number;
  error: string;
};
export const stages: Record<JobKind, string[]> = {
  inbound: ["Tiếp nhận NCC", "Kiểm tra lô & HSD", "Cất đúng vùng nhiệt", "Hoàn tất"],
  transfer: [
    "Chọn lô FEFO",
    "Lấy hàng từ kho",
    "Kiểm tra số lượng",
    "Đẩy xe ra quầy",
    "Chờ lên kệ",
    "Bổ sung lên kệ",
    "Hoàn tất",
  ],
  sale: ["Khách chọn hàng", "Quét mã tại POS", "Thanh toán", "Hoàn tất"],
};
export const stageDuration = 5;
export const clockLabel = (time: number) =>
  [Math.floor(time / 3600) % 24, Math.floor(time / 60) % 60, Math.floor(time) % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
export function initialSimulation(): Simulation {
  return {
    time: 30600,
    products: createCatalog(),
    jobs: [],
    events: [
      {
        id: 1,
        time: 30600,
        title: "Mở cửa ca sáng",
        detail: "3.000 SKU · Kho dự trữ và sàn bán hàng cùng cửa hàng · Lô hết hạn đã cách ly",
        tone: "green",
        site: "store",
      },
    ],
    nextId: 1043,
    sold: 0,
    received: 0,
    delivered: 0,
    revenue: 0,
    autoRetail: false,
    demandCursor: 0,
    error: "",
  };
}
export function reserved(state: Simulation, sku: string, kind: "transfer" | "sale") {
  return state.jobs
    .filter((j) => j.sku === sku && j.kind === kind && !j.done && (kind === "sale" || j.stage < 3))
    .reduce((n, j) => n + j.quantity, 0);
}
export const inTransit = (state: Simulation) =>
  state.products.reduce((n, p) => n + p.lots.reduce((a, l) => a + l.transit, 0), 0);
export const lotExpired = (lot: Lot, day: string) =>
  lot.expiryDate !== null && lot.expiryDate < day;
export function expiryInfo(p: Product, time: number) {
  const today = simDate(time);
  const usable = p.lots
    .filter((l) => l.warehouse + l.shelf + l.backroom + l.transit > 0 && l.expiryDate !== null)
    .sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!));
  const next = usable[0]?.expiryDate ?? null;
  const nearUnits = p.lots.reduce(
    (n, l) =>
      n +
      (l.expiryDate &&
      daysBetween(today, l.expiryDate) >= 0 &&
      daysBetween(today, l.expiryDate) <= p.warningDays
        ? l.warehouse + l.shelf + l.backroom + l.transit
        : 0),
    0,
  );
  return { next, days: next ? daysBetween(today, next) : null, nearUnits, expiredUnits: p.expired };
}
export const shelfSpace = (state: Simulation, p: Product) =>
  Math.max(
    0,
    p.shelfCapacity -
      p.shelf -
      state.jobs
        .filter((j) => j.sku === p.id && j.kind === "transfer" && !j.done)
        .reduce((n, j) => n + j.quantity, 0),
  );
export function allocateFEFO(
  state: Simulation,
  p: Product,
  kind: "sale" | "transfer",
  quantity: number,
): Allocation[] {
  const source = kind === "sale" ? "shelf" : "warehouse";
  const locked = new Map<string, number>();
  for (const j of state.jobs)
    if (j.sku === p.id && j.kind === kind && !j.done && (kind === "sale" || j.stage < 3))
      for (const a of j.allocations) locked.set(a.lotId, (locked.get(a.lotId) ?? 0) + a.quantity);
  const lots = p.lots
    .filter((l) => !lotExpired(l, simDate(state.time)))
    .sort(
      (a, b) =>
        (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999") ||
        a.receivedDate.localeCompare(b.receivedDate) ||
        a.id.localeCompare(b.id),
    );
  const allocation: Allocation[] = [];
  let remaining = quantity;
  for (const l of lots) {
    const take = Math.min(remaining, Math.max(0, l[source] - (locked.get(l.id) ?? 0)));
    if (take > 0) allocation.push({ lotId: l.id, quantity: take });
    remaining -= take;
    if (remaining === 0) break;
  }
  return remaining === 0 ? allocation : [];
}
export type SimAction =
  | { type: "tick"; seconds?: number }
  | { type: "reset" }
  | { type: "clear-error" }
  | { type: "advance-day" }
  | { type: "auto-retail"; enabled: boolean }
  | { type: "create"; kind: JobKind; sku: string; quantity: number; expiryDate?: string | null }
  | { type: "damage"; sku: string; quantity: number };
export function simulationReducer(state: Simulation, action: SimAction): Simulation {
  // Preserve the order of completions and expiry even when the clock runs at 60×.
  if (action.type === "tick" && (action.seconds ?? 1) > 1) {
    let remaining = action.seconds!;
    if (!Number.isFinite(remaining) || remaining > 86400) return state;
    let result = state;
    while (remaining > 0) {
      const boundary = Math.min(
        86400 - (result.time % 86400),
        result.autoRetail ? 60 - (result.time % 60) : Infinity,
        ...result.jobs.filter((j) => !j.done).map((j) => stageDuration - j.elapsed),
      );
      const step = Math.min(remaining, boundary);
      result = reduceStep(result, { type: "tick", seconds: step });
      remaining -= step;
    }
    return result;
  }
  
  const newState = reduceStep(state, action);
  
  // RAG Hooks: Sync with Event Store and Live State Projector
  if (newState !== state) {
    liveState.updateState(newState);
    ruleEngine.scan(newState);
    
    // Check if new events were added (newest are at index 0 due to unshift)
    const oldFirstId = state.events.length > 0 ? state.events[0].id : -1;
    for (const ev of newState.events) {
      if (ev.id === oldFirstId) break;
      // Tránh việc add mảng ban đầu nếu id == 1
      eventStore.append(ev);
    }
  }

  return newState;
}

function reduceStep(state: Simulation, action: SimAction): Simulation {
  if (action.type === "reset") return initialSimulation();
  if (action.type === "clear-error") return { ...state, error: "" };
  if (action.type === "auto-retail") return { ...state, autoRetail: action.enabled };
  if (action.type === "advance-day" && state.jobs.some((j) => !j.done))
    return { ...state, error: "Hoàn tất các quy trình đang chạy trước khi chuyển ngày." };
  const next: Simulation = {
    ...state,
    products: [...state.products],
    jobs: state.jobs.map((j) => ({ ...j })),
    events: [...state.events],
    error: action.type === "tick" ? state.error : "",
  };
  const changed = new Map<string, Product>();
  const product = (sku: string) => {
    if (changed.has(sku)) return changed.get(sku)!;
    const source = next.products.find((p) => p.id === sku);
    if (!source) return undefined;
    const copy = { ...source, lots: source.lots.map((l) => ({ ...l })) };
    changed.set(sku, copy);
    return copy;
  };
  const event = (
    title: string,
    detail: string,
    tone: SimEvent["tone"] = "blue",
    site: Site = "warehouse",
  ) => {
    next.events.unshift({ id: next.nextId++, time: next.time, title, detail, tone, site });
    next.events = next.events.slice(0, 100);
  };
  const finish = () => {
    next.products =
      changed.size === 0
        ? state.products
        : next.products.map((p) => (changed.has(p.id) ? syncProduct(changed.get(p.id)!) : p));
    return next;
  };
  if (action.type === "create" || action.type === "damage") {
    const p = product(action.sku);
    if (
      !p ||
      !Number.isSafeInteger(action.quantity) ||
      action.quantity < 1 ||
      action.quantity > 1000
    )
      return { ...state, error: "Nhập số lượng nguyên từ 1 đến 1.000." };
    if (action.type === "create" && action.kind === "inbound") {
      const expiry =
        p.shelfLifeDays === null
          ? null
          : action.expiryDate === undefined
            ? dateAfter(simDate(state.time), p.shelfLifeDays)
            : action.expiryDate;
      if (
        p.shelfLifeDays !== null &&
        (!expiry ||
          !validDate(expiry) ||
          expiry < simDate(state.time) ||
          expiry > dateAfter(simDate(state.time), p.shelfLifeDays))
      )
        return {
          ...state,
          error: `HSD phải từ ${simDate(state.time)} đến ${dateAfter(simDate(state.time), p.shelfLifeDays)} theo vòng đời giả định của sản phẩm.`,
        };
      next.jobs.push({
        id: `IN-${next.nextId++}`,
        kind: "inbound",
        sku: p.id,
        quantity: action.quantity,
        stage: 0,
        elapsed: 0,
        done: false,
        allocations: [],
        incomingExpiry: expiry,
      });
      event(
        "Tiếp nhận lô mới",
        `${p.name} · ${action.quantity} ${p.unit} · HSD ${expiry ?? "Không áp dụng"}`,
      );
    } else {
      const kind: "sale" | "transfer" =
        action.type === "damage" ? "transfer" : (action.kind as "sale" | "transfer");
      const allocation = allocateFEFO(state, p, kind, action.quantity);
      if (!allocation.length)
        return {
          ...state,
          error: `Chỉ còn ${kind === "sale" ? p.shelf - reserved(state, p.id, "sale") : p.warehouse - reserved(state, p.id, "transfer")} đơn vị khả dụng, đủ hạn sử dụng tại ${kind === "sale" ? "kệ bán" : "kho dự trữ"}.`,
        };
      if (action.type === "damage") {
        for (const a of allocation) {
          const l = p.lots.find((l) => l.id === a.lotId)!;
          l.warehouse -= a.quantity;
          l.damaged += a.quantity;
        }
        event("Cách ly hàng hỏng", `${p.name} · ${action.quantity} ${p.unit}`, "amber");
      } else {
        if (kind === "transfer" && action.quantity > shelfSpace(state, p))
          return {
            ...state,
            error: `Kệ ${p.displayBay} còn ${shelfSpace(state, p)} chỗ cho SKU này, đã tính các lệnh bổ sung đang chạy.`,
          };
        const id = `${kind === "sale" ? "POS" : "BS"}-${next.nextId++}`;
        next.jobs.push({
          id,
          kind,
          sku: p.id,
          quantity: action.quantity,
          stage: 0,
          elapsed: 0,
          done: false,
          allocations: allocation,
        });
        event(
          kind === "sale" ? "Khách chọn sản phẩm" : "Giữ lô FEFO để bổ sung kệ",
          `${id} · ${p.name} · ${action.quantity} ${p.unit} · ${allocation.map((a) => a.lotId).join(", ")}`,
          "blue",
          kind === "sale" ? "store" : "warehouse",
        );
      }
    }
    next.jobs = [
      ...next.jobs.filter((j) => !j.done),
      ...next.jobs.filter((j) => j.done).slice(-60),
    ];
    return finish();
  }
  const elapsed = action.type === "advance-day" ? 86400 : (action.seconds ?? 1);
  if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > 86400) return state;
  next.time += elapsed;
  const today = simDate(next.time);
  for (const source of next.products) {
    const stale = source.lots.filter(
      (l) => lotExpired(l, today) && l.warehouse + l.shelf + l.backroom + l.transit > 0,
    );
    if (!stale.length) continue;
    const p = product(source.id)!;
    let removed = 0;
    for (const l of p.lots)
      if (lotExpired(l, today)) {
        const qty = l.warehouse + l.shelf + l.backroom + l.transit;
        removed += qty;
        l.expired += qty;
        l.warehouse = l.shelf = l.backroom = l.transit = 0;
      }
    for (const j of next.jobs)
      if (
        !j.done &&
        j.sku === p.id &&
        j.allocations.some((a) => stale.some((l) => l.id === a.lotId))
      ) {
        if (j.kind === "transfer" && j.stage >= 3)
          for (const a of j.allocations) {
            const l = p.lots.find((l) => l.id === a.lotId)!;
            if (!lotExpired(l, today)) {
              const bucket = j.stage === 3 ? "transit" : "backroom";
              l[bucket] -= a.quantity;
              l.warehouse += a.quantity;
            }
          }
        j.done = true;
        j.cancelled = true;
        event("Hủy quy trình do lô hết hạn", j.id, "amber");
      }
    event("Tự động cách ly lô hết hạn", `${p.name} · ${removed} ${p.unit}`, "amber", "store");
  }
  for (const j of next.jobs) {
    if (j.done) continue;
    const p = product(j.sku)!;
    if (j.kind === "inbound" && j.incomingExpiry && j.incomingExpiry < today) {
      j.done = true;
      j.cancelled = true;
      event("Từ chối lô nhập hết hạn", j.id, "amber");
      continue;
    }
    j.elapsed += elapsed;
    while (j.elapsed >= stageDuration && !j.done) {
      j.elapsed -= stageDuration;
      j.stage++;
      for (const a of j.allocations) {
        const l = p.lots.find((l) => l.id === a.lotId)!;
        if (j.kind === "transfer") {
          if (j.stage === 3) {
            l.warehouse -= a.quantity;
            l.transit += a.quantity;
          }
          if (j.stage === 4) {
            l.transit -= a.quantity;
            l.backroom += a.quantity;
          }
          if (j.stage === 6) {
            l.backroom -= a.quantity;
            l.shelf += a.quantity;
          }
        }
        if (j.kind === "sale" && j.stage === 3) l.shelf -= a.quantity;
      }
      j.done = j.stage === stages[j.kind].length - 1;
      if (j.done) {
        j.elapsed = 0;
        if (j.kind === "inbound") {
          p.lots.push({
            id: `${p.id}-${j.id}`,
            receivedDate: today,
            manufacturedDate: j.incomingExpiry
              ? dateAfter(j.incomingExpiry, -(p.shelfLifeDays ?? 0))
              : today,
            expiryDate: j.incomingExpiry ?? null,
            warehouse: j.quantity,
            shelf: 0,
            backroom: 0,
            transit: 0,
            damaged: 0,
            expired: 0,
          });
          next.received += j.quantity;
        }
        if (j.kind === "sale") {
          next.sold += j.quantity;
          next.revenue += j.quantity * p.price;
        }
        if (j.kind === "transfer") next.delivered += j.quantity;
      }
      event(
        j.done
          ? j.kind === "sale"
            ? "Thanh toán thành công"
            : j.kind === "transfer"
              ? "Đã bổ sung kệ bán"
              : "Đã nhập kho theo lô"
          : stages[j.kind][j.stage]!,
        `${j.id} · ${p.name} · ${j.quantity} ${p.unit}`,
        j.done ? "green" : "blue",
        j.kind === "sale" || (j.kind === "transfer" && j.stage >= 3) ? "store" : "warehouse",
      );
    }
  }
  if (action.type === "advance-day")
    event(
      "Chuyển sang ngày tiếp theo",
      `${today} · Kiểm tra HSD toàn bộ lô · Không tự tạo doanh số cho 24 giờ bỏ qua`,
      "green",
      "store",
    );
  let result = finish();
  if (
    result.autoRetail &&
    action.type === "tick" &&
    Math.floor(state.time / 60) !== Math.floor(result.time / 60) &&
    Math.floor(result.time / 3600) % 24 >= 7 &&
    Math.floor(result.time / 3600) % 24 < 21
  ) {
    const index = (result.demandCursor * 73 + 17) % result.products.length;
    const p = result.products[index]!;
    result = { ...result, demandCursor: result.demandCursor + 1 };
    const qty = Math.min(1 + (result.demandCursor % 3), p.shelf - reserved(result, p.id, "sale"));
    if (qty > 0) {
      const candidate = simulationReducer(result, {
        type: "create",
        kind: "sale",
        sku: p.id,
        quantity: qty,
      });
      if (!candidate.error) result = { ...candidate, error: state.error };
    }
    const stock = result.products[index]!;
    const amount = Math.min(
      stock.warehouse - reserved(result, stock.id, "transfer"),
      shelfSpace(result, stock),
      stock.reorderPoint * 2,
    );
    if (stock.shelf <= stock.reorderPoint + 3 && amount > 0) {
      const candidate = simulationReducer(result, {
        type: "create",
        kind: "transfer",
        sku: stock.id,
        quantity: amount,
      });
      if (!candidate.error) result = { ...candidate, error: state.error };
    }
  }
  return result;
}
