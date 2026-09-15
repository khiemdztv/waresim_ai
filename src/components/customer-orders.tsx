import { useMemo, useState, type FormEvent } from "react";
import {
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { can, roleLabels, type UserRole } from "@/lib/security";
import { clockLabel, reserved, type CustomerType, type Simulation } from "@/lib/simulation";

type NewOrder = {
  customerName: string;
  customerType: CustomerType;
  sku: string;
  quantity: number;
};

const fmt = (value: number) => value.toLocaleString("vi-VN");
const statusLabels = {
  pending: "Chờ lấy hàng",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
} as const;

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

export function CustomerOrders({
  state,
  role,
  onCreate,
  onToggleAuto,
}: {
  state: Simulation;
  role: UserRole;
  onCreate: (order: NewOrder) => string | null;
  onToggleAuto: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customerType, setCustomerType] = useState<CustomerType>("individual");
  const [customerName, setCustomerName] = useState("");
  const [sku, setSku] = useState("SKU-0001");
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const selectedProduct = state.products.find((product) => product.id === sku);
  const available = selectedProduct
    ? selectedProduct.shelf - reserved(state, selectedProduct.id, "sale")
    : 0;
  const visibleProducts = useMemo(() => {
    const query = fold(search.trim());
    const products = state.products
      .filter(
        (product) =>
          product.id === sku ||
          !query ||
          fold(`${product.id} ${product.name} ${product.brand}`).includes(query),
      )
      .slice(0, 80);
    const current = state.products.find((product) => product.id === sku);
    if (current && !products.includes(current)) products.unshift(current);
    return products;
  }, [search, sku, state.products]);
  const active = state.orders.filter(
    (order) => order.status === "pending" || order.status === "processing",
  ).length;
  const completed = state.orders.filter((order) => order.status === "completed").length;
  const business = state.orders.filter((order) => order.customerType === "business").length;
  const orderValue = state.orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);
  const canManage = role === "manager" && can(role, "operation:create");

  const startNewOrder = () => {
    setCustomerType("individual");
    setCustomerName("");
    setSku("SKU-0001");
    setQuantity(1);
    setSearch("");
    setError("");
    setOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = onCreate({ customerName: customerName.trim(), customerType, sku, quantity });
    if (message) {
      setError(message);
      return;
    }
    setOpen(false);
  };

  return (
    <div className="customer-orders">
      <section className="orders-head">
        <div>
          <span className="sim-eyebrow">OMNICHANNEL ORDER FLOW</span>
          <h2>Đơn đặt hàng khách cá nhân & doanh nghiệp</h2>
          <p>
            Mỗi đơn giữ tồn theo lô FEFO, tạo tác vụ lấy hàng và tự cập nhật trạng thái khi thanh
            toán hoàn tất.
          </p>
        </div>
        <div className="orders-head-actions">
          <button
            className={`orders-auto ${state.autoOrders ? "active" : ""}`}
            aria-pressed={state.autoOrders}
            disabled={!canManage}
            onClick={() => onToggleAuto(!state.autoOrders)}
          >
            <Bot size={16} />
            <span>
              <b>Auto Order</b>
              <small>{state.autoOrders ? "Đang tự nhận đơn mỗi phút" : "Đã tạm dừng"}</small>
            </span>
            <i />
          </button>
          <button className="sim-button primary" disabled={!canManage} onClick={startNewOrder}>
            <Plus size={16} /> Tạo đơn mới
          </button>
        </div>
      </section>

      {!canManage && (
        <div className="orders-rbac-note">
          Vai trò {roleLabels[role].name} được xem đơn hàng; chỉ Quản lý được tạo đơn và điều khiển
          Auto Order.
        </div>
      )}

      <div className="orders-kpis">
        <span>
          <Clock3 size={18} /> <small>Đang xử lý</small>
          <b>{fmt(active)}</b>
        </span>
        <span>
          <CheckCircle2 size={18} /> <small>Đã hoàn tất</small>
          <b>{fmt(completed)}</b>
        </span>
        <span>
          <Building2 size={18} /> <small>Đơn doanh nghiệp</small>
          <b>{fmt(business)}</b>
        </span>
        <span>
          <ShoppingBag size={18} /> <small>Giá trị đơn</small>
          <b>{can(role, "financial:read") ? `${fmt(orderValue)} ₫` : "Ẩn bởi RBAC"}</b>
        </span>
      </div>

      <section className="orders-table-panel">
        <div className="sim-panel-title">
          <h2>Luồng đơn gần nhất</h2>
          <span className="metrics-model-badge">
            {state.autoOrders ? "AUTO · LIVE" : "MANUAL ONLY"}
          </span>
        </div>
        <div className="sim-table-scroll">
          <table className="sim-table orders-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Loại</th>
                <th>Sản phẩm</th>
                <th>Số lượng</th>
                <th>Giá trị</th>
                <th>Nguồn</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {state.orders.map((order) => {
                const product = state.products.find((item) => item.id === order.sku);
                return (
                  <tr key={order.id}>
                    <td>
                      <b>{order.id}</b>
                      <small className="sim-table-sku">{order.jobId}</small>
                    </td>
                    <td>{order.customerName}</td>
                    <td>
                      <span className={`order-customer-type ${order.customerType}`}>
                        {order.customerType === "business" ? (
                          <Building2 size={12} />
                        ) : (
                          <UserRound size={12} />
                        )}
                        {order.customerType === "business" ? "Doanh nghiệp" : "Cá nhân"}
                      </span>
                    </td>
                    <td>
                      {product?.name ?? order.sku}
                      <small className="sim-table-sku">{order.sku}</small>
                    </td>
                    <td>{fmt(order.quantity)}</td>
                    <td>{can(role, "financial:read") ? `${fmt(order.total)} ₫` : "••••"}</td>
                    <td>{order.source === "auto" ? "Auto Order" : "Nhập tay"}</td>
                    <td>
                      <span className={`order-status ${order.status}`}>
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td>{clockLabel(order.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sim-modal order-create-modal">
          <DialogTitle>Tạo đơn đặt hàng</DialogTitle>
          <DialogDescription>
            Đơn được giữ tồn FEFO ngay khi xác nhận và chuyển qua luồng lấy hàng → quét mã → thanh
            toán.
          </DialogDescription>
          <form onSubmit={submit}>
            <label>
              Loại khách hàng
              <select
                aria-label="Loại khách hàng"
                value={customerType}
                onChange={(event) => {
                  setCustomerType(event.target.value as CustomerType);
                  setQuantity(event.target.value === "business" ? 5 : 1);
                }}
              >
                <option value="individual">Khách cá nhân</option>
                <option value="business">Công ty / đơn vị</option>
              </select>
            </label>
            <label>
              Tên khách hàng hoặc đơn vị
              <input
                aria-label="Tên khách hàng hoặc đơn vị"
                required
                minLength={2}
                maxLength={80}
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={
                  customerType === "business" ? "Ví dụ: Công ty An Phú" : "Ví dụ: Nguyễn Minh Anh"
                }
              />
            </label>
            <label>
              <Search size={13} /> Tìm sản phẩm
              <input
                aria-label="Tìm sản phẩm cho đơn hàng"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tên, nhãn hoặc SKU…"
              />
            </label>
            <label>
              Sản phẩm
              <select
                aria-label="Sản phẩm đặt hàng"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
              >
                {visibleProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.id} · {product.name} · còn {product.shelf} trên kệ
                  </option>
                ))}
              </select>
            </label>
            <div className="order-stock-note">
              Khả dụng trên kệ: <b>{fmt(available)}</b> · Đơn giá:{" "}
              <b>{selectedProduct ? `${fmt(selectedProduct.price)} ₫` : "—"}</b>
            </div>
            <label>
              Số lượng
              <input
                type="number"
                min={1}
                max={Math.max(1, Math.min(1000, available))}
                required
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </label>
            {error && (
              <p className="sim-form-error" role="alert">
                {error}
              </p>
            )}
            <div className="sim-modal-actions">
              <button type="button" className="sim-button" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="sim-button primary">
                <Plus size={15} /> Xác nhận đơn
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
