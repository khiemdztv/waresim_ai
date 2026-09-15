import { departments, simDate, storageLabels, type Product } from "../grocery-catalog";
import { clockLabel, expiryInfo, reserved, stages, type Simulation } from "../simulation";
import {
  deriveOperationalAlerts,
  explainOperationalAlert,
  type OperationalAlert,
} from "../operational-alerts";
import { knowledgeBase, type KnowledgeDocument } from "./knowledge-base";
import { inspectPrompt } from "../security";

export type AnswerSource =
  "LIVE STATE" | "EVENT HISTORY" | "SOP" | "KNOWLEDGE RAG" | "HYBRID RAG" | "SECURITY GUARDRAIL";

export type WarehouseAnswer = {
  text: string;
  source: AnswerSource;
  snapshot: string;
  citations?: string[];
  matchedSku?: string;
  aiText?: string;
  model?: string;
  aiError?: string;
  blocked?: boolean;
  guardrailCode?: string;
};

const fmt = (value: number) => value.toLocaleString("vi-VN");
const orderStatusLabels = {
  pending: "chờ lấy hàng",
  processing: "đang xử lý",
  completed: "hoàn tất",
  cancelled: "đã hủy",
} as const;
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
const snapshot = (state: Simulation) => `${simDate(state.time)} · ${clockLabel(state.time)}`;
const available = (product: Product) =>
  product.warehouse +
  product.shelf +
  product.backroom +
  product.lots.reduce((sum, lot) => sum + lot.transit, 0);
const displayDate = (value: string | null) =>
  value ? value.split("-").reverse().join("/") : "không áp dụng";

function findSku(query: string, state: Simulation) {
  const match = query.match(/sku[\s-]?(\d{1,4})/i);
  if (!match) return undefined;
  return state.products.find((product) => product.id === `SKU-${match[1]!.padStart(4, "0")}`);
}

function findLot(query: string, state: Simulation) {
  const match = query.match(/sku-?\d{4}-(?:l\d{2}|qc)/i);
  if (!match) return undefined;
  const id = match[0].toUpperCase().replace(/^SKU(?=\d)/, "SKU-");
  for (const product of state.products) {
    const lot = product.lots.find((item) => item.id.toUpperCase() === id);
    if (lot) return { product, lot };
  }
  return undefined;
}

function productScore(query: string, product: Product) {
  const normalized = fold(query);
  const name = fold(product.name);
  const brand = fold(product.brand);
  if (normalized.includes(fold(product.id))) return 100;
  if (normalized.includes(name)) return 90;
  const base = name.replace(/\s(?:\d|loc|thung|tui|hop|cuon).*$/, "").trim();
  if (base.length >= 5 && normalized.includes(base)) return 70 + base.length / 100;
  const words = base.split(" ").filter((word) => word.length > 2);
  const hits = words.filter((word) => normalized.includes(word)).length;
  return hits >= 2 ? 30 + hits : brand.length > 3 && normalized.includes(brand) ? 10 : 0;
}

function findProducts(query: string, state: Simulation) {
  return state.products
    .map((product) => ({ product, score: productScore(query, product) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
}

const categoryAliases: Record<string, string[]> = {
  water: ["nuoc ngot", "nuoc uong"],
  dairy: ["sua", "sua chua"],
  cleaning: ["ve sinh nha", "giat giu"],
  personal: ["cham soc ca nhan"],
  instant: ["mi an lien", "bun pho"],
  snacks: ["banh keo", "an vat"],
  seasoning: ["gia vi", "dau an"],
  vegetables: ["rau"],
  roots: ["cu qua", "nam"],
  fruit: ["trai cay"],
  frozen: ["dong lanh"],
  eggs: ["trung", "dau hu"],
  meat: ["thit"],
  seafood: ["ca hai san", "hai san"],
};

function findCategory(query: string) {
  const normalized = fold(query);
  return [...departments]
    .sort((a, b) => b.name.length - a.name.length)
    .find(
      (group) =>
        normalized.includes(fold(group.name)) ||
        normalized.includes(fold(group.short)) ||
        (categoryAliases[group.id] ?? []).some((alias) => normalized.includes(alias)),
    );
}

function productAnswer(product: Product, state: Simulation, includeLots = false): WarehouseAnswer {
  const expiry = expiryInfo(product, state.time);
  const transit = product.lots.reduce((sum, lot) => sum + lot.transit, 0);
  const lotLines = includeLots
    ? `\n${[...product.lots]
        .sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999"))
        .map(
          (lot) =>
            `• ${lot.id}: HSD ${displayDate(lot.expiryDate)} · kho ${lot.warehouse} · kệ ${lot.shelf} · chờ/xe ${lot.backroom + lot.transit} · cách ly ${lot.damaged + lot.expired}`,
        )
        .join("\n")}`
    : "";
  return {
    text:
      `${product.id} · ${product.name} · ${product.brand}\n` +
      `Kho dự trữ: ${fmt(product.warehouse)}; kệ ${product.displayBay}: ${fmt(product.shelf)}/${fmt(product.shelfCapacity)}; chờ lên kệ: ${fmt(product.backroom)}; đang trên xe: ${fmt(transit)}; cách ly: ${fmt(product.damaged)} (${fmt(product.expired)} hết hạn).\n` +
      `Giữ chỗ: ${fmt(reserved(state, product.id, "transfer"))} để bổ sung, ${fmt(reserved(state, product.id, "sale"))} để bán. Tổng khả dụng: ${fmt(available(product))} ${product.unit}.\n` +
      `HSD gần nhất: ${displayDate(expiry.next)}${expiry.days === null ? "" : ` (còn ${expiry.days} ngày)`}; ${fmt(expiry.nearUnits)} ${product.unit} cận hạn. Bảo quản: ${storageLabels[product.storage]}; kho ${product.warehouseBay}.` +
      lotLines,
    source: "LIVE STATE",
    snapshot: snapshot(state),
    citations: ["Live State SKU", "Live State theo lô"],
    matchedSku: product.id,
  };
}

function aggregateAnswer(title: string, products: Product[], state: Simulation): WarehouseAnswer {
  const totals = products.reduce(
    (sum, product) => ({
      sku: sum.sku + 1,
      warehouse: sum.warehouse + product.warehouse,
      shelf: sum.shelf + product.shelf,
      backroom: sum.backroom + product.backroom,
      transit: sum.transit + product.lots.reduce((count, lot) => count + lot.transit, 0),
      damaged: sum.damaged + product.damaged,
      low: sum.low + Number(product.shelf <= product.reorderPoint),
      near: sum.near + expiryInfo(product, state.time).nearUnits,
    }),
    { sku: 0, warehouse: 0, shelf: 0, backroom: 0, transit: 0, damaged: 0, low: 0, near: 0 },
  );
  return {
    text:
      `${title}: ${fmt(totals.sku)} SKU.\n` +
      `Kho dự trữ: ${fmt(totals.warehouse)}; kệ bán: ${fmt(totals.shelf)}; chờ lên kệ: ${fmt(totals.backroom)}; đang trên xe: ${fmt(totals.transit)}; cách ly: ${fmt(totals.damaged)} đơn vị.\n` +
      `${fmt(totals.low)} SKU chạm/ngang ngưỡng bổ sung; ${fmt(totals.near)} đơn vị cận hạn.`,
    source: "LIVE STATE",
    snapshot: snapshot(state),
    citations: ["Live State tổng hợp SKU", "Rule Engine"],
  };
}

function overviewAnswer(state: Simulation): WarehouseAnswer {
  const lots = state.products.reduce((count, product) => count + product.lots.length, 0);
  const alerts = deriveOperationalAlerts(state);
  const critical = alerts.filter((alert) => alert.severity === "critical").length;
  const inventory = aggregateAnswer("Toàn cửa hàng", state.products, state).text;
  return {
    text:
      `${inventory}\n` +
      `Danh mục: ${fmt(state.products.length)} SKU, ${fmt(lots)} lô, ${departments.length} nhóm hàng. ` +
      `Phiên có ${state.jobs.filter((job) => !job.done).length} tác vụ đang chạy, đã bán ${fmt(state.sold)} đơn vị và doanh thu ${fmt(state.revenue)} ₫. ` +
      `Rule Engine đang ghi nhận ${fmt(alerts.length)} cảnh báo, gồm ${fmt(critical)} cảnh báo đỏ.`,
    source: "LIVE STATE",
    snapshot: snapshot(state),
    citations: ["Live State", "Danh mục sản phẩm", "Rule Engine"],
  };
}

function alertAnswer(alert: OperationalAlert, state: Simulation): WarehouseAnswer {
  const analysis = explainOperationalAlert(alert, state);
  return {
    text:
      `[${alert.severity === "critical" ? "ĐỎ" : "CẦN THEO DÕI"}] ${alert.title}\n` +
      `Nguyên nhân: ${analysis.cause}\nẢnh hưởng: ${analysis.impact}\n` +
      `Bằng chứng:\n${analysis.evidence.map((item) => `• ${item}`).join("\n")}\n` +
      `Đề xuất Hybrid RAG:\n${analysis.actions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    source: "HYBRID RAG",
    snapshot: snapshot(state),
    citations: analysis.sources,
    matchedSku: alert.sku,
  };
}

function knowledgeAnswer(docs: KnowledgeDocument[], state: Simulation): WarehouseAnswer {
  const isSop = docs[0]?.type === "SOP" || docs[0]?.type === "POLICY";
  return {
    text: docs.map((doc) => `${doc.title}\n${doc.content}`).join("\n\n"),
    source: isSop ? "SOP" : "KNOWLEDGE RAG",
    snapshot: snapshot(state),
    citations: docs.map((doc) => `${doc.type} · ${doc.title}`),
  };
}

export function answerWarehouseQuery(query: string, state: Simulation): WarehouseAnswer {
  const normalized = fold(query.trim());
  if (!normalized)
    return {
      text: "Hãy hỏi về phần mềm, dữ liệu, SKU, lô, kệ, HSD, cảnh báo, tác vụ hoặc quy trình vận hành.",
      source: "KNOWLEDGE RAG",
      snapshot: snapshot(state),
      citations: ["Phạm vi trợ lý WareSim"],
    };

  const guardrail = inspectPrompt(query);
  if (!guardrail.safe)
    return {
      text: `Yêu cầu đã chặn bởi AI Guardrail (${guardrail.code}). ${guardrail.reason} WareSim chỉ cung cấp dữ liệu vận hành đã được phân quyền; AI không thể tự thực thi giao dịch hoặc tiết lộ bí mật hệ thống.`,
      source: "SECURITY GUARDRAIL",
      snapshot: snapshot(state),
      citations: ["Input Guardrail", "RBAC Policy", "Human-in-the-loop"],
      blocked: true,
      guardrailCode: guardrail.code,
    };

  const sku = findSku(query, state);
  const lotMatch = findLot(query, state);
  const matches = sku ? [{ product: sku, score: 100 }] : findProducts(query, state);
  const exactProduct = matches[0]?.product;
  const bayMatch = normalized.match(/(?:ke|shelf)\s*([abc])\s*([1-7])/);
  const asksHistory = /lich su|truoc do|gan day|da xay ra|nhat ky|event/.test(normalized);
  const asksAlert = /canh bao|thong bao do|het ke|ton thap|bat thuong|vi sao.*(do|thieu|het)/.test(
    normalized,
  );
  const asksLots = /\blo\b|han su dung|\bhsd\b/.test(normalized);
  const asksOrders =
    /don dat hang|don hang|auto order|khach hang|doanh nghiep|cong ty|don vi|ord-\d+/.test(
      normalized,
    );

  if (asksOrders) {
    const orderId = query.match(/ord-\d+/i)?.[0].toUpperCase();
    const exactOrder = orderId ? state.orders.find((order) => order.id === orderId) : undefined;
    if (orderId && !exactOrder)
      return {
        text: `Không tìm thấy ${orderId} trong phiên hiện tại. Bạn có thể mở tab Đơn đặt hàng để xem danh sách mới nhất.`,
        source: "LIVE STATE",
        snapshot: snapshot(state),
        citations: ["Live State đơn đặt hàng"],
      };
    if (exactOrder) {
      const product = state.products.find((item) => item.id === exactOrder.sku);
      return {
        text:
          `${exactOrder.id} · ${exactOrder.customerName} · ${exactOrder.customerType === "business" ? "công ty/đơn vị" : "khách cá nhân"}.\n` +
          `${exactOrder.quantity} × ${product?.name ?? exactOrder.sku} (${exactOrder.sku}); trạng thái ${orderStatusLabels[exactOrder.status]}; nguồn ${exactOrder.source === "auto" ? "Auto Order" : "nhập tay"}.\n` +
          `Tác vụ liên kết: ${exactOrder.jobId}; tạo lúc ${clockLabel(exactOrder.createdAt)}${exactOrder.completedAt ? `, hoàn tất lúc ${clockLabel(exactOrder.completedAt)}` : ""}.`,
        source: "HYBRID RAG",
        snapshot: snapshot(state),
        citations: ["Live State đơn đặt hàng", "Event History", "SOP đơn đặt hàng và FEFO"],
        matchedSku: exactOrder.sku,
      };
    }

    const activeOrders = state.orders.filter(
      (order) => order.status === "pending" || order.status === "processing",
    );
    const completedOrders = state.orders.filter((order) => order.status === "completed");
    const businessOrders = state.orders.filter((order) => order.customerType === "business");
    const recent = state.orders.slice(0, 6);
    return {
      text:
        `Đơn đặt hàng: ${fmt(activeOrders.length)} đang xử lý, ${fmt(completedOrders.length)} đã hoàn tất, ${fmt(businessOrders.length)} đơn công ty/đơn vị. Auto Order hiện ${state.autoOrders ? "đang bật" : "đã tạm dừng"}.` +
        (recent.length
          ? `\nGần nhất:\n${recent
              .map(
                (order) =>
                  `• ${order.id} · ${order.customerName} · ${order.quantity} × ${order.sku} · ${orderStatusLabels[order.status]} · ${order.source === "auto" ? "auto" : "nhập tay"}`,
              )
              .join("\n")}`
          : "\nChưa có đơn nào trong phiên."),
      source: "HYBRID RAG",
      snapshot: snapshot(state),
      citations: ["Live State đơn đặt hàng", "SOP đơn đặt hàng và FEFO"],
    };
  }

  if (asksHistory) {
    const events = state.events
      .filter(
        (event) =>
          !exactProduct ||
          fold(event.detail).includes(fold(exactProduct.name)) ||
          fold(event.detail).includes(fold(exactProduct.id)),
      )
      .slice(0, 10);
    return {
      text: events.length
        ? `Các sự kiện gần nhất${exactProduct ? ` của ${exactProduct.id}` : ""}:\n${events.map((event) => `• ${clockLabel(event.time)} · ${event.title}: ${event.detail}`).join("\n")}`
        : `Chưa có sự kiện nào cho ${exactProduct?.id ?? "phạm vi này"} trong bộ nhớ phiên.`,
      source: "EVENT HISTORY",
      snapshot: snapshot(state),
      citations: ["Event History của phiên mô phỏng"],
      ...(exactProduct ? { matchedSku: exactProduct.id } : {}),
    };
  }

  if (asksAlert) {
    const alerts = deriveOperationalAlerts(state);
    if (exactProduct) {
      const productAlert = alerts.find((alert) => alert.sku === exactProduct.id);
      if (productAlert) return alertAnswer(productAlert, state);
      return {
        text: `${exactProduct.id} hiện không kích hoạt cảnh báo nào. Kệ ${exactProduct.displayBay} còn ${exactProduct.shelf}/${exactProduct.shelfCapacity}, ngưỡng bổ sung ${exactProduct.reorderPoint}; hàng cách ly ${exactProduct.damaged}.`,
        source: "HYBRID RAG",
        snapshot: snapshot(state),
        citations: ["Rule Engine", "Live State SKU"],
        matchedSku: exactProduct.id,
      };
    }
    const critical = alerts.filter((alert) => alert.severity === "critical");
    const byCode = alerts.reduce<Record<string, number>>((counts, alert) => {
      counts[alert.code] = (counts[alert.code] ?? 0) + 1;
      return counts;
    }, {});
    return {
      text:
        `Có ${fmt(alerts.length)} cảnh báo theo luật: ${fmt(critical.length)} cảnh báo đỏ và ${fmt(alerts.length - critical.length)} cần theo dõi.\n` +
        `Hết kệ: ${fmt(byCode["OUT_OF_STOCK"] ?? 0)}; tồn thấp: ${fmt(byCode["LOW_STOCK"] ?? 0)}; cận hạn: ${fmt(byCode["EXPIRY_NEAR"] ?? 0)}; hết hạn/cách ly: ${fmt(byCode["EXPIRED_QUARANTINE"] ?? 0)}.\n` +
        `Ưu tiên xử lý:\n${alerts
          .slice(0, 6)
          .map(
            (alert) =>
              `• [${alert.severity === "critical" ? "ĐỎ" : "CAM"}] ${alert.sku}: ${alert.title}. ${alert.recommendation}`,
          )
          .join(
            "\n",
          )}\nMở biểu tượng tam giác đỏ để xem nguyên nhân, bằng chứng và thao tác cho từng cảnh báo.`,
      source: "HYBRID RAG",
      snapshot: snapshot(state),
      citations: ["Rule Engine", "Live State", "SOP bổ sung kệ", "SOP HSD/FEFO"],
    };
  }

  if (lotMatch) {
    const { product, lot } = lotMatch;
    return {
      text:
        `${lot.id} thuộc ${product.id} · ${product.name}.\n` +
        `Sản xuất: ${displayDate(lot.manufacturedDate)}; nhận: ${displayDate(lot.receivedDate)}; HSD: ${displayDate(lot.expiryDate)}.\n` +
        `Kho: ${lot.warehouse}; kệ ${product.displayBay}: ${lot.shelf}; chờ lên kệ: ${lot.backroom}; đang di chuyển: ${lot.transit}; hỏng: ${lot.damaged}; hết hạn: ${lot.expired}.`,
      source: "LIVE STATE",
      snapshot: snapshot(state),
      citations: ["Live State theo lô"],
      matchedSku: product.id,
    };
  }

  if (exactProduct && (sku || matches.length <= 5 || productScore(query, exactProduct) >= 70))
    return productAnswer(exactProduct, state, asksLots);

  if (bayMatch) {
    const bay = `${bayMatch[1]!.toUpperCase()}${bayMatch[2]}`;
    const products = state.products.filter((product) => product.displayBay === bay);
    return aggregateAnswer(
      `Kệ/nhóm ${bay} · ${products[0]?.category ?? "không xác định"}`,
      products,
      state,
    );
  }

  const category = findCategory(query);
  if (category)
    return aggregateAnswer(
      category.name,
      state.products.filter((product) => product.categoryId === category.id),
      state,
    );

  if (
    /hang nao|san pham nao|sku nao/.test(normalized) &&
    /can han|sap het han|hsd/.test(normalized)
  ) {
    const products = state.products
      .map((product) => ({ product, expiry: expiryInfo(product, state.time) }))
      .filter(({ expiry }) => expiry.nearUnits > 0)
      .sort((a, b) => (a.expiry.days ?? 9999) - (b.expiry.days ?? 9999))
      .slice(0, 10);
    return {
      text: products.length
        ? `Các SKU cần ưu tiên theo HSD:\n${products.map(({ product, expiry }) => `• ${product.id} · ${product.name}: ${expiry.nearUnits} ${product.unit}, HSD ${displayDate(expiry.next)} (còn ${expiry.days} ngày)`).join("\n")}`
        : "Không có SKU cận hạn trong snapshot hiện tại.",
      source: "LIVE STATE",
      snapshot: snapshot(state),
      citations: ["Live State theo lô", "Chính sách FEFO"],
    };
  }

  if (/het han|can han|hsd|han su dung/.test(normalized)) {
    const near = state.products.filter((product) => expiryInfo(product, state.time).nearUnits > 0);
    const expired = state.products.filter((product) => product.expired > 0);
    return {
      text: `Hạn sử dụng: ${fmt(near.reduce((sum, product) => sum + expiryInfo(product, state.time).nearUnits, 0))} đơn vị thuộc ${fmt(near.length)} SKU đang cận hạn; ${fmt(expired.reduce((sum, product) => sum + product.expired, 0))} đơn vị thuộc ${fmt(expired.length)} SKU đã hết hạn và được cách ly.`,
      source: "LIVE STATE",
      snapshot: snapshot(state),
      citations: ["Live State theo lô", "Chính sách FEFO"],
    };
  }

  if (/dang chuyen|dang chay|tac vu|cong viec/.test(normalized)) {
    const jobs = state.jobs.filter((job) => !job.done);
    return {
      text: jobs.length
        ? `Có ${jobs.length} tác vụ đang chạy:\n${jobs
            .slice(0, 10)
            .map(
              (job) =>
                `• ${job.id} · ${job.sku} · ${job.quantity} · ${stages[job.kind][job.stage]}`,
            )
            .join("\n")}`
        : "Hiện không có tác vụ nhập, bổ sung hoặc thanh toán đang chạy.",
      source: "LIVE STATE",
      snapshot: snapshot(state),
      citations: ["Live State tác vụ"],
    };
  }

  if (/doanh thu|da ban|ban duoc/.test(normalized))
    return {
      text: `Phiên hiện tại đã bán ${fmt(state.sold)} đơn vị, doanh thu mô phỏng ${fmt(state.revenue)} ₫. Có ${state.jobs.filter((job) => job.kind === "sale" && !job.done).length} lượt thanh toán đang xử lý.`,
      source: "LIVE STATE",
      snapshot: snapshot(state),
      citations: ["Live State POS"],
    };

  if (
    /bao nhieu sku|so luong sku|bao nhieu lo|tong quan|hien trang|toan bo kho|tong ton/.test(
      normalized,
    )
  )
    return overviewAnswer(state);

  const docs = knowledgeBase.search(query);
  if (docs.length) return knowledgeAnswer(docs, state);

  if (/kho|hang|ke|phan mem|waresim|du lieu|quy trinh|chuc nang|rag|ai/.test(normalized))
    return knowledgeAnswer(
      knowledgeBase
        .getAll()
        .filter((doc) => ["guide_modules", "data_realtime", "guide_chat"].includes(doc.id)),
      state,
    );

  return {
    text: "Mình chưa nhận ra đối tượng cụ thể. Trong phạm vi WareSim, bạn có thể hỏi tự nhiên về chức năng phần mềm, cấu trúc dữ liệu, số SKU/lô, tên hàng, kệ, HSD, cảnh báo, tác vụ, lịch sử, doanh thu hoặc SOP nhập–bổ sung–bán–cách ly. Nếu hỏi một mặt hàng, hãy kèm tên hoặc mã SKU để có số liệu chính xác.",
    source: "KNOWLEDGE RAG",
    snapshot: snapshot(state),
    citations: ["Phạm vi trợ lý WareSim"],
  };
}

export class QueryRouter {
  processQuery(query: string, state: Simulation) {
    return Promise.resolve(answerWarehouseQuery(query, state));
  }
}

export const queryRouter = new QueryRouter();
