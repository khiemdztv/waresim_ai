import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Box,
  Boxes,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Expand,
  Forklift,
  Layers3,
  LayoutDashboard,
  Map,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Truck,
  Users,
  Warehouse,
  X,
  AlertTriangle,
  BarChart3,
  FileCheck2,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SimulatorScene, type SceneItem } from "@/components/simulator-scene";
import {
  clockLabel,
  initialSimulation,
  inTransit,
  reserved,
  simulationReducer,
  stageDuration,
  stages,
  type JobKind,
  type CustomerType,
  type Simulation,
  type Site,
} from "@/lib/simulation";
import {
  GroceryInventory,
  GrocerySummary,
  ProductLotsDialog,
} from "@/components/grocery-inventory";
import { dateAfter, simDate, storageLabels } from "@/lib/grocery-catalog";
import { expiryInfo, shelfSpace } from "@/lib/simulation";
import { deriveOperationalAlerts } from "@/lib/operational-alerts";
import { Chatbot, type RagRequest } from "@/components/chatbot";
import { AlertCenter } from "@/components/alert-center";
import { AuditPanel } from "@/components/audit-panel";
import { FoodRescueCenter } from "@/components/food-rescue-center";
import { MetricsDashboard } from "@/components/metrics-dashboard";
import { ScenarioLab } from "@/components/scenario-lab";
import { CustomerOrders } from "@/components/customer-orders";
import { appendAuditEntry, type AuditEntry } from "@/lib/audit-log";
import type { RescueDecision, RescuePlan } from "@/lib/food-rescue";
import type { ScenarioResult } from "@/lib/scenario-simulator";
import { can, roleLabels, type UserRole } from "@/lib/security";
import "@/simulator.css";

type Page =
  | "simulation"
  | "overview"
  | "inventory"
  | "orders"
  | "activity"
  | "cameras"
  | "metrics"
  | "scenarios"
  | "audit";
type Command = JobKind | "damage";
const navigation: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "simulation", label: "Mô phỏng không gian", icon: Layers3 },
  { id: "inventory", label: "Quản lý tồn kho", icon: Boxes },
  { id: "orders", label: "Đơn đặt hàng", icon: ShoppingBag },
  { id: "activity", label: "Luồng hoạt động", icon: RouteIcon },
  { id: "cameras", label: "Hệ thống camera", icon: Camera },
  { id: "metrics", label: "Chỉ số & đánh giá", icon: BarChart3 },
  { id: "scenarios", label: "Kịch bản What‑If", icon: FlaskConical },
  { id: "audit", label: "Nhật ký kiểm toán", icon: FileCheck2 },
];
const commandTitles: Record<Command, string> = {
  inbound: "Nhập hàng vào kho",
  transfer: "Bổ sung từ kho lên kệ",
  sale: "Mô phỏng lượt mua hàng",
  damage: "Đưa hàng vào khu cách ly",
};
const fmt = (n: number) => n.toLocaleString("vi-VN");
const csvCell = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`sim-icon-btn ${active ? "is-active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={17} />
    </button>
  );
}
function Tag({ children, tone = "green" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`sim-tag ${tone}`}>
      <i />
      {children}
    </span>
  );
}

export function OperationsSimulator() {
  const [hydrated, setHydrated] = useState(false);
  const [state, dispatch] = useReducer(simulationReducer, undefined, initialSimulation);
  const [speed, setSpeed] = useState(1);
  const [site, setSite] = useState<Site>("warehouse");
  const [page, setPage] = useState<Page>("simulation");
  const [zoom, setZoom] = useState(1);
  const [flat, setFlat] = useState(false);
  const [labels, setLabels] = useState(true);
  const [paths, setPaths] = useState(true);
  const [cameras, setCameras] = useState(true);
  const [selected, setSelected] = useState<SceneItem | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [sku, setSku] = useState("SKU-0001");
  const [quantity, setQuantity] = useState(24);
  const [incomingExpiry, setIncomingExpiry] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("all");
  const [inventoryKey, setInventoryKey] = useState(0);
  const [inspectedProductId, setInspectedProductId] = useState<string | null>(null);
  const showInventory = (filter = "all") => {
    setQuery("");
    setInventoryFilter(filter);
    setInventoryKey((k) => k + 1);
    setPage("inventory");
  };
  const [query, setQuery] = useState("");
  const [bottomTab, setBottomTab] = useState<"jobs" | "events">("jobs");
  const [mobileNav, setMobileNav] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertFocusId, setAlertFocusId] = useState<string | null>(null);
  const [ragRequest, setRagRequest] = useState<RagRequest | null>(null);
  const [role, setRole] = useState<UserRole>("manager");
  const [rescueOpen, setRescueOpen] = useState(false);
  const [rescueDecisions, setRescueDecisions] = useState<readonly RescueDecision[]>([]);
  const [auditEntries, setAuditEntries] = useState<readonly AuditEntry[]>([]);
  const [notice, setNotice] = useState("");
  const [fullMap, setFullMap] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const active = state.jobs.filter((j) => !j.done);
  const inventoryStats = useMemo(
    () =>
      state.products.reduce(
        (stats, product) => ({
          warehouse: stats.warehouse + product.warehouse,
          store: stats.store + product.shelf + product.backroom,
          lowStock: stats.lowStock + Number(product.shelf <= product.reorderPoint),
          damaged: stats.damaged + product.damaged,
        }),
        { warehouse: 0, store: 0, lowStock: 0, damaged: 0 },
      ),
    [state.products],
  );
  const warehouseTotal = inventoryStats.warehouse;
  const storeTotal = inventoryStats.store;
  const damaged = inventoryStats.damaged;
  const simulationDay = Math.floor(state.time / 86400);
  const operationalAlerts = useMemo(
    () =>
      deriveOperationalAlerts({
        products: state.products,
        time: simulationDay * 86400,
      }),
    [simulationDay, state.products],
  );
  const alerts = operationalAlerts.length;
  const criticalAlerts = operationalAlerts.filter((alert) => alert.severity === "critical");
  const openAlertCenter = (id?: string) => {
    setAlertFocusId(id ?? null);
    setAlertsOpen(true);
  };
  const siteJobs = active.filter((j) =>
    site === "warehouse"
      ? j.kind === "inbound" || (j.kind === "transfer" && j.stage < 4)
      : j.kind === "sale" || (j.kind === "transfer" && j.stage >= 4),
  );
  const switchSite = (value: Site) => {
    setSite(value);
    setSelected(null);
    setZoom(1);
  };
  const recordAudit = (
    action: string,
    target: string,
    decision: AuditEntry["decision"],
    detail: string,
    actorRole: UserRole = role,
  ) =>
    setAuditEntries((entries) =>
      appendAuditEntry(entries, {
        simulationTime: state.time,
        actorRole,
        action,
        target,
        decision,
        detail,
      }),
    );
  const go = (value: Page) => {
    if (value === "audit" && !can(role, "audit:read")) {
      setNotice("RBAC: Chỉ Quản lý hoặc Kiểm toán viên được xem audit trail.");
      recordAudit("ACCESS_AUDIT", "audit-trail", "BLOCKED", "Vai trò không có audit:read");
      return;
    }
    setPage(value);
    setMobileNav(false);
  };
  const openCommand = (kind: Command, product = "SKU-0001") => {
    const allowed = can(role, "operation:create") && (role === "manager" || kind === "transfer");
    if (!allowed) {
      setNotice(
        `RBAC: ${roleLabels[role].name} không được tạo tác vụ ${commandTitles[kind].toLowerCase()}.`,
      );
      recordAudit("CREATE_OPERATION", `${kind}:${product}`, "BLOCKED", "RBAC từ chối thao tác");
      return;
    }
    dispatch({ type: "clear-error" });
    setSku(product);
    const p = state.products.find((p) => p.id === product)!;
    setProductSearch("");
    setIncomingExpiry(
      p.shelfLifeDays === null ? "" : dateAfter(simDate(state.time), p.shelfLifeDays),
    );
    setQuantity(
      kind === "sale" || kind === "damage"
        ? 1
        : kind === "transfer"
          ? Math.max(
              1,
              Math.min(
                24,
                p.warehouse - reserved(state, product, "transfer"),
                shelfSpace(state, p),
              ),
            )
          : 24,
    );
    setCommand(kind);
  };

  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    let previous = performance.now();
    let remainder = 0;
    const timer = window.setInterval(() => {
      const now = performance.now();
      remainder += ((now - previous) / 1000) * speed;
      previous = now;
      const seconds = Math.floor(remainder);
      if (seconds > 0) {
        remainder -= seconds;
        dispatch({ type: "tick", seconds: Math.min(seconds, 86400) });
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [speed]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setFullMap(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!command) return;
    const action =
      command === "damage"
        ? { type: "damage" as const, sku, quantity }
        : {
            type: "create" as const,
            kind: command,
            sku,
            quantity,
            expiryDate: command === "inbound" ? incomingExpiry : null,
          };
    const result = simulationReducer(state, action);
    dispatch(action);
    if (!result.error) {
      recordAudit(
        command === "damage" ? "QUARANTINE_STOCK" : "CREATE_OPERATION",
        `${command}:${sku}`,
        command === "damage" ? "APPROVED" : "CREATED",
        `${quantity} đơn vị · human initiated`,
      );
      setCommand(null);
      setNotice(
        command === "damage"
          ? "Đã chuyển sản phẩm vào khu cách ly."
          : `Đã tạo ${command === "inbound" ? "lô nhập" : command === "transfer" ? "lệnh chuyển hàng" : "lượt mua hàng"}. Quy trình đang được mô phỏng tự động.`,
      );
    }
  };
  const decideRescue = (plan: RescuePlan, status: RescueDecision["status"]) => {
    if (!can(role, "rescue:approve")) {
      setNotice("RBAC: Chỉ Quản lý được duyệt kế hoạch Food Rescue.");
      recordAudit("FOOD_RESCUE", plan.id, "BLOCKED", "Vai trò không có rescue:approve");
      return;
    }
    if (rescueDecisions.some((decision) => decision.planId === plan.id)) return;
    const decision: RescueDecision = {
      planId: plan.id,
      sku: plan.sku,
      lotId: plan.lotId,
      status,
      units: status === "APPROVED" ? plan.projectedRescuedUnits : 0,
      decidedAt: state.time,
      note:
        status === "APPROVED"
          ? `${plan.channel} · ${plan.discountPercent === 100 ? "chuyển tặng" : `giảm ${plan.discountPercent}%`}`
          : "Human Override · giữ nguyên kế hoạch vận hành",
    };
    setRescueDecisions((items) => [...items, decision]);
    recordAudit(
      "FOOD_RESCUE",
      `${plan.sku}:${plan.lotId}`,
      status,
      `${decision.units} đơn vị · ${decision.note}`,
    );
    setNotice(
      status === "APPROVED"
        ? "Đã duyệt Food Rescue và ghi audit trail."
        : "Đã ghi nhận Human Override.",
    );
  };
  const auditScenario = (result: ScenarioResult) => {
    recordAudit(
      "RUN_WHAT_IF",
      result.config.kind,
      "VIEWED",
      `${result.affectedSkus} SKU ảnh hưởng · sandbox không thay đổi Live State`,
    );
  };
  const createCustomerOrder = (order: {
    customerName: string;
    customerType: CustomerType;
    sku: string;
    quantity: number;
  }) => {
    if (role !== "manager" || !can(role, "operation:create")) {
      recordAudit("CREATE_CUSTOMER_ORDER", order.sku, "BLOCKED", "RBAC từ chối thao tác");
      return "Chỉ vai trò Quản lý được tạo đơn đặt hàng.";
    }
    if (order.customerName.length < 2 || order.customerName.length > 80)
      return "Tên khách hàng phải có từ 2 đến 80 ký tự.";
    const action = {
      type: "create" as const,
      kind: "sale" as const,
      sku: order.sku,
      quantity: order.quantity,
      order: {
        customerName: order.customerName,
        customerType: order.customerType,
        source: "manual" as const,
      },
    };
    const result = simulationReducer(state, action);
    if (result.error) return result.error;
    dispatch(action);
    recordAudit(
      "CREATE_CUSTOMER_ORDER",
      `${order.customerType}:${order.sku}`,
      "CREATED",
      `${order.customerName} · ${order.quantity} đơn vị · FEFO reserved`,
    );
    setNotice("Đã nhận đơn và tạo tác vụ lấy hàng FEFO.");
    return null;
  };
  const toggleAutoOrders = (enabled: boolean) => {
    if (role !== "manager") {
      recordAudit("TOGGLE_AUTO_ORDER", "auto-orders", "BLOCKED", "RBAC từ chối thao tác");
      return;
    }
    dispatch({ type: "auto-orders", enabled });
    recordAudit(
      "TOGGLE_AUTO_ORDER",
      "auto-orders",
      "APPROVED",
      enabled ? "Bật tự nhận đơn mỗi phút" : "Tạm dừng tự nhận đơn",
    );
    setNotice(enabled ? "Auto Order đã bật." : "Auto Order đã tạm dừng.");
  };
  const exportData = () => {
    const headers = [
      "ngay_mo_phong",
      "gio_mo_phong",
      "sku",
      "ten_san_pham",
      "nhan_hang",
      "nhom_hang",
      "quy_cach",
      "don_vi",
      "gia_vnd",
      "vi_tri_ke",
      "vi_tri_kho",
      "bao_quan",
      "ma_lo",
      "ngay_san_xuat",
      "ngay_nhap",
      "han_su_dung",
      "kho_du_tru",
      "ke_ban",
      "cho_len_ke",
      "dang_tren_xe",
      "cach_ly_hong",
      "cach_ly_het_han",
      "giu_cho_bo_sung_lo",
      "giu_cho_ban_lo",
      "da_ban_trong_phien",
      "doanh_thu_phien_vnd",
    ];
    const rows = state.products.flatMap((product) =>
      product.lots.map((lot) => [
        simDate(state.time),
        clockLabel(state.time),
        product.id,
        product.name,
        product.brand,
        product.category,
        product.pack,
        product.unit,
        product.price,
        product.displayBay,
        product.warehouseBay,
        storageLabels[product.storage],
        lot.id,
        lot.manufacturedDate,
        lot.receivedDate,
        lot.expiryDate,
        lot.warehouse,
        lot.shelf,
        lot.backroom,
        lot.transit,
        lot.damaged,
        lot.expired,
        state.jobs
          .filter(
            (job) =>
              job.sku === product.id && job.kind === "transfer" && !job.done && job.stage < 3,
          )
          .flatMap((job) => job.allocations)
          .filter((allocation) => allocation.lotId === lot.id)
          .reduce((total, allocation) => total + allocation.quantity, 0),
        state.jobs
          .filter((job) => job.sku === product.id && job.kind === "sale" && !job.done)
          .flatMap((job) => job.allocations)
          .filter((allocation) => allocation.lotId === lot.id)
          .reduce((total, allocation) => total + allocation.quantity, 0),
        state.sold,
        state.revenue,
      ]),
    );
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `waresim-${simDate(state.time)}-${clockLabel(state.time).replaceAll(":", "-")}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Đã xuất CSV gồm ${fmt(rows.length)} dòng lô hàng.`);
  };
  const currentProduct = state.products.find((p) => p.id === selected?.sku);
  const commandProduct = state.products.find((p) => p.id === sku);
  const commandProducts = useMemo(() => {
    if (!command) return [];
    const searchTerm = productSearch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase();
    const products = state.products
      .filter(
        (product) =>
          product.id === sku ||
          `${product.id} ${product.name} ${product.brand}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/gi, "d")
            .toLowerCase()
            .includes(searchTerm),
      )
      .slice(0, 80);
    const current = state.products.find((product) => product.id === sku);
    if (current && !products.includes(current)) products.unshift(current);
    return products;
  }, [command, productSearch, sku, state.products]);
  const completed = state.jobs.filter((j) => j.done && !j.cancelled).length;
  const selectedJob = siteJobs[0];
  const selectedJobProduct = selectedJob
    ? state.products.find((product) => product.id === selectedJob.sku)
    : undefined;
  const pipelineStep = !selectedJob
    ? -1
    : selectedJob.kind === "inbound"
      ? selectedJob.stage < 2
        ? 0
        : 1
      : selectedJob.kind === "sale"
        ? 6
        : ([2, 3, 3, 4, 5, 5][selectedJob.stage] ?? -1);
  const operationDetail = selectedJob
    ? `${selectedJob.id} · ${selectedJobProduct?.name ?? selectedJob.sku} · ${selectedJob.quantity} ${selectedJobProduct?.unit ?? "đơn vị"} · ${stages[selectedJob.kind][selectedJob.stage]}`
    : "Chưa có tác vụ tại khu vực này";

  return (
    <div className="sim-app" data-hydrated={hydrated}>
      {mobileNav && (
        <button
          className="sim-nav-shade"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sim-sidebar ${mobileNav ? "open" : ""}`}>
        <a className="sim-brand" href="/" aria-label="WareSim trang chủ">
          <span className="sim-brand-symbol">
            <Layers3 size={25} />
          </span>
          <span>
            ware<span>sim</span>
            <small>WAREHOUSE & RETAIL TWIN</small>
          </span>
        </a>
        <div className="sim-workspace">
          <span className="sim-workspace-icon">
            <Warehouse size={20} />
          </span>
          <div>
            <b>Không gian vận hành</b>
            <small>Môi trường mô phỏng</small>
          </div>
          <span className="sim-mini-live" />
        </div>
        <p className="sim-nav-label">WORKSPACE</p>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => go(id)}
              aria-disabled={id === "audit" && !can(role, "audit:read")}
            >
              <Icon size={18} />
              <span>{label}</span>
              {page === id && <span className="sim-nav-dot" />}
              {id === "cameras" && <small>08</small>}
            </button>
          ))}
        </nav>
        <p className="sim-nav-label sim-nav-label-second">CÙNG CỬA HÀNG ST-01</p>
        <button
          className={`sim-site-nav ${site === "warehouse" ? "selected" : ""}`}
          onClick={() => {
            switchSite("warehouse");
            go("simulation");
          }}
        >
          <span className="sim-site-dot" />
          <span>
            Kho dự trữ<small>WH-01 · Kho sau cửa hàng</small>
          </span>
          <ChevronRight size={14} />
        </button>
        <button
          className={`sim-site-nav ${site === "store" ? "selected" : ""}`}
          onClick={() => {
            switchSite("store");
            go("simulation");
          }}
        >
          <span className="sim-site-dot blue" />
          <span>
            Cửa hàng bán lẻ<small>ST-01 · Khu bán hàng</small>
          </span>
          <ChevronRight size={14} />
        </button>
        <div className="sim-sidebar-bottom">
          <div className="sim-guide-card">
            <span>
              <Box size={20} /> DIGITAL TWIN
            </span>
            <b>
              Một góc nhìn.
              <br />
              Toàn bộ vận hành.
            </b>
            <p>Khám phá hành trình của hàng hóa từ kho đến cửa hàng.</p>
            <button onClick={() => setHelpOpen(true)}>
              Hướng dẫn mô phỏng <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="sim-help" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={17} /> Trợ giúp & hướng dẫn <ArrowUpRight size={14} />
          </button>
          <div className="sim-profile">
            <span>{role === "manager" ? "QL" : role === "staff" ? "NV" : "KT"}</span>
            <div>
              <b>{roleLabels[role].name}</b>
              <small>RBAC · {roleLabels[role].short}</small>
            </div>
            <ShieldCheck size={18} />
          </div>
        </div>
      </aside>

      <div className="sim-body">
        <header className="sim-topbar">
          <IconButton icon={Menu} label="Mở điều hướng" onClick={() => setMobileNav(true)} />
          <div className="sim-breadcrumb">
            Workspace <ChevronRight size={13} />
            <b>{navigation.find((n) => n.id === page)?.label}</b>
          </div>
          <div className="sim-search">
            <Search size={16} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value) setPage("inventory");
              }}
              placeholder="Tìm sản phẩm, mã SKU..."
              aria-label="Tìm sản phẩm, mã SKU"
            />
            <kbd>Ctrl K</kbd>
          </div>
          <span className="sim-top-status">
            <i /> Phiên mô phỏng
          </span>
          <label className="sim-role-switch">
            <ShieldCheck size={15} />
            <span>Vai trò</span>
            <select
              aria-label="Vai trò RBAC"
              value={role}
              onChange={(event) => {
                const next = event.target.value as UserRole;
                recordAudit("SWITCH_ROLE", next, "VIEWED", `Chuyển từ ${role} sang ${next}`);
                setRole(next);
                if (page === "audit" && !can(next, "audit:read")) setPage("overview");
              }}
            >
              <option value="staff">Nhân viên sàn</option>
              <option value="manager">Quản lý</option>
              <option value="auditor">Kiểm toán viên</option>
            </select>
          </label>
          <button
            className="sim-alert-btn"
            title="Xem cảnh báo"
            aria-label={`Xem ${alerts} cảnh báo`}
            onClick={() => {
              openAlertCenter();
            }}
          >
            <AlertTriangle size={18} />
            {alerts > 0 && <span>{alerts}</span>}
          </button>
          <div className="sim-avatar">AD</div>
        </header>
        <main className="sim-main">
          <div className="sim-title-row">
            <div>
              <div className="sim-eyebrow">
                GROCERY OPERATIONS <span>3.000 SKU</span>
              </div>
              <h1>
                {page === "simulation"
                  ? "Không gian vận hành"
                  : navigation.find((n) => n.id === page)?.label}
                <span className="sim-title-dot">.</span>
              </h1>
              <p>
                Kho dự trữ và khu bán hàng cùng một cửa hàng bách hóa · Quản lý tồn theo lô và hạn
                sử dụng.
              </p>
            </div>
            <div className="sim-title-actions">
              <button className="sim-button" onClick={exportData}>
                <Download size={16} />
                <span>Xuất CSV</span>
              </button>
              <button
                className="sim-button primary"
                onClick={() => openCommand(site === "warehouse" ? "inbound" : "sale")}
              >
                <Plus size={17} />
                {site === "warehouse" ? "Nhập hàng mới" : "Tạo lượt mua"}
              </button>
            </div>
          </div>

          <div className="sim-metrics">
            <Metric
              icon={Boxes}
              label="Tổng hàng trong kho"
              value={fmt(warehouseTotal)}
              unit="đơn vị bán"
              sub={`${fmt(state.products.length)} SKU đang quản lý`}
              tone="green"
              mini={[25, 36, 29, 46, 39, 56, 48, 67, 61, 79]}
              onClick={() => {
                setQuery("");
                go("inventory");
              }}
            />
            <Metric
              icon={Store}
              label="Hàng trên sàn bán"
              value={fmt(storeTotal)}
              unit="đơn vị bán"
              sub={`Đã bổ sung ${state.delivered} sản phẩm`}
              tone="blue"
              mini={[38, 28, 40, 33, 50, 46, 61, 54, 70, 75]}
              onClick={() => {
                switchSite("store");
                go("inventory");
              }}
            />
            <Metric
              icon={Activity}
              label="Quy trình đang chạy"
              value={String(active.length).padStart(2, "0")}
              unit="quy trình"
              sub={`${completed} quy trình hoàn tất`}
              tone="purple"
              mini={[25, 48, 35, 67, 42, 71, 50, 62, 47, 57]}
              onClick={() => go("activity")}
            />
            <Metric
              icon={ShieldCheck}
              label="Cần theo dõi"
              value={String(alerts).padStart(2, "0")}
              unit="cảnh báo"
              sub={`${damaged} hàng cách ly · ${inventoryStats.lowStock} kệ sắp hết`}
              tone="amber"
              mini={[70, 62, 58, 62, 41, 48, 40, 32, 37, 26]}
              onClick={() => openAlertCenter()}
            />
          </div>

          <GrocerySummary
            state={state}
            onInventory={showInventory}
            onNextDay={() => {
              dispatch({ type: "advance-day" });
              setNotice("Đã sang ngày mới, cách ly lô hết hạn và tiếp tục mô phỏng.");
            }}
          />
          <div className="grocery-retail-controls">
            <span className="sim-button primary grocery-auto-live">
              <ShoppingCart size={16} />
              Khách mua & đơn online tự động · LIVE
            </span>
            <span>7:00–21:00 · Lượt mua theo phút · Tự bổ sung khi kệ thấp</span>
            <strong>
              {fmt(state.sold)} đơn vị đã bán{" "}
              <small>
                ·{" "}
                {can(role, "financial:read")
                  ? `${fmt(state.revenue)} ₫`
                  : "Doanh thu bị ẩn bởi RBAC"}
              </small>
            </strong>
            {page !== "simulation" && (
              <span className="grocery-running-clock">● Đang chạy · {clockLabel(state.time)}</span>
            )}
          </div>

          {page === "simulation" && (
            <>
              <div className="sim-workbench">
                <section className={`sim-map-panel ${fullMap ? "sim-map-full" : ""}`}>
                  <div className="sim-map-heading">
                    <div className="sim-site-tabs">
                      <button
                        className={site === "warehouse" ? "active" : ""}
                        onClick={() => switchSite("warehouse")}
                      >
                        <Warehouse size={16} /> Kho hàng <span>WH-01</span>
                      </button>
                      <button
                        className={site === "store" ? "active" : ""}
                        onClick={() => switchSite("store")}
                      >
                        <Store size={16} /> Cửa hàng <span>ST-01</span>
                      </button>
                    </div>
                    <Tag>LIVE · Luôn chạy</Tag>
                  </div>
                  <div className="sim-map-toolbar">
                    <div className="sim-view-switch">
                      <button className={!flat ? "active" : ""} onClick={() => setFlat(false)}>
                        <Box size={14} /> Phối cảnh
                      </button>
                      <button className={flat ? "active" : ""} onClick={() => setFlat(true)}>
                        <Map size={14} /> Mặt bằng
                      </button>
                    </div>
                    <div className="sim-layer-toggles">
                      <button
                        className={labels ? "active" : ""}
                        onClick={() => setLabels((v) => !v)}
                        aria-pressed={labels}
                      >
                        <span>{labels && <Check size={10} />}</span>Nhãn
                      </button>
                      <button
                        className={paths ? "active" : ""}
                        onClick={() => setPaths((v) => !v)}
                        aria-pressed={paths}
                      >
                        <span>{paths && <Check size={10} />}</span>Luồng di chuyển
                      </button>
                      <IconButton
                        icon={Camera}
                        label="Bật tắt vùng camera"
                        onClick={() => setCameras((v) => !v)}
                        active={cameras}
                      />
                    </div>
                  </div>
                  <div className="sim-map-canvas">
                    <div className="sim-scene-caption">
                      <span className="sim-live-square" />
                      {site === "warehouse" ? "KHO DỰ TRỮ" : "CỬA HÀNG BÁN LẺ"}
                      <small>
                        {site === "warehouse"
                          ? "13 cụm hàng khô + vùng lạnh · sơ đồ khái quát"
                          : "21 nhóm hàng · 3 quầy thanh toán"}
                      </small>
                    </div>
                    <SimulatorScene
                      site={site}
                      state={state}
                      zoom={zoom}
                      flat={flat}
                      labels={labels}
                      paths={paths}
                      cameras={cameras}
                      selected={selected?.id ?? null}
                      onSelect={setSelected}
                    />
                    <button
                      className="sim-map-alert-strip"
                      onClick={() => openAlertCenter()}
                      aria-label={`Mở ${alerts} cảnh báo vận hành`}
                    >
                      <span>
                        <AlertTriangle size={17} />
                      </span>
                      <b>{criticalAlerts.length} cảnh báo đỏ</b>
                      <small>
                        {alerts - criticalAlerts.length} cảnh báo cần theo dõi · Rule engine đang
                        quét live
                      </small>
                      <ChevronRight size={15} />
                    </button>
                    <div className="sim-map-tools">
                      <IconButton
                        icon={Plus}
                        label="Phóng to"
                        onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
                        disabled={zoom >= 1.6}
                      />
                      <span>{Math.round(zoom * 100)}%</span>
                      <IconButton
                        icon={Minus}
                        label="Thu nhỏ"
                        onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
                        disabled={zoom <= 0.7}
                      />
                      <IconButton
                        icon={RotateCcw}
                        label="Đặt lại góc nhìn"
                        onClick={() => {
                          setZoom(1);
                          setFlat(false);
                        }}
                      />
                      <IconButton
                        icon={fullMap ? X : Expand}
                        label={fullMap ? "Đóng toàn màn hình" : "Mở toàn màn hình"}
                        onClick={() => setFullMap((v) => !v)}
                      />
                    </div>
                    <div className="sim-north">
                      <span>N</span>
                      <span>↗</span>
                    </div>
                    <div className="sim-scene-hint">
                      <span>
                        <i className="worker" /> Nhân viên
                      </span>
                      <span>
                        <i className="equipment" /> Thiết bị
                      </span>
                      <span>
                        <i className="goods" /> Hàng hóa
                      </span>
                      <span>
                        <i className="flow" /> Luồng di chuyển
                      </span>
                    </div>
                    <div className="sim-click-hint">Nhấp vào đối tượng để xem chi tiết</div>
                  </div>
                  <div className="sim-playback">
                    <span className="sim-play sim-always-running" aria-label="Mô phỏng luôn chạy">
                      <span className="sim-live-dot" />
                      <span>Luôn chạy</span>
                    </span>
                    <IconButton
                      icon={RotateCcw}
                      label="Khởi động lại mô phỏng"
                      onClick={() => setResetOpen(true)}
                    />
                    <span className="sim-divider" />
                    <Clock3 size={15} />
                    <strong data-testid="simulation-clock">{clockLabel(state.time)}</strong>
                    <span className="sim-time-label">Thời gian mô phỏng</span>
                    <div className="sim-speed">
                      <span>Tốc độ</span>
                      {[1, 2, 5, 60].map((s) => (
                        <button
                          key={s}
                          className={s === speed ? "active" : ""}
                          onClick={() => setSpeed(s)}
                          aria-pressed={s === speed}
                        >
                          {s}×
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <aside className="sim-inspector">
                  <div className="sim-inspector-title">
                    <SlidersHorizontal size={16} />
                    <h2>{selected ? "Chi tiết đối tượng" : "Thông tin không gian"}</h2>
                    {selected && (
                      <IconButton
                        icon={X}
                        label="Đóng chi tiết"
                        onClick={() => setSelected(null)}
                      />
                    )}
                  </div>
                  {selected ? (
                    <div className="sim-object-info">
                      <div className="sim-object-icon">
                        {selected.kind === "rack" ? (
                          <Boxes size={30} />
                        ) : selected.kind === "camera" ? (
                          <Camera size={30} />
                        ) : (
                          <Box size={30} />
                        )}
                      </div>
                      <span className="sim-eyebrow">{selected.id}</span>
                      <h3>{selected.label}</h3>
                      <p>{selected.description}</p>
                      {currentProduct ? (
                        <>
                          <div className="sim-detail-values">
                            <span>
                              Sản phẩm đại diện<b>{currentProduct.name}</b>
                            </span>
                            <span>
                              Tại kho<b>{fmt(currentProduct.warehouse)}</b>
                            </span>
                            <span>
                              Đã giữ chỗ tại kho
                              <b>{reserved(state, currentProduct.id, "transfer")}</b>
                            </span>
                            <span>
                              Trên kệ cửa hàng<b>{currentProduct.shelf}</b>
                            </span>
                            <span>
                              Chờ lên kệ<b>{currentProduct.backroom}</b>
                            </span>
                            <span>
                              Hàng cách ly<b>{currentProduct.damaged}</b>
                            </span>
                          </div>
                          <button
                            className="sim-button"
                            onClick={() => setInspectedProductId(currentProduct.id)}
                          >
                            Xem lô & hạn sử dụng
                          </button>
                          <button
                            className="sim-text-button"
                            onClick={() => {
                              setQuery(currentProduct.category);
                              setInventoryFilter("all");
                              setInventoryKey((k) => k + 1);
                              go("inventory");
                            }}
                          >
                            Xem toàn bộ nhóm hàng <ArrowRight size={14} />
                          </button>
                          <button
                            className="sim-button primary"
                            onClick={() => openCommand("transfer", currentProduct.id)}
                          >
                            <Truck size={15} /> Bổ sung hàng
                          </button>
                        </>
                      ) : (
                        <div className="sim-info-note">
                          <Activity size={17} />
                          <span>
                            Đối tượng trong mô hình {site === "warehouse" ? "kho hàng" : "cửa hàng"}
                            . Đồng hồ và hoạt động tuân theo tốc độ mô phỏng.
                          </span>
                        </div>
                      )}
                      <button className="sim-text-button" onClick={() => setSelected(null)}>
                        Quay lại tổng quan <ArrowRight size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="sim-site-summary">
                        <div className="sim-site-icon">
                          {site === "warehouse" ? <Warehouse size={27} /> : <Store size={27} />}
                        </div>
                        <div>
                          <h3>{site === "warehouse" ? "Kho dự trữ" : "Cửa hàng bán lẻ"}</h3>
                          <p>
                            {site === "warehouse" ? "WH-01" : "ST-01"} <span>•</span> Hồ Chí Minh
                          </p>
                        </div>
                        <Tag>Hoạt động</Tag>
                      </div>
                      <div className="sim-space-stats">
                        <div>
                          <Layers3 size={15} />
                          <span>{site === "warehouse" ? "Cụm hàng khô" : "Nhóm hàng"}</span>
                          <b>
                            {site === "warehouse" ? "13" : "21"} <small>cụm</small>
                          </b>
                        </div>
                        <div>
                          <Users size={15} />
                          <span>Nhân viên</span>
                          <b>
                            06 <small>người</small>
                          </b>
                        </div>
                        <div>
                          <Camera size={15} />
                          <span>Camera giám sát</span>
                          <b>
                            04 <small>camera</small>
                          </b>
                        </div>
                        <div>
                          <PackageCheck size={15} />
                          <span>Quy trình tại đây</span>
                          <b>
                            {String(siteJobs.length).padStart(2, "0")} <small>đang chạy</small>
                          </b>
                        </div>
                      </div>
                      <div className="sim-zones">
                        <div className="sim-section-label">
                          CÁC KHU VỰC <span>{site === "warehouse" ? "05" : "04"}</span>
                        </div>
                        {(site === "warehouse"
                          ? [
                              ["receiving", "Tiếp nhận", "Nhập & kiểm tra hàng", "#74a896"],
                              ["picking", "Lấy hàng", "Gom hàng theo lệnh", "#b1b67d"],
                              ["packing", "Đóng gói", "Cân & in nhãn", "#8b9ab1"],
                              ["staging", "Vùng lạnh", "Ngăn mát / Tủ đông", "#a1b989"],
                              [
                                "quarantine",
                                "Cách ly",
                                `${damaged} sản phẩm chờ kiểm tra`,
                                "#d2a061",
                              ],
                            ]
                          : [
                              ["backroom", "Chờ lên kệ", "Xe đẩy từ kho dự trữ", "#74a896"],
                              ["cold", "Mát / Đông", "0–4°C / ≤ −18°C", "#8badc1"],
                              ["returns", "Hàng trả / hỏng", "Kiểm tra chất lượng", "#d2a061"],
                              ["restock", "Bổ sung lên kệ", "Điều phối nhân viên", "#a1b989"],
                            ]
                        ).map(([id, title, detail, color]) => (
                          <button
                            key={id}
                            onClick={() =>
                              setSelected({
                                id: id!,
                                label: title!,
                                description: detail!,
                                kind: "zone",
                              })
                            }
                          >
                            <span className="sim-zone-marker" style={{ background: color }} />
                            <span>
                              <b>{title}</b>
                              <small>{detail}</small>
                            </span>
                            <ChevronRight size={14} />
                          </button>
                        ))}
                      </div>
                      <div className="sim-equipment-summary">
                        <div className="sim-section-label">THIẾT BỊ VẬN HÀNH</div>
                        <div>
                          {(site === "warehouse"
                            ? [
                                "2 xe nâng",
                                "4 xe đẩy",
                                "2 băng chuyền",
                                "6 máy quét",
                                "2 máy in nhãn",
                                "2 cân",
                              ]
                            : ["3 quầy POS", "3 máy quét", "Xe đẩy & giỏ hàng", "Khu xe đẩy"]
                          ).map((text) => (
                            <span key={text}>{text}</span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="sim-transfer-card">
                    <div>
                      <span>
                        <Truck size={17} />
                      </span>
                      <b>Kho dự trữ → kệ bán</b>
                    </div>
                    <p>
                      {inTransit(state) > 0
                        ? `${inTransit(state)} đơn vị trên xe đẩy từ kho ra quầy.`
                        : "Tạo lệnh để mô phỏng toàn bộ hành trình bổ sung hàng."}
                    </p>
                    <button onClick={() => openCommand("transfer")}>
                      Chuyển hàng <ArrowRight size={15} />
                    </button>
                  </div>
                </aside>
              </div>

              <section className="sim-pipeline">
                <div className="sim-pipeline-label">
                  <span>END-TO-END FLOW</span>
                  <b>Hành trình hàng hóa</b>
                  <small className={selectedJob ? "is-running" : ""} aria-live="polite">
                    <i /> {operationDetail}
                  </small>
                </div>
                <div className="sim-flow-steps">
                  {[
                    { icon: ArrowDownToLine, text: "Tiếp nhận" },
                    { icon: Boxes, text: "Lưu kho" },
                    { icon: ShoppingCart, text: "Lấy hàng" },
                    { icon: PackageCheck, text: "Kiểm tra lô" },
                    { icon: Truck, text: "Đẩy xe ra quầy" },
                    { icon: Store, text: "Lên kệ" },
                    { icon: CheckCheck, text: "Thanh toán" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div
                      key={text}
                      className={pipelineStep === i ? "active" : pipelineStep > i ? "complete" : ""}
                    >
                      <span>
                        <Icon size={16} />
                      </span>
                      <small>{text}</small>
                      {i < 6 && <ChevronRight className="sim-flow-chevron" size={13} />}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {page === "inventory" && (
            <GroceryInventory
              key={inventoryKey}
              state={state}
              query={query}
              onQuery={setQuery}
              onCommand={openCommand}
              onInspect={setInspectedProductId}
              initialFilter={inventoryFilter}
            />
          )}

          {page === "orders" && (
            <CustomerOrders
              state={state}
              role={role}
              onCreate={createCustomerOrder}
              onToggleAuto={toggleAutoOrders}
            />
          )}

          {page === "overview" && (
            <div className="sim-overview-grid">
              <section className="sim-data-panel">
                <div className="sim-panel-title">
                  <h2>Tổng quan vận hành</h2>
                  <Tag>LIVE · Luôn chạy</Tag>
                </div>
                <div className="sim-summary-cards">
                  {[
                    {
                      icon: Warehouse,
                      name: "Kho dự trữ",
                      total: warehouseTotal,
                      site: "warehouse" as const,
                      text: "13 cụm khô + mát / đông · sơ đồ nhóm",
                    },
                    {
                      icon: Store,
                      name: "Cửa hàng bán lẻ",
                      total: storeTotal,
                      site: "store" as const,
                      text: "21 nhóm hàng · 3 POS · 4 camera",
                    },
                  ].map(({ icon: Icon, name, total, site: target, text }) => (
                    <button
                      key={name}
                      onClick={() => {
                        switchSite(target);
                        go("simulation");
                      }}
                    >
                      <Icon size={36} />
                      <h3>{name}</h3>
                      <p>{text}</p>
                      <strong>
                        {fmt(total)} <small>sản phẩm</small>
                      </strong>
                      <span>
                        Mở không gian <ArrowUpRight size={17} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="sim-session-totals">
                  <span>
                    <b>{state.received}</b>Đã nhập kho
                  </span>
                  <span>
                    <b>{inTransit(state)}</b>Đang vận chuyển
                  </span>
                  <span>
                    <b>{state.delivered}</b>Đã bổ sung kệ
                  </span>
                  <span>
                    <b>{state.sold}</b>Đã bán
                  </span>
                </div>
              </section>
              <section className="sim-data-panel">
                <div className="sim-panel-title">
                  <h2>Cần theo dõi</h2>
                  <Tag tone="amber">{alerts} cảnh báo</Tag>
                </div>
                <div className="sim-alert-list">
                  {operationalAlerts.slice(0, 6).map((alert) => (
                    <div key={alert.id} className={alert.severity}>
                      <AlertTriangle size={19} />
                      <div>
                        <b>{alert.title}</b>
                        <p>
                          {alert.sku} · {alert.detail}
                        </p>
                        <button onClick={() => openAlertCenter(alert.id)}>
                          Xem nguyên nhân & đề xuất RAG <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {operationalAlerts.length > 6 && (
                    <button className="sim-button" onClick={() => openAlertCenter()}>
                      Mở tất cả {fmt(operationalAlerts.length)} cảnh báo
                    </button>
                  )}
                  {alerts === 0 && (
                    <div className="sim-empty">
                      <CheckCheck />
                      <b>Không có cảnh báo</b>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {page === "metrics" && (
            <MetricsDashboard
              state={state}
              role={role}
              rescueDecisions={rescueDecisions}
              onOpenRescue={() => setRescueOpen(true)}
            />
          )}

          {page === "scenarios" && <ScenarioLab state={state} role={role} onRun={auditScenario} />}

          {page === "audit" && can(role, "audit:read") && <AuditPanel entries={auditEntries} />}

          {page === "cameras" && (
            <section className="sim-data-panel">
              <div className="sim-panel-title">
                <h2>
                  Vùng quan sát camera <span>8 camera mô phỏng</span>
                </h2>
                <div className="sim-view-switch">
                  <button
                    className={site === "warehouse" ? "active" : ""}
                    onClick={() => switchSite("warehouse")}
                  >
                    Kho hàng
                  </button>
                  <button
                    className={site === "store" ? "active" : ""}
                    onClick={() => switchSite("store")}
                  >
                    Cửa hàng
                  </button>
                </div>
              </div>
              <p className="sim-camera-note">
                Các góc quan sát dưới đây được dựng từ mô hình isometric; không kết nối video camera
                thực.
              </p>
              <div className="sim-camera-grid">
                {[0, 1, 2, 3].map((i) => (
                  <button
                    key={`${site}-${i}`}
                    onClick={() => {
                      setSelected({
                        id: `CAM-${site === "warehouse" ? "WH" : "ST"}-0${i + 1}`,
                        label: `Camera 0${i + 1}`,
                        description: "Vùng quan sát mô phỏng",
                        kind: "camera",
                      });
                      setCameras(true);
                      setPage("simulation");
                    }}
                  >
                    <div>
                      <Camera size={14} />
                      <b>
                        CAM-{site === "warehouse" ? "WH" : "ST"}-0{i + 1}
                      </b>
                      <span>{clockLabel(state.time)}</span>
                    </div>
                    <div className={`sim-camera-frame camera-${i}`}>
                      <SimulatorScene
                        site={site}
                        state={state}
                        zoom={1.2 + i * 0.16}
                        flat={i === 3}
                        labels={false}
                        paths={false}
                        cameras={true}
                        selected={null}
                        onSelect={() => {}}
                        readOnly
                      />
                    </div>
                    <span className="sim-camera-foot">
                      Góc {["tổng quan", "dãy kệ A", "khu vận hành", "mặt bằng"][i]}{" "}
                      <Expand size={13} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(page === "simulation" || page === "activity" || page === "overview") && (
            <section className="sim-data-panel sim-bottom-panel">
              <div className="sim-bottom-heading">
                <div className="sim-bottom-tabs">
                  <button
                    className={bottomTab === "jobs" ? "active" : ""}
                    onClick={() => setBottomTab("jobs")}
                  >
                    <RouteIcon size={16} />
                    Quy trình vận hành <span>{active.length}</span>
                  </button>
                  <button
                    className={bottomTab === "events" ? "active" : ""}
                    onClick={() => setBottomTab("events")}
                  >
                    <Activity size={16} />
                    Nhật ký hoạt động
                  </button>
                </div>
                <div className="sim-bottom-actions">
                  <Tag tone="gray">Dữ liệu mô phỏng</Tag>
                  <button onClick={() => openCommand("transfer")}>
                    <Plus size={15} /> Tạo quy trình
                  </button>
                </div>
              </div>
              {bottomTab === "jobs" ? (
                <JobsTable state={state} all={page === "activity"} />
              ) : (
                <div className="sim-events">
                  {state.events.slice(0, page === "activity" ? 100 : 6).map((e) => (
                    <div key={e.id}>
                      <time>{clockLabel(e.time)}</time>
                      <i className={e.tone} />
                      <div>
                        <b>{e.title}</b>
                        <span>{e.detail}</span>
                      </div>
                      <small>{e.site === "warehouse" ? "Kho hàng" : "Cửa hàng"}</small>
                      <Check size={14} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          <footer className="sim-footer">
            <span>
              <span className="sim-mini-live" /> WareSim · Warehouse & Retail Simulator
            </span>
            <span>3.000 SKU giả lập · HSD / giá giả định · Tải lại trang sẽ khởi tạo lại</span>
          </footer>
        </main>
      </div>

      <Dialog
        open={command !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCommand(null);
            dispatch({ type: "clear-error" });
          }
        }}
      >
        <DialogContent className="sim-modal">
          <div className="sim-modal-icon">
            <Box size={25} />
          </div>
          <DialogTitle>{command ? commandTitles[command] : "Tạo quy trình"}</DialogTitle>
          <DialogDescription>
            {command === "transfer"
              ? "Giữ lô theo FEFO: lấy lô hết hạn sớm nhất, đẩy xe ra quầy rồi bổ sung lên kệ trong cùng cửa hàng."
              : command === "inbound"
                ? "Tồn kho tăng sau khi lô hàng hoàn tất tiếp nhận, quét kiểm tra và cất hàng."
                : command === "sale"
                  ? "Khách chọn hàng, đến quầy POS rồi thanh toán. Tồn kệ giảm khi thanh toán hoàn tất."
                  : "Chuyển hàng từ kho sang khu cách ly để mô phỏng phát hiện hàng hỏng."}
          </DialogDescription>
          <form onSubmit={submit}>
            <label>
              Tìm trong 3.000 SKU
              <input
                aria-label="Tìm sản phẩm cho quy trình"
                placeholder="Tên, nhãn hoặc mã SKU…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </label>
            <label>
              Sản phẩm
              <select
                value={sku}
                onChange={(e) => {
                  openCommand(command!, e.target.value);
                }}
              >
                {commandProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name} · {p.brand}
                  </option>
                ))}
              </select>
            </label>
            <p className="grocery-lot-note">
              Hiển thị tối đa 80 kết quả và sản phẩm đã chọn.{" "}
              {commandProduct &&
                `${commandProduct.pack} · ${storageLabels[commandProduct.storage]} · ${fmt(commandProduct.price)} ₫/${commandProduct.unit}`}
            </p>
            {command === "inbound" && commandProduct?.shelfLifeDays !== null && (
              <label>
                Hạn sử dụng lô nhập
                <input
                  type="date"
                  required
                  min={simDate(state.time)}
                  max={
                    commandProduct?.shelfLifeDays
                      ? dateAfter(simDate(state.time), commandProduct.shelfLifeDays)
                      : undefined
                  }
                  value={incomingExpiry}
                  onChange={(e) => {
                    setIncomingExpiry(e.target.value);
                    dispatch({ type: "clear-error" });
                  }}
                />
              </label>
            )}
            {command === "inbound" && commandProduct?.shelfLifeDays === null && (
              <p className="grocery-lot-note">
                Đồ dùng không áp dụng HSD; hệ thống lưu ngày nhập lô.
              </p>
            )}
            <div className="sim-form-stock">
              <span>
                Tồn kho khả dụng{" "}
                <b>
                  {(() => {
                    const p = state.products.find((p) => p.id === sku);
                    return p ? p.warehouse - reserved(state, sku, "transfer") : 0;
                  })()}
                </b>
              </span>
              <span>
                Khả dụng trên kệ{" "}
                <b>
                  {(() => {
                    const p = state.products.find((p) => p.id === sku);
                    return p ? p.shelf - reserved(state, sku, "sale") : 0;
                  })()}
                </b>
              </span>
            </div>
            <label>
              Số lượng sản phẩm
              <input
                type="number"
                min={1}
                max={1000}
                step={1}
                required
                value={quantity}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  dispatch({ type: "clear-error" });
                }}
              />
            </label>
            {state.error && (
              <p className="sim-form-error" role="alert">
                {state.error}
              </p>
            )}
            <div className="sim-modal-note">
              <Clock3 size={15} />
              {command === "damage"
                ? "Cập nhật ngay khi xác nhận"
                : `${command === "transfer" ? "30" : "15"} giây mô phỏng · Tốc độ hiện tại ${speed}×`}
            </div>
            <div className="sim-modal-actions">
              <button type="button" className="sim-button" onClick={() => setCommand(null)}>
                Hủy
              </button>
              <button type="submit" className="sim-button primary">
                <Plus size={16} />
                {command === "damage" ? "Xác nhận cách ly" : "Tạo quy trình"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ProductLotsDialog
        state={state}
        productId={inspectedProductId}
        onClose={() => setInspectedProductId(null)}
        onCommand={openCommand}
      />
      <AlertCenter
        open={alertsOpen}
        onOpenChange={setAlertsOpen}
        state={state}
        alerts={operationalAlerts}
        focusId={alertFocusId}
        onCommand={openCommand}
        onInspect={setInspectedProductId}
        onInventory={showInventory}
        onAskRag={(question) => setRagRequest({ id: Date.now(), question })}
        onFoodRescue={() => {
          setAlertsOpen(false);
          setRescueOpen(true);
        }}
      />
      <FoodRescueCenter
        open={rescueOpen}
        onOpenChange={setRescueOpen}
        state={state}
        role={role}
        decisions={rescueDecisions}
        onDecision={decideRescue}
      />
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sim-modal">
          <DialogTitle>Khởi động lại mô phỏng?</DialogTitle>
          <DialogDescription>
            Tồn kho, quy trình và nhật ký trong phiên sẽ trở về dữ liệu mẫu ban đầu. Bạn có thể xuất
            dữ liệu trước khi khởi động lại.
          </DialogDescription>
          <div className="sim-modal-actions">
            <button className="sim-button" onClick={() => setResetOpen(false)}>
              Tiếp tục phiên
            </button>
            <button
              className="sim-button primary"
              onClick={() => {
                dispatch({ type: "reset" });
                setSpeed(1);
                setSelected(null);
                setResetOpen(false);
                setNotice("Đã khởi động lại mô phỏng.");
              }}
            >
              <RotateCcw size={16} /> Khởi động lại
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sim-modal">
          <DialogTitle>Khám phá mô phỏng WareSim</DialogTitle>
          <DialogDescription>
            Dựa trên sơ đồ kho hàng và cửa hàng trong prompt.txt.
          </DialogDescription>
          <ol className="sim-help-steps">
            <li>
              <b>Quan sát không gian</b>
              <p>
                Chuyển giữa kho và cửa hàng. Nhấp vào kệ, nhân viên hoặc khu vực để xem chi tiết.
              </p>
            </li>
            <li>
              <b>Tạo hành trình hàng hóa</b>
              <p>
                Nhập hàng mới, chuyển hàng đến cửa hàng, sau đó tạo lượt mua để theo dõi thanh toán.
              </p>
            </li>
            <li>
              <b>Điều khiển thời gian</b>
              <p>
                Mô phỏng và khách mua luôn chạy. Chọn tốc độ đến 60× hoặc sang ngày tiếp theo để
                quan sát lô hết hạn.
              </p>
            </li>
            <li>
              <b>Kiểm tra dữ liệu</b>
              <p>
                Tìm theo SKU, hỏi trợ lý Live State, tạo hàng hỏng và xuất tồn theo lô thành CSV.
              </p>
            </li>
          </ol>
          <p className="sim-modal-note">
            Phối cảnh isometric bằng SVG. Đây là dữ liệu mô phỏng cục bộ, không kết nối WMS, POS hay
            camera thực.
          </p>
        </DialogContent>
      </Dialog>
      {notice && (
        <div className="sim-toast" role="status">
          <CheckCheck size={19} />
          {notice}
          <button onClick={() => setNotice("")} aria-label="Đóng thông báo">
            <X size={16} />
          </button>
        </div>
      )}
      <Chatbot
        state={state}
        request={ragRequest}
        onGuardrailBlocked={(code, question) =>
          recordAudit("AI_GUARDRAIL", code, "BLOCKED", question.slice(0, 160))
        }
      />
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  tone,
  mini,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  sub: string;
  tone: string;
  mini: number[];
  onClick: () => void;
}) {
  return (
    <button className={`sim-metric ${tone}`} onClick={onClick}>
      <div className="sim-metric-heading">
        <span>{label}</span>
        <span className="sim-metric-icon">
          <Icon size={18} />
        </span>
      </div>
      <div className="sim-metric-value">
        <b>{value}</b>
        <span>{unit}</span>
      </div>
      <div className="sim-metric-bottom">
        <span>{sub}</span>
        <span className="sim-sparkline" aria-hidden="true">
          {mini.map((n, i) => (
            <i key={i} style={{ height: `${n}%` }} />
          ))}
        </span>
      </div>
    </button>
  );
}
function JobsTable({ state, all }: { state: Simulation; all: boolean }) {
  const jobs = [...state.jobs].sort((a, b) => Number(a.done) - Number(b.done));
  return (
    <div className="sim-table-scroll">
      <table className="sim-table sim-jobs-table">
        <thead>
          <tr>
            <th>Mã quy trình</th>
            <th>Hoạt động</th>
            <th>Sản phẩm</th>
            <th>Số lượng</th>
            <th>Tiến độ</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {(all ? jobs : jobs.slice(0, 4)).map((j) => {
            const progress = Math.round(
              ((j.stage + j.elapsed / stageDuration) / (stages[j.kind].length - 1)) * 100,
            );
            return (
              <tr key={j.id}>
                <td>
                  <span className={`sim-job-icon ${j.kind}`}>
                    {j.kind === "inbound" ? (
                      <ArrowDownLeft size={14} />
                    ) : j.kind === "transfer" ? (
                      <Truck size={14} />
                    ) : (
                      <ShoppingBag size={14} />
                    )}
                  </span>
                  <b>{j.id}</b>
                </td>
                <td>
                  {j.kind === "inbound"
                    ? "Nhập hàng"
                    : j.kind === "transfer"
                      ? "Kho → Kệ bán"
                      : "Mua hàng tại POS"}
                </td>
                <td>
                  {state.products.find((p) => p.id === j.sku)?.name}
                  <small className="sim-table-sku">{j.sku}</small>
                </td>
                <td>
                  {j.quantity} <span className="sim-muted">sản phẩm</span>
                </td>
                <td>
                  <div className="sim-progress-cell">
                    <div>
                      <i style={{ width: `${progress}%` }} />
                    </div>
                    <span>{progress}%</span>
                  </div>
                </td>
                <td>
                  <Tag tone={j.cancelled ? "amber" : j.done ? "green" : "blue"}>
                    {j.cancelled ? "Đã hủy · hết hạn" : stages[j.kind][j.stage]}
                  </Tag>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {jobs.length === 0 && (
        <div className="sim-empty">
          <RouteIcon size={28} />
          <b>Chưa có quy trình</b>
          <p>Tạo lệnh nhập hoặc chuyển hàng để bắt đầu.</p>
        </div>
      )}
    </div>
  );
}
