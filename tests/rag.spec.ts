import { expect, test } from "@playwright/test";
import { answerWarehouseQuery } from "../src/lib/rag/query-router";
import { deriveOperationalAlerts, explainOperationalAlert } from "../src/lib/operational-alerts";
import { initialSimulation, simulationReducer } from "../src/lib/simulation";

test("current-state answers are grounded in the supplied snapshot and update after inventory changes", () => {
  const initial = initialSimulation();
  const first = answerWarehouseQuery("SKU-1 còn bao nhiêu?", initial);
  expect(first.source).toBe("LIVE STATE");
  expect(first.matchedSku).toBe("SKU-0001");
  expect(first.text).toContain("Kho dự trữ: 28");
  expect(first.text).toContain("kệ A1: 16/60");
  let changed = simulationReducer(initial, {
    type: "create",
    kind: "sale",
    sku: "SKU-0001",
    quantity: 2,
  });
  changed = simulationReducer(changed, { type: "tick", seconds: 15 });
  const second = answerWarehouseQuery("SKU-0001 hiện tại", changed);
  expect(second.text).toContain("kệ A1: 14/60");
  expect(second.snapshot).not.toBe("");
});

test("router aggregates shelves and categories from live products without inventing a SKU", () => {
  const state = initialSimulation();
  const shelf = answerWarehouseQuery("Kệ A1 đang có gì?", state);
  expect(shelf.text).toContain("Nước uống & nước ngọt: 180 SKU");
  expect(shelf.text).toContain("Kho dự trữ: 3.957");
  const category = answerWarehouseQuery("Hiện trạng nhóm sữa", state);
  expect(category.text).toContain("280 SKU");
  expect(category.source).toBe("LIVE STATE");
});

test("alerts are deterministic and SOP/history use their own named sources", () => {
  const state = initialSimulation();
  const alerts = deriveOperationalAlerts(state);
  expect(alerts.length).toBeGreaterThan(400);
  expect(alerts.some((alert) => alert.code === "EXPIRED_QUARANTINE")).toBe(true);
  const alertAnswer = answerWarehouseQuery("Có cảnh báo nào?", state);
  expect(alertAnswer.text).toContain("cảnh báo theo luật");
  expect(alertAnswer.source).toBe("HYBRID RAG");
  expect(alertAnswer.citations).toContain("Rule Engine");
  expect(answerWarehouseQuery("Hướng dẫn FEFO", state).source).toBe("SOP");
  expect(answerWarehouseQuery("Nhật ký gần đây", state).source).toBe("EVENT HISTORY");
});

test("assistant covers software, data, process, lot and aggregate questions", () => {
  const state = initialSimulation();
  const scope = answerWarehouseQuery("Phần mềm này có những chức năng gì?", state);
  expect(scope.source).toBe("KNOWLEDGE RAG");
  expect(scope.text).toContain("Quản lý tồn kho");
  expect(scope.text).toContain("trung tâm cảnh báo");

  const totals = answerWarehouseQuery("Có bao nhiêu SKU và lô?", state);
  expect(totals.source).toBe("LIVE STATE");
  expect(totals.text).toContain("3.000 SKU");
  expect(totals.text).toContain("9.025 lô");

  const realtime = answerWarehouseQuery("Dữ liệu realtime lấy từ đâu?", state);
  expect(realtime.source).toBe("KNOWLEDGE RAG");
  expect(realtime.text).toContain("Live State");
  expect(realtime.text).toContain("Event History");

  const process = answerWarehouseQuery("Quy trình bổ sung kệ hoạt động thế nào?", state);
  expect(process.source).toBe("SOP");
  expect(process.text).toContain("FEFO");

  const lot = answerWarehouseQuery("Cho tôi dữ liệu SKU-0001-L01", state);
  expect(lot.source).toBe("LIVE STATE");
  expect(lot.text).toContain("SKU-0001-L01 thuộc SKU-0001");
});

test("each alert has grounded evidence and actionable Hybrid RAG advice", () => {
  const state = initialSimulation();
  const alert = deriveOperationalAlerts(state)[0]!;
  const explanation = explainOperationalAlert(alert, state);
  expect(explanation.evidence.length).toBeGreaterThan(2);
  expect(explanation.actions.length).toBeGreaterThan(1);
  expect(explanation.sources).toContain("Live State SKU");

  const answer = answerWarehouseQuery(`Giải thích cảnh báo ${alert.sku}`, state);
  expect(answer.source).toBe("HYBRID RAG");
  expect(answer.text).toContain("Nguyên nhân:");
  expect(answer.text).toContain("Đề xuất Hybrid RAG:");
  expect(answer.matchedSku).toBe(alert.sku);
});

test("RAG explains customer orders from live state and the order SOP", () => {
  let state = initialSimulation();
  state = simulationReducer(state, {
    type: "create",
    kind: "sale",
    sku: "SKU-0001",
    quantity: 3,
    order: {
      customerName: "Công ty Minh Long",
      customerType: "business",
      source: "manual",
    },
  });
  const id = state.orders[0]!.id;

  const overview = answerWarehouseQuery("Các đơn đặt hàng của công ty hiện thế nào?", state);
  expect(overview.source).toBe("HYBRID RAG");
  expect(overview.text).toContain("đơn công ty/đơn vị");
  expect(overview.text).toContain(id);
  expect(overview.citations).toContain("SOP đơn đặt hàng và FEFO");

  const detail = answerWarehouseQuery(`Chi tiết ${id}`, state);
  expect(detail.text).toContain("Công ty Minh Long");
  expect(detail.text).toContain("chờ lấy hàng");
  expect(detail.matchedSku).toBe("SKU-0001");
});
