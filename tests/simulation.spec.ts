import { expect, test } from "@playwright/test";
import {
  initialSimulation,
  inTransit,
  reserved,
  simulationReducer,
  allocateFEFO,
  expiryInfo,
  type Simulation,
} from "../src/lib/simulation";
import {
  BASE_DATE,
  createCatalog,
  dateAfter,
  departments,
  lotUnits,
  syncProduct,
} from "../src/lib/grocery-catalog";

const tick = (s: Simulation, seconds: number) => simulationReducer(s, { type: "tick", seconds });
const total = (s: Simulation) =>
  s.products.reduce((n, p) => n + p.lots.reduce((a, l) => a + lotUnits(l), 0), 0);
const create = (
  s: Simulation,
  kind: "sale" | "inbound" | "transfer",
  quantity: number,
  sku = s.products[0]!.id,
) => simulationReducer(s, { type: "create", kind, quantity, sku });

test("catalogue has 3,000 distinct saleable variants, coherent lot dates and all three storage zones", () => {
  const products = createCatalog();
  expect(products).toHaveLength(3000);
  expect(new Set(products.map((p) => p.id)).size).toBe(3000);
  expect(new Set(products.map((p) => p.name + "|" + p.brand)).size).toBe(3000);
  expect(new Set(products.map((p) => p.storage)).size).toBe(3);
  expect(products.reduce((n, p) => n + p.lots.length, 0)).toBe(9025);
  for (const g of departments)
    expect(products.filter((p) => p.categoryId === g.id)).toHaveLength(g.count);
  const bad = products.filter(
    (p) =>
      p.shelf > p.shelfCapacity ||
      p.reorderPoint >= p.shelfCapacity ||
      p.price <= 0 ||
      p.lots.some(
        (l) =>
          l.manufacturedDate > l.receivedDate ||
          l.receivedDate > BASE_DATE ||
          (l.expiryDate !== null && l.manufacturedDate > l.expiryDate) ||
          [l.warehouse, l.shelf, l.transit, l.backroom, l.expired, l.damaged].some(
            (n) => !Number.isInteger(n) || n < 0,
          ) ||
          (l.expiryDate !== null &&
            l.expiryDate < BASE_DATE &&
            l.warehouse + l.shelf + l.transit + l.backroom > 0),
      ),
  );
  expect(bad.map((p) => p.id)).toEqual([]);
  expect(
    products
      .filter((p) => p.categoryId === "paper")
      .every((p) => p.lots.every((l) => l.expiryDate === null)),
  ).toBe(true);
  expect(
    products.filter((p) => p.categoryId === "seasoning").every((p) => !p.pack.includes("/")),
  ).toBe(true);
});

test("FEFO reserves across lots, prevents duplicate picks, and preserves stock through every transfer stage", () => {
  const original = initialSimulation(),
    p = original.products[0]!;
  let s = create(original, "transfer", 24);
  expect(s.error).toBe("");
  expect(s.jobs[0]!.allocations.map((a) => a.lotId)).toEqual([
    p.id + "-L01",
    p.id + "-L02",
    p.id + "-L03",
  ]);
  expect(reserved(s, p.id, "transfer")).toBe(24);
  expect(create(s, "transfer", 5).error).toContain("Chỉ còn 4");
  expect(simulationReducer(s, { type: "damage", sku: p.id, quantity: 5 }).error).toContain(
    "Chỉ còn 4",
  );
  s = tick(s, 15);
  expect(s.products[0]!.warehouse).toBe(p.warehouse - 24);
  expect(inTransit(s)).toBe(24);
  expect(reserved(s, p.id, "transfer")).toBe(0);
  expect(total(s)).toBe(total(original));
  s = tick(s, 5);
  expect(inTransit(s)).toBe(0);
  expect(s.products[0]!.backroom).toBe(24);
  s = tick(s, 10);
  expect(s.products[0]!.shelf).toBe(p.shelf + 24);
  expect(s.products[0]!.backroom).toBe(0);
  expect(s.delivered).toBe(24);
  expect(total(s)).toBe(total(original));
  expect(original.products[0]!.warehouse).toBe(28);
});

test("shelf capacity includes replenishments already on their way", () => {
  let s = initialSimulation();
  s.products[0] = syncProduct({ ...s.products[0]!, shelfCapacity: 20 });
  s = create(s, "transfer", 3);
  expect(s.error).toBe("");
  expect(create(s, "transfer", 2).error).toContain("còn 1 chỗ");
  s = tick(s, 20);
  expect(create(s, "transfer", 2).error).toContain("còn 1 chỗ");
  expect(tick(s, 10).products[0]!.shelf).toBe(19);
});

test("POS consumes the earliest shelf lot only on payment, records revenue and rejects overselling", () => {
  const original = { ...initialSimulation(), autoRetail: false },
    p = original.products[0]!;
  let s = create(original, "sale", 7);
  expect(s.jobs[0]!.allocations).toEqual([{ lotId: p.id + "-L01", quantity: 7 }]);
  expect(reserved(s, p.id, "sale")).toBe(7);
  expect(create(s, "sale", 10).error).toContain("Chỉ còn 9");
  expect(tick(s, 14).products[0]!.shelf).toBe(p.shelf);
  s = tick(s, 15);
  expect(s.products[0]!.shelf).toBe(p.shelf - 7);
  expect(s.sold).toBe(7);
  expect(s.revenue).toBe(7 * p.price);
  expect(total(s)).toBe(total(original) - 7);
  expect(tick(s, 100).sold).toBe(7);
});

test("inbound validates HSD and creates a separate dated lot only after receiving", () => {
  const original = initialSimulation(),
    p = original.products[0]!;
  for (const expiryDate of ["2026-09-13", "invalid", "2026-02-30", "2028-01-01", null]) {
    const s = simulationReducer(original, {
      type: "create",
      kind: "inbound",
      sku: p.id,
      quantity: 30,
      expiryDate,
    });
    expect(s.error).not.toBe("");
    expect(s.jobs).toHaveLength(0);
  }
  let s = simulationReducer(original, {
    type: "create",
    kind: "inbound",
    sku: p.id,
    quantity: 30,
    expiryDate: "2026-10-01",
  });
  expect(tick(s, 14).products[0]!.lots).toHaveLength(p.lots.length);
  s = tick(s, 15);
  expect(s.products[0]!.lots.at(-1)).toMatchObject({
    warehouse: 30,
    shelf: 0,
    expiryDate: "2026-10-01",
    receivedDate: BASE_DATE,
  });
  expect(total(s)).toBe(total(original) + 30);
  expect(s.received).toBe(30);
  const paper = original.products.find((p) => p.categoryId === "paper")!;
  const noExpiry = tick(create(original, "inbound", 9, paper.id), 15).products.find(
    (p) => p.id === paper.id,
  )!;
  expect(noExpiry.lots.at(-1)!.expiryDate).toBeNull();
});

test("next day quarantines every expired unit and leaves non-expiring household goods available", () => {
  const original = initialSimulation();
  const due = original.products
    .flatMap((p) => p.lots)
    .filter((l) => l.expiryDate === BASE_DATE)
    .reduce((n, l) => n + l.warehouse + l.shelf, 0);
  expect(due).toBeGreaterThan(0);
  const s = simulationReducer(original, { type: "advance-day" });
  expect(s.products.reduce((n, p) => n + p.expired, 0)).toBe(50 + due);
  expect(total(s)).toBe(total(original));
  expect(s.sold).toBe(0);
  expect(s.products.find((p) => p.categoryId === "paper")).toEqual(
    original.products.find((p) => p.categoryId === "paper"),
  );
  for (const p of s.products.filter((p) => p.lots.some((l) => l.expiryDate === BASE_DATE))) {
    expect(
      p.lots
        .filter((l) => l.expiryDate === BASE_DATE)
        .every((l) => l.warehouse + l.shelf + l.transit + l.backroom === 0),
    ).toBe(true);
    expect(
      allocateFEFO(s, p, "sale", 1).every(
        (a) => p.lots.find((l) => l.id === a.lotId)!.expiryDate! > BASE_DATE,
      ),
    ).toBe(true);
  }
});

test("midnight cancels a mixed-lot transfer and returns its still-valid goods without stock loss", () => {
  let original = initialSimulation();
  original = { ...original, time: 86379 };
  const p = {
    ...original.products[0]!,
    lots: original.products[0]!.lots.map((l, i) => ({
      ...l,
      expiryDate: i === 0 ? BASE_DATE : l.expiryDate,
    })),
  };
  original.products[0] = syncProduct(p);
  let s = create(original, "transfer", 10);
  s = tick(s, 20);
  expect(s.products[0]!.backroom).toBe(10);
  s = tick(s, 1);
  expect(s.jobs[0]!.cancelled).toBe(true);
  expect(s.products[0]!.backroom).toBe(0);
  expect(s.products[0]!.warehouse).toBe(p.warehouse - p.lots[0]!.warehouse);
  expect(reserved(s, p.id, "transfer")).toBe(0);
  expect(total(s)).toBe(total(original));
  expect(s.delivered).toBe(0);
});

test("accelerated ticks complete sales before midnight and cancel those finishing after expiry", () => {
  let base = initialSimulation();
  base = { ...base, time: 86380 };
  base.products[0] = syncProduct({
    ...base.products[0]!,
    lots: base.products[0]!.lots.map((l, i) => ({
      ...l,
      expiryDate: i === 0 ? BASE_DATE : l.expiryDate,
    })),
  });
  const before = tick(create(base, "sale", 3), 24);
  expect(before.sold).toBe(3);
  expect(before.jobs[0]!.cancelled).toBeUndefined();
  const after = tick(create({ ...base, time: 86395 }, "sale", 3), 24);
  expect(after.sold).toBe(0);
  expect(after.jobs[0]!.cancelled).toBe(true);
});

test("invalid quantities and blocked day skips preserve inventory; reset is deterministic", () => {
  const original = initialSimulation();
  for (const quantity of [0, -1, 1.5, 1001, NaN, Infinity]) {
    const s = create(original, "inbound", quantity);
    expect(s.error).not.toBe("");
    expect(total(s)).toBe(total(original));
    expect(tick(s, 1).error).toBe(s.error);
  }
  const active = create(original, "sale", 2);
  expect(simulationReducer(active, { type: "advance-day" }).time).toBe(active.time);
  expect(simulationReducer(tick(active, 15), { type: "reset" })).toEqual(initialSimulation());
});

test("mixed workflows and automatic shoppers conserve stock and keep quantities nonnegative", () => {
  let s = initialSimulation();
  const opening = total(s);
  for (const p of s.products.slice(0, 12)) {
    s = create(s, "transfer", 3, p.id);
    s = create(s, "sale", 2, p.id);
    s = create(s, "inbound", 10, p.id);
    expect(s.error).toBe("");
  }
  for (let i = 0; i < 30; i++) {
    s = tick(s, 1);
    expect(total(s)).toBe(opening + s.received - s.sold);
  }
  s = simulationReducer(s, { type: "auto-retail", enabled: true });
  s = tick(s, 3600);
  expect(s.sold).toBeGreaterThan(60);
  expect(s.demandCursor).toBe(60);
  expect(total(s)).toBe(opening + s.received - s.sold);
  expect(
    s.products.every(
      (p) =>
        p.shelf <= p.shelfCapacity &&
        p.lots.every((l) =>
          [l.warehouse, l.shelf, l.transit, l.backroom, l.expired, l.damaged].every((n) => n >= 0),
        ),
    ),
  ).toBe(true);
  expect(new Set(s.events.map((e) => e.id)).size).toBe(s.events.length);
  expect(expiryInfo(s.products[0]!, s.time).next).toBe(dateAfter(BASE_DATE, 2));
});

test("business orders reserve FEFO stock and follow the linked payment workflow", () => {
  const original = { ...initialSimulation(), autoRetail: false };
  const product = original.products[0]!;
  let state = simulationReducer(original, {
    type: "create",
    kind: "sale",
    sku: product.id,
    quantity: 6,
    order: {
      customerName: "Công ty Kiểm thử An Phú",
      customerType: "business",
      source: "manual",
    },
  });

  const order = state.orders[0]!;
  expect(order).toMatchObject({
    customerName: "Công ty Kiểm thử An Phú",
    customerType: "business",
    sku: product.id,
    quantity: 6,
    status: "pending",
    source: "manual",
  });
  expect(order.id).toMatch(/^ORD-/);
  expect(state.jobs[0]!.orderId).toBe(order.id);
  expect(state.jobs[0]!.allocations).toEqual([{ lotId: `${product.id}-L01`, quantity: 6 }]);
  expect(reserved(state, product.id, "sale")).toBe(6);

  state = tick(state, 5);
  expect(state.orders[0]!.status).toBe("processing");
  state = tick(state, 10);
  expect(state.orders[0]!.status).toBe("completed");
  expect(state.orders[0]!.completedAt).toBe(state.time);
  expect(state.products[0]!.shelf).toBe(product.shelf - 6);
  expect(state.revenue).toBe(6 * product.price);
  expect(total(state)).toBe(total(original) - 6);
});

test("Auto Order creates customer orders on schedule and can be paused independently", () => {
  let state = initialSimulation();
  const seededOrders = state.orders.length;
  state = tick(state, 60);
  expect(state.demandCursor).toBe(1);
  expect(state.orders).toHaveLength(seededOrders + 1);
  expect(state.orders[0]).toMatchObject({ source: "auto", status: "pending" });

  state = simulationReducer(state, { type: "auto-orders", enabled: false });
  const pausedCount = state.orders.length;
  state = tick(state, 60);
  expect(state.autoOrders).toBe(false);
  expect(state.demandCursor).toBe(2);
  expect(state.orders).toHaveLength(pausedCount);
});
