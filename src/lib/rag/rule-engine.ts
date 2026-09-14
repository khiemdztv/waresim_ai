import { Simulation } from "../grocery-simulation";
import { liveState } from "./live-state";

export interface SystemAlert {
  id: string;
  sku: string;
  message: string;
  level: "WARNING" | "CRITICAL";
  timestamp: Date;
}

class RuleEngine {
  private alerts: SystemAlert[] = [];

  // Gọi hàm này sau mỗi vòng tick của simulator
  scan(state: Simulation) {
    this.alerts = []; // Reset alerts for simple simulation, in real app keep track
    
    for (const product of state.products) {
      // Rule 1: Hàng trên kệ < ngưỡng (Low Shelf Stock)
      if (product.shelf < product.reorderPoint) {
        this.alerts.push({
          id: `ALERT-LOW-${product.id}`,
          sku: product.id,
          message: `Kệ hàng ${product.displayBay} đang có lượng tồn (${product.shelf}) thấp hơn ngưỡng (${product.reorderPoint}).`,
          level: product.shelf === 0 ? "CRITICAL" : "WARNING",
          timestamp: new Date()
        });
      }
      
      // Rule 2: Cảnh báo hàng sắp hết hạn có thể thêm ở đây...
    }
    
    return this.alerts;
  }

  getActiveAlerts() {
    return this.alerts;
  }
}

export const ruleEngine = new RuleEngine();
