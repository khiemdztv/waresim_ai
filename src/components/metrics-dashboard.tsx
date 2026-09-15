import { useMemo } from "react";
import {
  Activity,
  Bot,
  BrainCircuit,
  Clock3,
  Gauge,
  Leaf,
  PackageX,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { calculateBusinessMetrics, demandForecast, evaluateAiSystem } from "@/lib/analytics";
import type { RescueDecision } from "@/lib/food-rescue";
import type { Simulation } from "@/lib/simulation";
import { can, type UserRole } from "@/lib/security";

const fmt = (value: number, digits = 0) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function MetricsDashboard({
  state,
  role,
  rescueDecisions,
  onOpenRescue,
}: {
  state: Simulation;
  role: UserRole;
  rescueDecisions: readonly RescueDecision[];
  onOpenRescue: () => void;
}) {
  const ai = useMemo(() => evaluateAiSystem(state), [state]);
  const business = useMemo(
    () => calculateBusinessMetrics(state, rescueDecisions),
    [state, rescueDecisions],
  );
  const forecast = useMemo(() => demandForecast(state), [state]);
  const aiCards = [
    {
      icon: BrainCircuit,
      label: "Routing Accuracy",
      value: `${fmt(ai.routingAccuracy, 1)}%`,
      detail: `${ai.passedRoutes}/${ai.totalRoutes} câu golden set`,
      target: "Mục tiêu ≥ 96%",
    },
    {
      icon: ShieldCheck,
      label: "Grounding / Faithfulness",
      value: `${fmt(ai.groundingRate, 1)}%`,
      detail: `${ai.passedGrounding}/${ai.totalGrounding} câu đủ bằng chứng`,
      target: "Mục tiêu ≥ 98%",
    },
    {
      icon: Bot,
      label: "Hallucination proxy",
      value: `${fmt(ai.hallucinationProxy, 1)}%`,
      detail: "Thiếu evidence trên bộ local",
      target: "Mục tiêu ≤ 2%",
    },
    {
      icon: Clock3,
      label: "P95 local retrieval",
      value: `${fmt(ai.p95LatencyMs, 2)} ms`,
      detail: "Router + Live State, chưa gồm Groq",
      target: "Mục tiêu < 100 ms",
    },
  ];
  const businessCards = [
    {
      icon: PackageX,
      label: "OOS Rate",
      value: `${fmt(business.oosRate, 2)}%`,
      detail: `${fmt(business.oosSkus)} / ${fmt(state.products.length)} SKU hết kệ`,
    },
    {
      icon: Leaf,
      label: "Food Rescue đã duyệt",
      value: `${fmt(business.rescuedUnits)} đơn vị`,
      detail: can(role, "financial:read")
        ? `${fmt(business.recoveredValueVnd)} ₫ bảo toàn · ${fmt(business.nearExpiryUnits)} đơn vị cận hạn`
        : `${fmt(business.nearExpiryUnits)} đơn vị cận hạn · giá trị bị ẩn bởi RBAC`,
    },
    {
      icon: Activity,
      label: "Picking & Restock",
      value: `−${business.restockTimeReduction}%`,
      detail: "30 giây mô phỏng so với baseline 50 giây",
    },
    {
      icon: TrendingUp,
      label: "Vòng quay trong phiên",
      value: `${fmt(business.sessionTurnover * 100, 3)}%`,
      detail: `${fmt(state.sold)} đơn vị bán / tồn vật lý`,
    },
  ];

  return (
    <div className="metrics-dashboard">
      <section className="metrics-hero">
        <div>
          <span className="sim-eyebrow">EVALUATION & BUSINESS IMPACT</span>
          <h2>Chỉ số AI có bằng chứng, KPI vận hành theo Live State</h2>
          <p>
            Kết quả AI bên dưới được chạy trực tiếp trên golden set tích hợp. KPI doanh nghiệp lấy
            từ snapshot hiện tại; không dùng số quảng cáo cố định.
          </p>
        </div>
        <button className="sim-button primary" onClick={onOpenRescue}>
          <Leaf size={16} /> Mở Food Rescue
        </button>
      </section>

      <div className="metrics-section-title">
        <div>
          <h3>AI System Metrics</h3>
          <p>Deterministic evaluation · có thể tái tạo local</p>
        </div>
        <span>
          <i /> Đã chạy trên snapshot hiện tại
        </span>
      </div>
      <div className="metrics-card-grid">
        {aiCards.map(({ icon: Icon, label, value, detail, target }) => (
          <article className="metrics-eval-card" key={label}>
            <span>
              <Icon size={18} />
            </span>
            <small>{label}</small>
            <strong>{value}</strong>
            <p>{detail}</p>
            <footer>{target}</footer>
          </article>
        ))}
      </div>

      <div className="metrics-section-title">
        <div>
          <h3>Business KPIs</h3>
          <p>Live State · cập nhật cùng mô phỏng</p>
        </div>
        <span className="amber">
          <Gauge size={13} /> {fmt(business.activeAlerts)} cảnh báo live
        </span>
      </div>
      <div className="metrics-card-grid business">
        {businessCards.map(({ icon: Icon, label, value, detail }) => (
          <article className="metrics-eval-card" key={label}>
            <span>
              <Icon size={18} />
            </span>
            <small>{label}</small>
            <strong>{value}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>

      <section className="metrics-forecast">
        <div className="sim-panel-title">
          <div>
            <h2>Dự báo nhu cầu nhẹ & Dynamic Reorder Point</h2>
            <p>Daily demand + safety stock 95% · lead time giả định 2 ngày · không cần ML server</p>
          </div>
          <span className="metrics-model-badge">LOCAL MODEL · FREE</span>
        </div>
        <div className="sim-table-scroll">
          <table className="sim-table">
            <thead>
              <tr>
                <th>SKU ưu tiên</th>
                <th>Nhu cầu/ngày</th>
                <th>Tồn khả dụng</th>
                <th>Độ phủ</th>
                <th>Điểm đặt động</th>
                <th>Đề xuất nhập</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((row) => (
                <tr key={row.sku}>
                  <td>
                    <b>{row.sku}</b>
                    <small className="sim-table-sku">{row.name}</small>
                  </td>
                  <td>{fmt(row.dailyDemand, 1)}</td>
                  <td>{fmt(row.available)}</td>
                  <td>
                    <b>{fmt(row.daysCover, 1)} ngày</b>
                  </td>
                  <td>{fmt(row.dynamicReorderPoint)}</td>
                  <td>
                    <span className={row.suggestedOrder > 0 ? "forecast-order" : "forecast-ok"}>
                      {row.suggestedOrder > 0 ? `+${fmt(row.suggestedOrder)}` : "Đủ tồn"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
