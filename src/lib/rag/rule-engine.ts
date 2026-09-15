import { deriveOperationalAlerts, type OperationalAlert } from "../operational-alerts";
import type { Simulation } from "../simulation";

/**
 * Adapter cho kiến trúc RAG: rule engine quyết định cảnh báo,
 * AI chỉ đọc, giải thích và đề xuất.
 */
class RuleEngine {
  private alerts: OperationalAlert[] = [];

  scan(state: Simulation) {
    this.alerts = deriveOperationalAlerts(state);
    return this.alerts;
  }

  getActiveAlerts() {
    return this.alerts;
  }
}

export const ruleEngine = new RuleEngine();
