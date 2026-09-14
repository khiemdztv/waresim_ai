import { useEffect, useState, type FormEvent } from "react";
import { WarehouseWorld } from "@/components/warehouse-world";

import {
  Activity, AlertTriangle, Archive, BarChart3, Bell, Bot, Box, Boxes,
  ChevronDown, CircleGauge, Clock3, FileBarChart, Forklift, Gauge, Home,
  LayoutDashboard, Menu, MessageSquareText, Minus, PackageCheck, PackagePlus,
  Pause, Play, Plus, RotateCcw, Search, Send, Settings, ShoppingCart, Sparkles,
  Truck, UserRound, Users, Warehouse, X, Zap, ZoomIn, ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type View = "simulation" | "orders" | "inventory" | "tasks" | "scenarios" | "analytics" | "alerts" | "reports";
type Modal = null | "inbound" | "outbound" | "flash" | "whatif" | "approve";
type Severity = "normal" | "warning" | "critical" | "recovering";
type Agent = { id: string; type: "picker" | "forklift" | "agv"; x: number; y: number; tx: number; ty: number; task: string; progress: number };
type Task = { id: string; type: string; agent: string; route: string; progress: number; status: string };
type EventItem = { time: string; type: string; object: string; location: string; detail: string; tone: "blue" | "green" | "amber" | "red" };

const initialAgents: Agent[] = [
  { id: "P01", type: "picker", x: 26, y: 53.7, tx: 26, ty: 16.9, task: "TASK-3011", progress: 52 },
  { id: "P02", type: "picker", x: 47, y: 25.6, tx: 47, ty: 25.6, task: "TASK-3012", progress: 64 },
  { id: "P03", type: "picker", x: 42.7, y: 53.7, tx: 47, ty: 89, task: "TASK-3015", progress: 31 },
  { id: "P04", type: "picker", x: 68, y: 34.2, tx: 63.9, ty: 53.7, task: "TASK-3013", progress: 38 },
  { id: "P05", type: "picker", x: 12, y: 78, tx: 15.6, ty: 78, task: "TASK-3017", progress: 76 },
  { id: "P06", type: "picker", x: 56, y: 89, tx: 37.5, ty: 89, task: "TASK-3019", progress: 19 },
  { id: "FL01", type: "forklift", x: 14, y: 53.7, tx: 42.7, ty: 25.6, task: "TASK-2029", progress: 82 },
  { id: "FL02", type: "forklift", x: 30, y: 53.7, tx: 12, ty: 44, task: "TASK-2030", progress: 44 },
  { id: "FL03", type: "forklift", x: 63.9, y: 20, tx: 85, ty: 53.7, task: "TASK-2034", progress: 68 },
  { id: "AGV01", type: "agv", x: 47, y: 83, tx: 73.7, ty: 83, task: "MOVE-341", progress: 60 },
];


const initialTasks: Task[] = [
  { id: "TASK-3012", type: "Picking", agent: "P02", route: "A03 → Packing 01", progress: 64, status: "Đang thực hiện" },
  { id: "TASK-3013", type: "Picking", agent: "P04", route: "B02 → Packing 02", progress: 38, status: "Đang di chuyển" },
  { id: "TASK-2029", type: "Put-away", agent: "FL01", route: "Receiving → C02", progress: 82, status: "Đang thực hiện" },
  { id: "TASK-3020", type: "Packing", agent: "P06", route: "Packing 01 → Dock 03", progress: 51, status: "Đang thực hiện" },
];

const initialEvents: EventItem[] = [
  { time: "08:32:14", type: "Picking", object: "ORD-7842", location: "Zone B", detail: "P03 đang lấy SKU-331", tone: "blue" },
  { time: "08:31:48", type: "Put-away", object: "ASN-1024", location: "A03", detail: "120 sản phẩm đã nhập kho", tone: "green" },
  { time: "08:30:15", type: "Replenishment", object: "SKU-102", location: "Zone A", detail: "FL02 đang bổ sung hàng", tone: "blue" },
  { time: "08:28:51", type: "Packing", object: "ORD-7839", location: "Packing 02", detail: "Đơn hàng đã đóng gói", tone: "green" },
  { time: "08:27:12", type: "Warning", object: "Zone B", location: "—", detail: "Hàng đợi Picking tăng 32%", tone: "amber" },
];

const inventorySeed = [
  ["SKU-102", "Tai nghe Bluetooth", "A03", 580, 40, 120, "Tốt"],
  ["SKU-331", "Chuột không dây", "B02", 325, 28, 0, "Tốt"],
  ["SKU-558", "Bàn phím cơ", "C03", 82, 18, 0, "Sắp hết"],
  ["SKU-209", "Sạc USB-C 65W", "A01", 1240, 92, 200, "Tốt"],
  ["SKU-781", "Webcam HD", "B04", 490, 35, 0, "Tốt"],
] as const;

const nav = [
  ["simulation", "Mô phỏng kho", Warehouse], ["orders", "Đơn hàng", ShoppingCart],
  ["tasks", "Nhiệm vụ", PackageCheck], ["inventory", "Tồn kho", Boxes],
  ["scenarios", "Kịch bản mô phỏng", Zap], ["analytics", "KPI & Phân tích", BarChart3],
  ["alerts", "Cảnh báo", AlertTriangle], ["reports", "Báo cáo", FileBarChart],
] as const;

function formatClock(total: number) {
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function WarehouseApp() {
  const [view, setView] = useState<View>("simulation");
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [clock, setClock] = useState(8 * 3600 + 32 * 60 + 14);
  const [modal, setModal] = useState<Modal>(null);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [agents, setAgents] = useState(initialAgents);
  const [tasks, setTasks] = useState(initialTasks);
  const [events, setEvents] = useState(initialEvents);
  const [orders, setOrders] = useState(128);
  const [stock, setStock] = useState(24892);
  const [sla, setSla] = useState(96.5);
  const [efficiency, setEfficiency] = useState(142);
  const [zoneState, setZoneState] = useState<Severity>("normal");
  const [zoneUtil, setZoneUtil] = useState(71);
  const [toast, setToast] = useState("");
  const [truck, setTruck] = useState(false);
  const [pallets, setPallets] = useState(5);
  const [aiMessages, setAiMessages] = useState([
    "Tôi đang theo dõi trạng thái kho. Hiện tại hệ thống vận hành ổn định.",
    "Zone A đang xử lý tốt. SKU-558 có nguy cơ hết hàng trong 1 giờ 42 phút.",
  ]);
  const [chat, setChat] = useState("");

  const now = formatClock(clock);
  const utilization = zoneState === "critical" ? 92 : zoneState === "warning" ? 84 : zoneState === "recovering" ? 78 : zoneUtil;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setClock((c) => c + speed);
      setAgents((items) => items.map((a) => {
        const dx = a.tx - a.x; const dy = a.ty - a.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          const destinations: Array<[number, number]> = [[21.4, 16.9], [42.7, 25.6], [63.9, 34.2], [21.4, 53.7], [42.7, 53.7], [63.9, 53.7], [85, 53.7], [10, 78], [15.6, 78], [37.5, 89], [47, 89], [56, 89], [73.7, 83], [29.6, 70]];
          const next = destinations[Math.floor(Math.random() * destinations.length)] ?? [50, 50];
          return { ...a, tx: next[0], ty: next[1], progress: (a.progress + 3) % 100 };
        }
        return { ...a, x: a.x + dx * .045 * Math.min(speed, 5), y: a.y + dy * .045 * Math.min(speed, 5), progress: Math.min(99, a.progress + 0.2 * speed) };
      }));
      setTasks((items) => items.map((t) => ({ ...t, progress: Math.min(99, t.progress + .12 * speed) })));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, speed]);

  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 3500); return () => window.clearTimeout(t); }, [toast]);

  const addEvent = (item: Omit<EventItem, "time">) => setEvents((e) => [{ time: formatClock(clock), ...item }, ...e].slice(0, 8));

  const reset = () => {
    setRunning(true); setSpeed(1); setClock(8 * 3600 + 32 * 60 + 14); setAgents(initialAgents);
    setTasks(initialTasks); setEvents(initialEvents); setOrders(128); setStock(24892); setSla(96.5);
    setEfficiency(142); setZoneState("normal"); setZoneUtil(71); setTruck(false); setPallets(5);
    setAiMessages(["Tôi đang theo dõi trạng thái kho. Hiện tại hệ thống vận hành ổn định.", "Zone A đang xử lý tốt. SKU-558 có nguy cơ hết hàng trong 1 giờ 42 phút."]);
    setToast("Mô phỏng đã được đặt lại");
  };

  const submitInbound = (e: FormEvent) => {
    e.preventDefault(); setModal(null); setTruck(true); setPallets((p) => p + 4); setStock((s) => s + 200);
    setTasks((t) => [{ id: "TASK-2031", type: "Receiving", agent: "FL02", route: "Dock 02 → A03", progress: 2, status: "Đang di chuyển" }, ...t]);
    setAgents((a) => a.map((x) => x.id === "FL02" ? { ...x, tx: 8, ty: 34.7, task: "TASK-2031", progress: 2 } : x));
    addEvent({ type: "Receiving", object: "ASN-1025", location: "Dock 02", detail: "Xe ASN-1025 đã đến, FL02 nhận nhiệm vụ", tone: "blue" });
    setAiMessages((m) => [...m, "Đã xác nhận ASN-1025 tại Dock 02. Hệ thống chọn vị trí A03 và điều phối FL02."]);
    setToast("Nhập hàng đã bắt đầu · 200 SKU-102 → A03");
  };

  const submitOutbound = (e: FormEvent) => {
    e.preventDefault(); setModal(null); setOrders((o) => o + 1); setStock((s) => s - 35);
    const newTasks: Task[] = [
      { id: "TASK-3012", type: "Picking", agent: "P02", route: "A03 → Packing 01", progress: 4, status: "Đang di chuyển" },
      { id: "TASK-3013", type: "Picking", agent: "P04", route: "B02 → Packing 02", progress: 2, status: "Đang di chuyển" },
      { id: "TASK-3014", type: "Picking", agent: "P05", route: "C03 → Packing 02", progress: 1, status: "Chờ xử lý" },
    ];
    setTasks((t) => [...newTasks, ...t.filter((x) => !newTasks.some((n) => n.id === x.id))]);
    setAgents((a) => a.map((x) => x.id === "P02" ? { ...x, tx: 50, ty: 36 } : x.id === "P04" ? { ...x, tx: 66, ty: 43 } : x.id === "P05" ? { ...x, tx: 78, ty: 42 } : x));
    addEvent({ type: "Outbound", object: "ORD-7849", location: "Picking", detail: "Đã tạo 3 nhiệm vụ picking cho 35 sản phẩm", tone: "blue" });
    setToast("Đơn ORD-7849 đã được phân công cho P02, P04 và P05");
  };

  const triggerFlash = (e?: FormEvent) => {
    e?.preventDefault(); setModal(null); setOrders(412); setSla(91.8); setZoneState("critical"); setZoneUtil(92);
    setTasks((t) => [...Array.from({ length: 4 }, (_, i) => ({ id: `FLASH-${401 + i}`, type: "Picking", agent: `P0${(i % 6) + 1}`, route: "Zone B → Packing", progress: i * 4, status: "Chờ xử lý" })), ...t]);
    addEvent({ type: "Critical", object: "Zone B", location: "Picking", detail: "Flash Sale: hàng đợi tăng 223%, 46 đơn có nguy cơ trễ", tone: "red" });
    setAiMessages((m) => [...m, "CẢNH BÁO: Phát hiện bottleneck nghiêm trọng tại Zone B. Công suất 92%, 46 đơn có nguy cơ trễ SLA trong 60 phút.", "Đề xuất điều chuyển P05 và P06 sang Zone B, tối ưu 27 tuyến picking và bổ sung 120 SKU-102."]);
    setToast("AI phát hiện Bottleneck nghiêm trọng tại Zone B");
  };

  const applyAi = () => {
    setModal(null); setView("simulation"); setZoneState("recovering"); setZoneUtil(78); setOrders(276); setSla(97.6); setEfficiency(168);
    setAgents((a) => a.map((x) => ["P05", "P06"].includes(x.id) ? { ...x, tx: 63.9, ty: 25.6, task: "AI-REROUTE" } : x));
    setTasks((t) => [{ id: "AI-2041", type: "Replenishment", agent: "FL02", route: "Reserve → Zone B", progress: 3, status: "Đang thực hiện" }, ...t]);
    addEvent({ type: "AI Action", object: "REC-028", location: "Zone B", detail: "Đã duyệt: P05, P06 điều chuyển và tối ưu 27 tuyến", tone: "green" });
    setAiMessages((m) => [...m, "Phương án đã được phê duyệt. Zone B đang phục hồi; SLA dự báo 97.6%."]);
    setToast("Đã áp dụng phương án AI · Zone B đang phục hồi");
  };

  const askAi = (e: FormEvent) => {
    e.preventDefault(); if (!chat.trim()) return;
    const answer = zoneState === "critical" ? "Zone B nghẽn do hàng đợi Picking tăng đột biến. Tôi khuyến nghị mô phỏng phương án điều chuyển P05, P06 trước khi áp dụng." : "Kho đang ổn định. Điểm cần chú ý nhất là SKU-558, dự kiến hết trong 1 giờ 42 phút.";
    setAiMessages((m) => [...m, `Bạn: ${chat}`, answer]); setChat("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-border bg-sidebar xl:flex xl:flex-col">
        <div className="flex h-18 items-center gap-3 border-b border-border px-5">
          <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Warehouse size={22} /></div>
          <div><div className="font-display text-lg font-bold text-sidebar-foreground">WareSim AI</div><div className="text-[10px] font-medium text-muted-foreground">AI WAREHOUSE INTELLIGENCE</div></div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <button onClick={() => setView("simulation")} className="nav-item mb-3"><Home /> Tổng quan</button>
          {nav.map(([id, label, Icon]) => <button key={id} onClick={() => setView(id)} className={`nav-item ${view === id ? "nav-active" : ""}`}><Icon /> <span>{label}</span>{id === "alerts" && <b className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">3</b>}</button>)}
        </nav>
        <div className="m-3 rounded-lg border border-primary/15 bg-primary-soft p-4"><Bot className="mb-3 text-primary" /><p className="text-sm font-semibold">Kho thông minh hơn mỗi ngày cùng AI</p><div className="mt-3 flex items-center gap-2 text-xs text-primary"><span className="status-dot bg-success" /> Copilot sẵn sàng</div></div>
      </aside>

      <div className="xl:pl-56">
        <header className="sticky top-0 z-20 flex h-18 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-5">
          <Button size="icon" variant="ghost" className="xl:hidden"><Menu /></Button>
          <button className="hidden min-w-56 items-center gap-2 text-left sm:flex"><Warehouse className="text-primary" size={18}/><span><b className="block text-xs">Kho E-commerce HCM #01</b><small className="text-muted-foreground">TP. Hồ Chí Minh</small></span><ChevronDown className="ml-auto" size={15}/></button>
          <label className="mx-auto flex h-10 max-w-xl flex-1 items-center gap-2 rounded-lg bg-muted px-3"><Search size={17} className="text-muted-foreground"/><input className="w-full bg-transparent text-sm outline-none" placeholder="Tìm SKU, đơn hàng, vị trí, nhiệm vụ..."/><kbd className="hidden text-[10px] text-muted-foreground md:block">Ctrl K</kbd></label>
          <div className="hidden items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs font-semibold md:flex"><Clock3 size={15} className="text-primary"/>{now}</div>
          <button className="relative p-2 text-muted-foreground"><Bell size={19}/><span className="absolute right-1 top-1 size-2 rounded-full bg-destructive"/></button>
          <div className="hidden items-center gap-2 border-l border-border pl-3 lg:flex"><div className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">NT</div><div><b className="block text-xs">Nguyễn Trần</b><small className="text-muted-foreground">Quản trị viên</small></div></div>
        </header>
        <main className="p-3 lg:p-4">
          {view === "simulation" ? <SimulationView {...{ running, setRunning, speed, setSpeed, now, reset, setModal, zoom, setZoom, agents, tasks, events, orders, stock, sla, efficiency, zoneState, utilization, selected, setSelected, truck, pallets, aiMessages, chat, setChat, askAi }} /> : <SupportingView view={view} inventory={inventorySeed} setModal={setModal} onRunFlash={() => setModal("flash")} />}
        </main>
      </div>
      {selected && <DetailDrawer item={selected} close={() => setSelected(null)} utilization={utilization} agents={agents} />}
      {modal && <ModalView modal={modal} close={() => setModal(null)} inbound={submitInbound} outbound={submitOutbound} flash={triggerFlash} next={(m: Modal) => setModal(m)} apply={applyAi} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-xl"><PackageCheck size={17}/>{toast}</div>}
    </div>
  );
}

function SimulationView(props: any) {
  const { running, setRunning, speed, setSpeed, now, reset, setModal, zoom, setZoom, agents, tasks, events, orders, stock, sla, efficiency, zoneState, utilization, selected, setSelected, truck, pallets, aiMessages, chat, setChat, askAi } = props;
  const kpis = [["Đơn đang xử lý", orders, ShoppingCart, "+12%"], ["Tồn kho khả dụng", stock.toLocaleString("en-US"), Box, "+5%"], ["SLA đúng hạn", `${sla}%`, CircleGauge, zoneState === "critical" ? "−4.7%" : "+2.1%"], ["Nhiệm vụ đang chạy", tasks.length + 14, Activity, "+3"], ["Hiệu suất Picking", efficiency, BarChart3, "dòng/giờ"], ["Cảnh báo", zoneState === "critical" ? 4 : 3, AlertTriangle, zoneState === "critical" ? "+1" : "−1"]];
  return <>
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-xl font-bold">Mô phỏng vận hành kho</h1><p className="text-xs text-muted-foreground">Theo dõi, mô phỏng và tối ưu hoạt động kho theo thời gian thực.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setModal("inbound")}><PackagePlus/> Nhập hàng</Button><Button size="sm" variant="outline" onClick={() => setModal("outbound")}><Plus/> Tạo đơn xuất</Button><Button size="sm" variant="warning" onClick={() => setModal("flash")}><Zap/> Tạo Flash Sale</Button></div></div>
    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{kpis.map(([label, value, Icon, delta]: any) => <div key={label} className="metric-card"><div className="metric-icon"><Icon/></div><div className="min-w-0"><p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p><strong className="mt-1 block text-xl leading-none">{value}</strong></div><span className={`ml-auto self-end text-[10px] font-bold ${String(delta).startsWith("−") || String(delta).startsWith("+") && label === "Cảnh báo" ? "text-destructive" : "text-success"}`}>{delta}</span></div>)}</div>
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-panel">
        <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border px-3 py-2"><div className="mr-auto flex items-center gap-2"><b className="text-sm">Digital Twin · Live Floor</b><span className={`badge ${running ? "badge-success" : "badge-muted"}`}><span className="status-dot"/>{running ? "Đang chạy" : "Tạm dừng"}</span></div><div className="flex rounded-md bg-muted p-1"><Button size="icon" variant={running ? "soft" : "ghost"} onClick={() => setRunning(true)} title="Chạy"><Play/></Button><Button size="icon" variant={!running ? "soft" : "ghost"} onClick={() => setRunning(false)} title="Tạm dừng"><Pause/></Button><Button size="icon" variant="ghost" onClick={reset} title="Đặt lại"><RotateCcw/></Button></div><select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-xs font-semibold">{[1,2,5,10,20].map(s => <option key={s} value={s}>Tốc độ {s}x</option>)}</select><span className="text-xs text-muted-foreground">14/09/2026 · <b className="text-foreground">{now}</b></span></div>
        <div className="relative overflow-hidden bg-warehouse-floor" style={{ aspectRatio: "16/9" }}>
          <WarehouseWorld {...{ agents, zoom, selected, setSelected, zoneState, truck, pallets }} busy={zoneState === "critical"} />

          <div className="absolute right-3 top-3 flex flex-col rounded-md border border-border bg-card shadow-panel"><button className="map-tool" onClick={() => setZoom((z: number) => Math.min(1.3, z + .1))}><ZoomIn/></button><button className="map-tool" onClick={() => setZoom((z: number) => Math.max(.75, z - .1))}><ZoomOut/></button><button className="map-tool" onClick={() => setZoom(1)}><RotateCcw/></button></div>
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-3 rounded-md border border-border bg-card/90 px-3 py-1.5 text-[10px] shadow-sm"><Legend color="bg-warning" label="Xe nâng"/><Legend color="bg-primary" label="Robot/AGV"/><Legend color="bg-success" label="Nhân viên"/><Legend color="bg-pallet" label="Pallet/Đơn hàng"/><span className="flex items-center gap-1"><i className="h-px w-6 border-t border-dashed border-primary"/>Luồng di chuyển</span></div>
        </div>
      </section>
      <AiPanel messages={aiMessages} critical={zoneState === "critical"} setModal={setModal} chat={chat} setChat={setChat} askAi={askAi}/>
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
      <TaskPanel tasks={tasks}/><EventPanel events={events}/>
    </div>
  </>;
}



function Legend({ color, label }: any) { return <span className="flex items-center gap-1"><i className={`size-2 rounded-full ${color}`}/>{label}</span>; }

function AiPanel({ messages, critical, setModal, chat, setChat, askAi }: any) { return <aside className="flex min-h-[490px] flex-col rounded-lg border border-border bg-card shadow-panel">
  <div className="flex h-12 items-center gap-2 border-b border-border px-3"><div className="grid size-7 place-items-center rounded-md bg-primary-soft text-primary"><Bot size={17}/></div><b className="text-sm">AI Copilot</b><span className="badge badge-success ml-auto"><span className="status-dot"/>Đang quan sát</span></div>
  <div className="flex-1 space-y-2 overflow-auto p-3">{messages.slice(-5).map((m: string, i: number) => <div key={`${m}-${i}`} className={`ai-message ${m.startsWith("Bạn:") ? "ai-user" : m.includes("CẢNH BÁO") ? "ai-critical" : ""}`}>{!m.startsWith("Bạn:") && <Bot/>}<p>{m}</p></div>)}
    {critical && <div className="rounded-md border border-destructive/25 bg-destructive-soft p-3"><div className="flex gap-2"><AlertTriangle className="text-destructive"/><div><b className="text-xs text-destructive">AI phát hiện Bottleneck</b><p className="mt-1 text-xs">Zone B · 92% công suất · 123 nhiệm vụ chờ · 46 đơn rủi ro SLA.</p></div></div><ul className="mt-2 space-y-1 text-[11px] text-muted-foreground"><li>• Điều chuyển P05, P06 → Zone B</li><li>• Tối ưu 27 tuyến Picking</li><li>• Bổ sung 120 SKU-102</li></ul></div>}
  </div>
  <div className="grid grid-cols-3 gap-1 border-t border-border p-2"><Button size="sm" className="col-span-3" onClick={() => setModal("whatif")}><Play/> Mô phỏng phương án</Button><Button size="sm" variant="success" onClick={() => setModal("approve")}>Phê duyệt</Button><Button size="sm" variant="outline" className="col-span-2">Từ chối</Button></div>
  <form onSubmit={askAi} className="flex gap-1 border-t border-border p-2"><input value={chat} onChange={e=>setChat(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md bg-muted px-3 text-xs outline-none" placeholder="Hỏi AI về tình trạng kho..."/><Button size="icon" type="submit"><Send/></Button></form>
  </aside>; }

function TaskPanel({ tasks }: {tasks: Task[]}) { return <section className="panel"><div className="panel-head"><span><PackageCheck/> Nhiệm vụ đang thực thi ({tasks.length})</span><button>Xem tất cả</button></div><div className="overflow-auto"><table><thead><tr><th>Mã nhiệm vụ</th><th>Loại</th><th>Agent</th><th>Lộ trình</th><th>Tiến độ</th><th>Trạng thái</th></tr></thead><tbody>{tasks.slice(0,6).map(t=><tr key={t.id}><td className="font-semibold text-primary">{t.id}</td><td>{t.type}</td><td>{t.agent}</td><td>{t.route}</td><td><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-primary transition-all" style={{width:`${t.progress}%`}}/></div><small>{Math.round(t.progress)}%</small></div></td><td><span className="badge badge-blue">{t.status}</span></td></tr>)}</tbody></table></div></section>; }
function EventPanel({ events }: {events: EventItem[]}) { return <section className="panel"><div className="panel-head"><span><Activity/> Dòng sự kiện vận hành</span><span className="badge badge-success"><span className="status-dot"/>Live</span></div><div className="max-h-64 overflow-auto p-2">{events.map((e,i)=><div key={`${e.time}-${i}`} className="event-row"><time>{e.time}</time><i className={`event-dot event-${e.tone}`}/><div><b>{e.type} · {e.object}</b><p>{e.detail}</p></div><small>{e.location}</small></div>)}</div></section>; }

function SupportingView({ view, inventory, setModal, onRunFlash }: any) {
  const titles: Record<string,[string,string]> = { orders:["Đơn hàng","Quản lý luồng nhập và xuất kho theo thời gian thực."], inventory:["Tồn kho","Theo dõi tồn khả dụng và rủi ro theo từng vị trí."], tasks:["Nhiệm vụ","Điều phối công việc đang thực hiện trong kho."], scenarios:["Kịch bản mô phỏng","Thử nghiệm tác động trước khi thay đổi vận hành thực."], analytics:["KPI & Phân tích","Hiệu suất vận hành và tác động can thiệp AI."], alerts:["Cảnh báo","Các bất thường cần ưu tiên xử lý."], reports:["Báo cáo","Tổng hợp vận hành kho ngày 14/09/2026."] };
  const [title, desc] = titles[view] ?? titles["orders"] ?? ["Vận hành kho", "Thông tin vận hành thời gian thực."];
  return <div><div className="mb-5 flex items-end justify-between"><div><h1 className="font-display text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{desc}</p></div>{view==="orders"&&<Button onClick={()=>setModal("outbound")}><Plus/>Tạo đơn xuất</Button>}</div>
    {view==="inventory" ? <InventoryTable items={inventory}/> : view==="scenarios" ? <ScenarioGrid run={onRunFlash}/> : view==="analytics" ? <Analytics/> : view==="orders" ? <Orders/> : <GenericPanel view={view}/>}</div>;
}

function InventoryTable({items}:any){return <section className="panel"><div className="panel-head"><span><Boxes/> Danh mục tồn kho</span><label className="flex items-center gap-2 rounded-md bg-muted px-2"><Search size={14}/><input className="h-8 bg-transparent text-xs outline-none" placeholder="Tìm SKU..."/></label></div><table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Vị trí</th><th>Khả dụng</th><th>Đã giữ</th><th>Đang nhập</th><th>Trạng thái</th></tr></thead><tbody>{items.map((r:any)=><tr key={r[0]}>{r.slice(0,6).map((v:any)=><td key={String(v)}>{v}</td>)}<td><span className={`badge ${r[6]==="Tốt"?"badge-success":"badge-warning"}`}>{r[6]}</span></td></tr>)}</tbody></table></section>}
function ScenarioGrid({run}:any){return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[["Flash Sale +50%","500 đơn / 15 phút",Zap],["Thiếu 2 nhân viên Picking","Công suất giảm 28%",Users],["Forklift FL02 ngừng hoạt động","Bảo trì đột xuất",Forklift],["SKU-558 hết hàng","Nhu cầu vượt dự báo",Archive],["Receiving tăng 200%","6 xe đến đồng thời",Truck],["Zone B bị giới hạn","Giảm 30% năng lực",AlertTriangle]].map(([a,b,I]:any)=><div className="scenario-card" key={a}><I/><h3>{a}</h3><p>{b}</p><Button variant="outline" size="sm" onClick={a.startsWith("Flash")?run:undefined}><Play/>Chạy mô phỏng</Button></div>)}</div>}
function Analytics(){return <div className="grid gap-3 lg:grid-cols-3"><div className="panel p-5 lg:col-span-2"><b>Thông lượng đơn hàng · 8 giờ gần nhất</b><div className="mt-8 flex h-56 items-end gap-3 border-b border-l border-border px-5">{[32,46,41,58,52,73,66,88,78,94,82,100].map((v,i)=><div key={i} className="flex-1 rounded-t bg-primary/80" style={{height:`${v}%`}}/>)}</div></div><div className="space-y-3">{[["SLA đúng hạn","96.5%"],["Picking trung bình","4.2 phút"],["AI intervention impact","+18%"],["Utilization","78%"]].map(x=><div className="metric-card" key={x[0]}><div><small className="text-muted-foreground">{x[0]}</small><strong className="block text-2xl">{x[1]}</strong></div></div>)}</div></div>}
function Orders(){return <section className="panel"><div className="panel-head"><span><ShoppingCart/> Đơn xuất hàng</span><div className="flex gap-1"><span className="badge badge-blue">Đơn xuất hàng</span><span className="badge badge-muted">Đơn nhập hàng</span></div></div><table><thead><tr><th>Mã đơn</th><th>Kênh</th><th>Số lượng</th><th>Trạng thái</th><th>Ưu tiên</th><th>SLA</th></tr></thead><tbody>{[["ORD-7849","Shopee","35 items","Đang Picking","Cao","1h 42m"],["ORD-7848","TikTok Shop","18 items","Đang Packing","Bình thường","54m"],["ORD-7847","Website","12 items","Chờ Picking","Bình thường","2h 11m"]].map(r=><tr key={r[0]}>{r.map((v,i)=><td key={v} className={i===0?"font-semibold text-primary":""}>{v}</td>)}</tr>)}</tbody></table></section>}
function GenericPanel({view}:any){return <div className="grid gap-3 md:grid-cols-3">{[1,2,3,4,5,6].map((n)=><div className="scenario-card" key={n}><div className="metric-icon">{view==="alerts"?<AlertTriangle/>:view==="reports"?<FileBarChart/>:<PackageCheck/>}</div><h3>{view==="alerts"?`Cảnh báo vận hành #0${n}`:view==="reports"?`Báo cáo ca ${n}`:`TASK-${3010+n}`}</h3><p>Zone {String.fromCharCode(64+(n%3)+1)} · cập nhật lúc 08:{20+n}</p><span className={`badge ${n===1?"badge-warning":"badge-blue"}`}>{n===1?"Cần xử lý":"Đang theo dõi"}</span></div>)}</div>}

function ModalView({modal,close,inbound,outbound,flash,next,apply}:any){
  if(modal==="whatif") return <div className="modal-wrap"><div className="modal-card max-w-4xl"><ModalHead title="AI What-if Simulation" sub="Thử nghiệm quyết định trước khi áp dụng vào kho thật." close={close}/><div className="scenario-branch"><span>Trạng thái kho hiện tại</span><b>→ NHÂN BẢN →</b><span>Mô phỏng song song</span><b>→ SO SÁNH KPI</b></div><div className="grid gap-3 p-4 md:grid-cols-2"><ScenarioCompare title="KỊCH BẢN HIỆN TẠI" tone="current" rows={[["Nhân sự","6 pickers"],["Hoàn thành đơn","5.2 giờ"],["SLA","92.3%"],["Đơn trễ","46"],["Picking","142 dòng/giờ"]]}/><ScenarioCompare title="AI TỐI ƯU" tone="ai" rows={[["Điều chuyển","P05, P06 → Zone B"],["Hoàn thành đơn","3.6 giờ · ↓31%"],["SLA","97.6% · ↑5.3%"],["Đơn trễ","12 · ↓74%"],["Picking","168 dòng/giờ · ↑18%"]]}/></div><div className="modal-actions"><Button variant="outline" onClick={close}>Quay lại</Button><Button onClick={()=>next("approve")}><Sparkles/>Áp dụng phương án AI</Button></div></div></div>;
  if(modal==="approve") return <div className="modal-wrap"><div className="modal-card max-w-lg"><ModalHead title="Phê duyệt đề xuất AI" sub="Xác nhận trước khi thay đổi vận hành kho." close={close}/><div className="p-5"><div className="rounded-md bg-primary-soft p-4 text-sm"><b>Bạn sắp áp dụng:</b><ul className="mt-3 space-y-2"><li>• Điều chuyển P05 và P06 → Zone B</li><li>• Tối ưu 27 tuyến Picking</li><li>• Bổ sung 120 SKU-102</li><li>• Ưu tiên 18 đơn gần SLA</li></ul></div></div><div className="modal-actions"><Button variant="outline" onClick={close}>Hủy</Button><Button variant="success" onClick={apply}><PackageCheck/>Phê duyệt & Thực thi</Button></div></div></div>;
  const config = modal==="inbound" ? {title:"Tạo phiếu nhập hàng",sub:"Xe và nhiệm vụ put-away sẽ xuất hiện trên mô phỏng.",submit:inbound,button:"Tạo phiếu nhập",fields:[["Mã lô","ASN-1025"],["Nhà cung cấp","Samsung Electronics"],["SKU","SKU-102"],["Tên sản phẩm","Tai nghe Bluetooth"],["Số lượng","200"],["Số pallet","4"],["Cửa nhận","Dock 02"],["Thời gian đến","08:45"]]} : modal==="outbound" ? {title:"Tạo đơn xuất kho",sub:"Hệ thống sẽ tự động tạo và phân công nhiệm vụ Picking.",submit:outbound,button:"Tạo đơn hàng",fields:[["Mã đơn","ORD-7849"],["Khách hàng","Shopee Fulfillment"],["SKU-102","20"],["SKU-331","5"],["SKU-558","10"],["Ưu tiên","Cao"],["SLA","2 giờ"],["Cửa xuất","Auto"]]} : {title:"Mô phỏng Flash Sale",sub:"Tạo tải cao để kiểm thử khả năng phản ứng của kho và AI.",submit:flash,button:"Bắt đầu sự kiện",fields:[["Số đơn phát sinh","500"],["Khoảng thời gian","15 phút"],["Traffic multiplier","3.5x"]]};
  return <div className="modal-wrap"><form className="modal-card max-w-xl" onSubmit={config.submit}><ModalHead title={config.title} sub={config.sub} close={close}/><div className="grid gap-3 p-5 sm:grid-cols-2">{config.fields.map((f:string[])=><label key={f[0]} className="field"><span>{f[0]}</span><input defaultValue={f[1]}/></label>)}</div><div className="modal-actions"><Button type="button" variant="outline" onClick={close}>Hủy</Button><Button type="submit" variant={modal==="flash"?"warning":"default"}>{modal==="flash"?<Zap/>:<PackagePlus/>}{config.button}</Button></div></form></div>;
}
function ModalHead({title,sub,close}:any){return <div className="flex items-start border-b border-border p-5"><div><h2 className="font-display text-lg font-bold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{sub}</p></div><Button size="icon" variant="ghost" className="ml-auto" onClick={close}><X/></Button></div>}
function ScenarioCompare({title,tone,rows}:any){return <div className={`comparison comparison-${tone}`}><div className="comparison-title">{tone==="ai"?<Bot/>:<Gauge/>}{title}</div>{rows.map((r:string[])=><div className="comparison-row" key={r[0]}><span>{r[0]}</span><b>{r[1]}</b></div>)}</div>}
function DetailDrawer({item,close,utilization,agents}:any){const a=agents.find((x:Agent)=>x.id===item); const rows = a ? [["Trạng thái","Đang làm việc"],["Nhiệm vụ",a.task],["Tiến độ",`${Math.round(a.progress)}%`],["Điểm đến",a.type==="picker"?"Packing 01":"Rack C02"],["Hiệu suất",a.type==="picker"?"94%":"31 nhiệm vụ hôm nay"]] : [["Công suất",item==="Zone B"?`${utilization}%`:"78%"],["Nhân sự hoạt động",item==="Zone B"?"P02, P04":"P01, P05"],["Nhiệm vụ","41"],["Hàng đợi","23"],["Thời gian Picking TB","7.4 phút"],["Rủi ro",item==="Zone B"&&utilization>85?"CAO":"THẤP"]]; return <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l border-border bg-card shadow-2xl"><div className="flex items-center border-b border-border p-5"><div className="metric-icon">{item.startsWith("P")?<UserRound/>:item.startsWith("FL")?<Forklift/>:<Warehouse/>}</div><div><h2 className="font-display font-bold">{a ? `${a.type==="picker"?"Picker":"Forklift"} ${item}` : item}</h2><p className="text-xs text-muted-foreground">Chi tiết hoạt động thời gian thực</p></div><Button size="icon" variant="ghost" className="ml-auto" onClick={close}><X/></Button></div><div className="space-y-3 p-5">{rows.map(([k,v]:any)=><div className="flex items-center justify-between border-b border-border py-3 text-sm" key={k}><span className="text-muted-foreground">{k}</span><b>{v}</b></div>)}</div></div>}