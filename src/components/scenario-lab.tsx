import { useState } from "react";
import { AlertTriangle, Bot, CloudLightning, PackageSearch, Play, Truck } from "lucide-react";
import {
  runWhatIfScenario,
  type ScenarioConfig,
  type ScenarioKind,
  type ScenarioResult,
} from "@/lib/scenario-simulator";
import { can, roleLabels, type UserRole } from "@/lib/security";
import type { Simulation } from "@/lib/simulation";

const fmt = (value: number) => value.toLocaleString("vi-VN");
const scenarios: Array<{
  id: ScenarioKind;
  title: string;
  text: string;
  icon: typeof CloudLightning;
}> = [
  {
    id: "demand-spike",
    title: "Nhu cầu tăng đột biến",
    text: "Bão, lễ hoặc Flash Sale làm sức mua tăng mạnh.",
    icon: CloudLightning,
  },
  {
    id: "supplier-delay",
    title: "Nhà cung cấp giao trễ",
    text: "Kiểm tra độ phủ tồn trong thời gian chờ bổ sung.",
    icon: Truck,
  },
  {
    id: "cold-chain",
    title: "Sự cố chuỗi lạnh",
    text: "Giả lập 35% hàng mát/đông không còn khả dụng.",
    icon: PackageSearch,
  },
];

export function ScenarioLab({
  state,
  role,
  onRun,
}: {
  state: Simulation;
  role: UserRole;
  onRun: (result: ScenarioResult) => void;
}) {
  const [config, setConfig] = useState<ScenarioConfig>({
    kind: "demand-spike",
    demandMultiplier: 3,
    supplierDelayDays: 2,
    horizonDays: 2,
  });
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const run = () => {
    if (!can(role, "scenario:run")) return;
    const next = runWhatIfScenario(state, config);
    setResult(next);
    onRun(next);
  };

  return (
    <div className="scenario-lab">
      <section className="scenario-config">
        <div>
          <span className="sim-eyebrow">DIGITAL TWIN · SANDBOX</span>
          <h2>What‑If Scenario Simulator</h2>
          <p>Chạy trên bản sao Live State; không thay đổi tồn kho và không phát lệnh thật.</p>
        </div>
        <div className="scenario-types">
          {scenarios.map(({ id, title, text, icon: Icon }) => (
            <button
              key={id}
              className={config.kind === id ? "active" : ""}
              onClick={() => setConfig((value) => ({ ...value, kind: id }))}
            >
              <Icon size={20} />
              <b>{title}</b>
              <small>{text}</small>
            </button>
          ))}
        </div>
        <div className="scenario-fields">
          <label>
            Hệ số nhu cầu
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={config.demandMultiplier}
              onChange={(event) =>
                setConfig((value) => ({ ...value, demandMultiplier: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            NCC giao trễ (ngày)
            <input
              type="number"
              min={0}
              max={14}
              step={1}
              value={config.supplierDelayDays}
              onChange={(event) =>
                setConfig((value) => ({ ...value, supplierDelayDays: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Cửa sổ mô phỏng (ngày)
            <input
              type="number"
              min={1}
              max={14}
              step={1}
              value={config.horizonDays}
              onChange={(event) =>
                setConfig((value) => ({ ...value, horizonDays: Number(event.target.value) }))
              }
            />
          </label>
          <button
            className="sim-button primary"
            onClick={run}
            disabled={!can(role, "scenario:run")}
          >
            <Play size={16} /> Chạy mô phỏng
          </button>
        </div>
        {!can(role, "scenario:run") && (
          <p className="scenario-denied">
            <AlertTriangle size={15} /> Vai trò {roleLabels[role].name} chỉ được xem. Chuyển sang
            Quản lý để chạy kịch bản.
          </p>
        )}
      </section>

      {result ? (
        <>
          <div className="scenario-results">
            <span>
              <small>SKU ảnh hưởng</small>
              <b>{fmt(result.affectedSkus)}</b>
            </span>
            <span>
              <small>Thiếu hụt dự kiến</small>
              <b>{fmt(result.projectedShortageUnits)}</b>
            </span>
            <span>
              <small>Hết hàng đầu tiên</small>
              <b>
                {result.firstStockoutHours === null ? "Không" : `${result.firstStockoutHours}h`}
              </b>
            </span>
            <span>
              <small>Đề xuất nhập dự phòng</small>
              <b>{fmt(result.suggestedOrderUnits)}</b>
            </span>
          </div>
          <section className="scenario-agents">
            <div className="sim-panel-title">
              <h2>Multi‑Agent Collaboration</h2>
              <span className="metrics-model-badge">3 AGENTS · 1 SNAPSHOT</span>
            </div>
            <div>
              {result.agentInsights.map((insight) => (
                <article key={insight.agent}>
                  <span>
                    <Bot size={18} />
                  </span>
                  <h3>{insight.agent}</h3>
                  <p>{insight.finding}</p>
                  <strong>{insight.action}</strong>
                </article>
              ))}
            </div>
          </section>
          <section className="scenario-risk-table">
            <div className="sim-panel-title">
              <h2>Điểm đứt gãy ưu tiên</h2>
              <span>
                {result.risks.length} / {result.affectedSkus} SKU
              </span>
            </div>
            <div className="sim-table-scroll">
              <table className="sim-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nhóm</th>
                    <th>Tồn dùng được</th>
                    <th>Nhu cầu</th>
                    <th>Độ phủ</th>
                    <th>Thiếu</th>
                    <th>Đề xuất nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {result.risks.slice(0, 30).map((risk) => (
                    <tr key={risk.sku}>
                      <td>
                        <b>{risk.sku}</b>
                        <small className="sim-table-sku">{risk.name}</small>
                      </td>
                      <td>{risk.category}</td>
                      <td>{fmt(risk.available)}</td>
                      <td>{fmt(risk.projectedDemand)}</td>
                      <td>
                        <span className={`scenario-risk ${risk.severity}`}>
                          {risk.coverageHours}h
                        </span>
                      </td>
                      <td>{fmt(risk.shortage)}</td>
                      <td>
                        <b>+{fmt(risk.suggestedOrder)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="scenario-empty">
          <CloudLightning size={34} />
          <h3>Sẵn sàng chạy trên snapshot hiện tại</h3>
          <p>Chọn tình huống và thông số. Kết quả là tư vấn nháp, không tự động tác động kho.</p>
        </div>
      )}
    </div>
  );
}
