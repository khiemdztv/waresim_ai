import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Thermometer,
  AlertTriangle,
  Leaf,
  Boxes,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { departments, daysBetween, simDate, storageLabels } from "@/lib/grocery-catalog";
import { expiryInfo, reserved, type Simulation } from "@/lib/simulation";
const fmt = (n: number) => n.toLocaleString("vi-VN");
const money = (n: number) => `${fmt(n)} ₫`;
const dateLabel = (s: string | null) => (s ? s.split("-").reverse().join("/") : "Không áp dụng");
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
export function GrocerySummary({
  state,
  onInventory,
  onNextDay,
}: {
  state: Simulation;
  onInventory: (filter?: string) => void;
  onNextDay: () => void;
}) {
  const near = state.products.reduce((n, p) => n + expiryInfo(p, state.time).nearUnits, 0);
  const expired = state.products.reduce((n, p) => n + p.expired, 0);
  const lots = state.products.reduce((n, p) => n + p.lots.length, 0);
  return (
    <section className="grocery-summary">
      <div className="grocery-store-title">
        <span>
          <Leaf size={24} />
        </span>
        <div>
          <b>Bách hóa thực phẩm · cửa hàng lớn</b>
          <small>Kho dự trữ ↔ Khu bán hàng · 3.000 SKU · Dữ liệu giả lập</small>
        </div>
      </div>
      <button onClick={() => onInventory()}>
        <Boxes size={17} />
        <b>{fmt(lots)}</b>
        <span>lô hàng</span>
      </button>
      <button className="grocery-warn" onClick={() => onInventory("near")}>
        <CalendarDays size={17} />
        <b>{fmt(near)}</b>
        <span>đơn vị sắp hết hạn</span>
      </button>
      <button className="grocery-danger" onClick={() => onInventory("expired")}>
        <AlertTriangle size={17} />
        <b>{fmt(expired)}</b>
        <span>hết hạn · đã cách ly</span>
      </button>
      <button
        className="sim-button"
        onClick={onNextDay}
        disabled={state.jobs.some((j) => !j.done)}
        title="Hoàn tất các quy trình đang chạy trước khi chuyển ngày"
      >
        <CalendarDays size={16} />
        {dateLabel(simDate(state.time))}
        <ArrowRight size={14} /> Qua ngày
      </button>
    </section>
  );
}
export function GroceryInventory({
  state,
  query,
  onQuery,
  onCommand,
  onInspect,
  initialFilter,
}: {
  state: Simulation;
  query: string;
  onQuery: (q: string) => void;
  onCommand: (kind: "inbound" | "transfer" | "sale" | "damage", sku: string) => void;
  onInspect: (id: string) => void;
  initialFilter: string;
}) {
  const [category, setCategory] = useState("all");
  const [storage, setStorage] = useState("all");
  const [expiry, setExpiry] = useState(initialFilter || "all");
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      state.products.filter((p) => {
        const info = expiryInfo(p, state.time);
        return (
          (category === "all" || p.categoryId === category) &&
          (storage === "all" || p.storage === storage) &&
          (expiry === "all" ||
            (expiry === "near" && info.nearUnits > 0) ||
            (expiry === "expired" && p.expired > 0) ||
            (expiry === "low" && p.shelf <= p.reorderPoint) ||
            (expiry === "none" && p.shelfLifeDays === null)) &&
          fold(`${p.id} ${p.name} ${p.brand} ${p.category} ${p.displayBay}`).includes(fold(query))
        );
      }),
    [state.products, state.time, query, category, storage, expiry],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  const current = Math.min(page, pages - 1);
  return (
    <section className="sim-data-panel grocery-inventory">
      <div className="sim-panel-title">
        <h2>
          Danh mục hàng hóa <span>{fmt(filtered.length)} / 3.000 SKU</span>
        </h2>
        <span className="grocery-fefo">
          <Leaf size={14} /> FEFO · Hạn gần trước
        </span>
      </div>
      <div className="grocery-filters">
        <label className="grocery-search">
          <Search size={16} />
          <input
            aria-label="Lọc danh mục sản phẩm"
            placeholder="Tên hàng, SKU, nhãn, khu kệ…"
            value={query}
            onChange={(e) => {
              onQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="Nhóm hàng"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Tất cả 21 nhóm hàng</option>
          {departments.map((g) => (
            <option key={g.id} value={g.id}>
              {g.emoji} {g.name} ({g.count})
            </option>
          ))}
        </select>
        <select
          aria-label="Bảo quản"
          value={storage}
          onChange={(e) => {
            setStorage(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Mọi vùng bảo quản</option>
          {Object.entries(storageLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Tình trạng hạn dùng"
          value={expiry}
          onChange={(e) => {
            setExpiry(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">Mọi tình trạng</option>
          <option value="near">Sắp hết hạn</option>
          <option value="expired">Có hàng đã hết hạn</option>
          <option value="low">Cần bổ sung kệ</option>
          <option value="none">Không áp dụng HSD</option>
        </select>
      </div>
      <div className="grocery-assumptions">
        Một đơn vị tồn = một quy cách bán ghi trên sản phẩm (chai, gói, khay, hộp…). Giá, nhãn riêng
        và HSD là giả định mô phỏng. Đồ dùng không có HSD được ghi rõ.
      </div>
      <div className="sim-table-scroll">
        <table className="sim-table grocery-table">
          <thead>
            <tr>
              <th>Sản phẩm / quy cách</th>
              <th>Vị trí & bảo quản</th>
              <th>Kho dự trữ</th>
              <th>Kệ bán / sức chứa</th>
              <th>HSD gần nhất</th>
              <th>Giá mô phỏng</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 50, current * 50 + 50).map((p) => {
              const info = expiryInfo(p, state.time);
              return (
                <tr key={p.id}>
                  <td>
                    <button className="grocery-product" onClick={() => onInspect(p.id)}>
                      <span style={{ background: `${p.color}22` }}>{p.emoji}</span>
                      <div>
                        <b>{p.name}</b>
                        <small>
                          {p.brand} · {p.id}
                        </small>
                        <em>{p.category}</em>
                      </div>
                    </button>
                  </td>
                  <td>
                    <b>
                      {p.displayBay} <span className="sim-muted">/ {p.warehouseBay}</span>
                    </b>
                    <small className={`grocery-temp ${p.storage}`}>
                      <Thermometer size={11} />
                      {storageLabels[p.storage]}
                    </small>
                  </td>
                  <td>
                    <b>{p.warehouse}</b>
                    <small className="sim-table-sku">
                      Giữ chỗ: {reserved(state, p.id, "transfer")}
                    </small>
                  </td>
                  <td>
                    <b className={p.shelf <= p.reorderPoint ? "sim-low" : ""}>
                      {p.shelf} / {p.shelfCapacity}
                    </b>
                    <small className="sim-table-sku">Chờ lên kệ: {p.backroom}</small>
                  </td>
                  <td>
                    <button
                      className={`grocery-expiry ${info.nearUnits ? "near" : ""}`}
                      onClick={() => onInspect(p.id)}
                    >
                      <b>{dateLabel(info.next)}</b>
                      <small>
                        {info.days === null
                          ? p.shelfLifeDays === null
                            ? "Đồ dùng không HSD"
                            : "Không còn lô khả dụng"
                          : info.days === 0
                            ? "Hết hạn cuối hôm nay"
                            : `Còn ${info.days} ngày`}
                      </small>
                      {p.expired > 0 && <em>{p.expired} đơn vị đã cách ly</em>}
                    </button>
                  </td>
                  <td>
                    {money(p.price)}
                    <small className="sim-table-sku">/ {p.unit}</small>
                  </td>
                  <td>
                    <div className="sim-row-actions">
                      <button onClick={() => onInspect(p.id)}>Xem lô</button>
                      <button onClick={() => onCommand("transfer", p.id)}>Bổ sung</button>
                      <button onClick={() => onCommand("sale", p.id)}>Bán</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="sim-empty">
          <Search />
          <b>Không tìm thấy sản phẩm</b>
          <p>Thử đổi từ khóa hoặc bộ lọc.</p>
        </div>
      )}
      <div className="grocery-pagination">
        <span>
          {filtered.length ? current * 50 + 1 : 0}–{Math.min((current + 1) * 50, filtered.length)} /{" "}
          {fmt(filtered.length)} SKU
        </span>
        <div>
          <button
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            aria-label="Trang trước"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Trang {current + 1} / {pages}
          </span>
          <button
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            aria-label="Trang sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
export function ProductLotsDialog({
  state,
  productId,
  onClose,
  onCommand,
}: {
  state: Simulation;
  productId: string | null;
  onClose: () => void;
  onCommand: (kind: "inbound" | "transfer" | "sale" | "damage", sku: string) => void;
}) {
  const p = state.products.find((p) => p.id === productId);
  const today = simDate(state.time);
  return (
    <Dialog
      open={!!p}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sim-modal grocery-lot-modal">
        <DialogTitle>{p?.name ?? "Chi tiết lô hàng"}</DialogTitle>
        <DialogDescription>
          {p ? `${p.id} · ${p.brand} · ${p.category}` : "Thông tin tồn theo lô"}
        </DialogDescription>
        {p && (
          <>
            <div className="grocery-detail-hero">
              <span style={{ background: `${p.color}25` }}>{p.emoji}</span>
              <div>
                <b>
                  {money(p.price)} / {p.unit}
                </b>
                <small>
                  {p.pack} · {storageLabels[p.storage]}
                </small>
                <small>{p.supplier}</small>
              </div>
              <span className="grocery-fefo">FEFO</span>
            </div>
            <div className="grocery-detail-grid">
              <span>
                Kho dự trữ
                <b>
                  {p.warehouse} <small>{p.warehouseBay}</small>
                </b>
              </span>
              <span>
                Kệ bán
                <b>
                  {p.shelf} / {p.shelfCapacity} <small>{p.displayBay}</small>
                </b>
              </span>
              <span>
                Ngưỡng bổ sung
                <b>
                  ≤ {p.reorderPoint} {p.unit}
                </b>
              </span>
              <span>
                Cách ly
                <b>
                  {p.damaged} <small>({p.expired} hết hạn)</small>
                </b>
              </span>
            </div>
            <div className="sim-table-scroll">
              <table className="sim-table grocery-lot-table">
                <thead>
                  <tr>
                    <th>Lô / NSX</th>
                    <th>Ngày nhập</th>
                    <th>Hạn sử dụng</th>
                    <th>Kho</th>
                    <th>Kệ</th>
                    <th>Xe / chờ</th>
                    <th>Giữ chỗ</th>
                    <th>Cách ly</th>
                  </tr>
                </thead>
                <tbody>
                  {[...p.lots]
                    .sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999"))
                    .map((l) => {
                      const days = l.expiryDate ? daysBetween(today, l.expiryDate) : null;
                      const locked = state.jobs
                        .filter(
                          (j) => j.sku === p.id && !j.done && (j.kind === "sale" || j.stage < 3),
                        )
                        .reduce(
                          (n, j) =>
                            n +
                            j.allocations
                              .filter((a) => a.lotId === l.id)
                              .reduce((s, a) => s + a.quantity, 0),
                          0,
                        );
                      return (
                        <tr key={l.id}>
                          <td>
                            <b>{l.id}</b>
                            <small className="sim-table-sku">
                              NSX: {dateLabel(l.manufacturedDate)}
                            </small>
                          </td>
                          <td>{dateLabel(l.receivedDate)}</td>
                          <td
                            className={
                              days !== null && days < 0
                                ? "grocery-danger"
                                : days !== null && days <= p.warningDays
                                  ? "grocery-warn"
                                  : ""
                            }
                          >
                            <b>{dateLabel(l.expiryDate)}</b>
                            <small className="sim-table-sku">
                              {days === null
                                ? "Không áp dụng"
                                : days < 0
                                  ? "Đã hết hạn"
                                  : days === 0
                                    ? "Đến cuối hôm nay"
                                    : `Còn ${days} ngày`}
                            </small>
                          </td>
                          <td>{l.warehouse}</td>
                          <td>{l.shelf}</td>
                          <td>{l.transit + l.backroom}</td>
                          <td>{locked}</td>
                          <td>{l.damaged + l.expired}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p className="grocery-lot-note">
              Ngày mô phỏng: {dateLabel(today)}. HSD có hiệu lực đến hết ngày ghi trên lô; qua ngày
              tiếp theo hàng được cách ly. FEFO giữ đúng lô khi lấy hàng hoặc bán; hàng không HSD
              được xếp theo ngày nhập.
            </p>
            <div className="grocery-dialog-actions">
              {(["inbound", "transfer", "sale", "damage"] as const).map((kind, i) => (
                <button
                  key={kind}
                  className={`sim-button ${kind === "transfer" ? "primary" : ""}`}
                  onClick={() => {
                    onClose();
                    onCommand(kind, p.id);
                  }}
                >
                  {["Nhập lô mới", "Bổ sung FEFO", "Bán tại POS", "Cách ly hỏng"][i]}
                </button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
