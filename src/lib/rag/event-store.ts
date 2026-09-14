import { SimEvent } from "../grocery-simulation";

/**
 * Event Store (Append-only)
 * Lưu trữ toàn bộ lịch sử hệ thống (Cold Data).
 */
class EventStore {
  private events: SimEvent[] = [];

  append(event: SimEvent) {
    this.events.push(event);
  }

  // Truy vấn lịch sử (Temporal Query)
  queryHistory(sku?: string, limit: number = 20): SimEvent[] {
    // Nếu có sku, filter theo detail chứa sku (vì hiện tại simulator nhét sku vào detail)
    let results = this.events;
    if (sku) {
      results = results.filter(e => e.detail.includes(sku) || e.title.includes(sku));
    }
    // Trả về N sự kiện mới nhất
    return results.slice(-limit).reverse();
  }

  getAll() {
    return this.events;
  }
}

export const eventStore = new EventStore();
