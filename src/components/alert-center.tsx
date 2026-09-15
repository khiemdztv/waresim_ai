import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Boxes,
  Database,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { explainOperationalAlert, type OperationalAlert } from "@/lib/operational-alerts";
import { expiryInfo, type Simulation } from "@/lib/simulation";

type AlertFilter = "all" | "critical" | "warning";

const codeLabels: Record<OperationalAlert["code"], string> = {
  OUT_OF_STOCK: "Hết hàng trên kệ",
  LOW_STOCK: "Tồn kệ thấp",
  EXPIRY_NEAR: "Cận hạn sử dụng",
  EXPIRED_QUARANTINE: "Hết hạn / cách ly",
};

export function AlertCenter({
  open,
  onOpenChange,
  state,
  alerts,
  focusId,
  onCommand,
  onInspect,
  onInventory,
  onAskRag,
  onFoodRescue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: Simulation;
  alerts: OperationalAlert[];
  focusId?: string | null;
  onCommand: (kind: "inbound" | "transfer", sku: string) => void;
  onInspect: (sku: string) => void;
  onInventory: (filter: "low" | "near" | "expired") => void;
  onAskRag: (question: string) => void;
  onFoodRescue: () => void;
}) {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setSelectedId(focusId ?? null);
  }, [focusId, open]);
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const filtered = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          (filter === "all" || alert.severity === filter) &&
          (!normalizedSearch ||
            `${alert.sku} ${alert.title} ${alert.detail} ${alert.code}`
              .toLocaleLowerCase("vi")
              .includes(normalizedSearch)),
      ),
    [alerts, filter, normalizedSearch],
  );
  const selected =
    alerts.find((alert) => alert.id === selectedId) ?? filtered[0] ?? alerts[0] ?? null;
  const analysis = selected ? explainOperationalAlert(selected, state) : null;
  const product = selected
    ? (state.products.find((item) => item.id === selected.sku) ?? null)
    : null;
  const critical = alerts.filter((alert) => alert.severity === "critical").length;
  const warning = alerts.length - critical;

  const closeThen = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sim-alert-center">
        <div className="sim-alert-center-head">
          <span className="sim-alert-center-icon">
            <ShieldAlert size={24} />
          </span>
          <div>
            <DialogTitle>Trung tâm cảnh báo vận hành</DialogTitle>
            <DialogDescription>
              Rule Engine quét Live State liên tục. Hybrid RAG giải thích bằng dữ liệu và SOP.
            </DialogDescription>
          </div>
          <span className="sim-alert-live">
            <i /> LIVE
          </span>
        </div>

        <div className="sim-alert-kpis">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            <span>Tất cả</span>
            <b>{alerts.length}</b>
          </button>
          <button
            className={`critical ${filter === "critical" ? "active" : ""}`}
            onClick={() => setFilter("critical")}
          >
            <span>Cảnh báo đỏ</span>
            <b>{critical}</b>
          </button>
          <button
            className={`warning ${filter === "warning" ? "active" : ""}`}
            onClick={() => setFilter("warning")}
          >
            <span>Cần theo dõi</span>
            <b>{warning}</b>
          </button>
          <div>
            <span>Snapshot</span>
            <b>{state.products.length.toLocaleString("vi-VN")} SKU</b>
          </div>
        </div>

        <div className="sim-alert-center-body">
          <aside className="sim-alert-feed">
            <label>
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm SKU hoặc loại cảnh báo…"
                aria-label="Tìm trong cảnh báo"
              />
            </label>
            <div className="sim-alert-feed-count">
              {filtered.length.toLocaleString("vi-VN")} kết quả · cập nhật theo mô phỏng
            </div>
            <div className="sim-alert-feed-list">
              {filtered.slice(0, 120).map((alert) => (
                <button
                  key={alert.id}
                  className={`${alert.severity} ${selected?.id === alert.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(alert.id)}
                >
                  <span>
                    <AlertTriangle size={15} />
                  </span>
                  <div>
                    <small>
                      {codeLabels[alert.code]} · {alert.sku}
                    </small>
                    <b>{alert.title}</b>
                    <p>{alert.detail}</p>
                  </div>
                  <ArrowRight size={14} />
                </button>
              ))}
              {filtered.length > 120 && (
                <p className="sim-alert-feed-more">
                  Đang hiển thị 120 cảnh báo ưu tiên. Dùng ô tìm kiếm để mở một SKU cụ thể.
                </p>
              )}
              {filtered.length === 0 && (
                <p className="sim-alert-feed-empty">Không có cảnh báo phù hợp.</p>
              )}
            </div>
          </aside>

          <section className="sim-alert-analysis">
            {selected && analysis && product ? (
              <>
                <div className="sim-alert-analysis-title">
                  <span className={selected.severity}>
                    <AlertTriangle size={20} />
                  </span>
                  <div>
                    <small>
                      {codeLabels[selected.code]} · {selected.code}
                    </small>
                    <h3>{selected.title}</h3>
                    <p>
                      {selected.sku} · kệ {product.displayBay} · kho {product.warehouseBay}
                    </p>
                  </div>
                </div>

                <div className="sim-alert-live-values">
                  <span>
                    <small>Tồn kệ</small>
                    <b>
                      {product.shelf}/{product.shelfCapacity}
                    </b>
                  </span>
                  <span>
                    <small>Ngưỡng</small>
                    <b>{product.reorderPoint}</b>
                  </span>
                  <span>
                    <small>Kho</small>
                    <b>{product.warehouse}</b>
                  </span>
                  <span>
                    <small>HSD gần nhất</small>
                    <b>{expiryInfo(product, state.time).next ?? "—"}</b>
                  </span>
                </div>

                <div className="sim-alert-reason">
                  <h4>
                    <Database size={15} /> Phát hiện gì?
                  </h4>
                  <p>{analysis.cause}</p>
                  <strong>Ảnh hưởng</strong>
                  <p>{analysis.impact}</p>
                </div>

                <div className="sim-alert-evidence">
                  <h4>
                    <Boxes size={15} /> Bằng chứng Live State
                  </h4>
                  <ul>
                    {analysis.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="sim-alert-rag">
                  <div>
                    <span>
                      <Sparkles size={15} />
                    </span>
                    <div>
                      <small>HYBRID RAG</small>
                      <h4>Đề xuất xử lý có căn cứ</h4>
                    </div>
                  </div>
                  <ol>
                    {analysis.actions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                  <div className="sim-alert-sources">
                    {analysis.sources.map((source) => (
                      <span key={source}>{source}</span>
                    ))}
                  </div>
                </div>

                <div className="sim-alert-actions">
                  {selected.code === "EXPIRY_NEAR" && (
                    <button className="sim-button primary" onClick={onFoodRescue}>
                      <Sparkles size={15} /> Kích hoạt Food Rescue
                    </button>
                  )}
                  {(selected.code === "OUT_OF_STOCK" || selected.code === "LOW_STOCK") && (
                    <button
                      className="sim-button primary"
                      onClick={() =>
                        closeThen(() =>
                          onCommand(
                            product.warehouse + product.backroom > 0 ? "transfer" : "inbound",
                            product.id,
                          ),
                        )
                      }
                    >
                      {product.warehouse + product.backroom > 0
                        ? "Tạo lệnh bổ sung"
                        : "Tạo lệnh nhập hàng"}
                    </button>
                  )}
                  <button
                    className="sim-button"
                    onClick={() => closeThen(() => onInspect(product.id))}
                  >
                    Xem lô & HSD
                  </button>
                  <button
                    className="sim-button"
                    onClick={() => closeThen(() => onInventory(selected.filter))}
                  >
                    Mở danh sách liên quan
                  </button>
                  <button
                    className="sim-button rag"
                    onClick={() => closeThen(() => onAskRag(analysis.suggestedQuestion))}
                  >
                    <Bot size={15} /> Hỏi RAG sâu hơn
                  </button>
                </div>
              </>
            ) : (
              <div className="sim-alert-all-clear">
                <ShieldAlert size={40} />
                <h3>Không có cảnh báo đang hoạt động</h3>
                <p>Rule Engine vẫn tiếp tục quét theo thời gian mô phỏng.</p>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
