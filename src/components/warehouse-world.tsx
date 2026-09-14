import { useMemo, useRef, useState } from "react";

/* ==========================================================================
   WareSim AI · 2D top-down warehouse world (pure SVG vector sprites)
   World space: 1600 x 900 virtual px. Agents come in as % coords.
   ========================================================================== */

export const W = 1600;
export const H = 900;

type AgentLike = { id: string; type: "picker" | "forklift" | "agv"; x: number; y: number; tx: number; ty: number; task: string; progress: number };

const toX = (p: number) => (p / 100) * W;
const toY = (p: number) => (p / 100) * H;

/* ---------- static geometry ---------------------------------------------- */

const ZONES = [
  { id: "A", label: "ZONE A", x: 360, y: 70, w: 300, h: 350 },
  { id: "B", label: "ZONE B", x: 700, y: 70, w: 300, h: 350 },
  { id: "C", label: "ZONE C", x: 1040, y: 70, w: 300, h: 350 },
];

const RACKS = ZONES.flatMap((z) =>
  [0, 1, 2, 3].map((i) => ({
    id: `${z.id}0${i + 1}`,
    zone: z.id,
    x: z.x + 16,
    y: z.y + 34 + i * 78,
    w: z.w - 32,
    h: 40,
  })),
);

const PICK_FACES = [0, 1, 2, 3].map((i) => ({ id: `P-${i + 1}`, x: 90 + i * 84, y: 620, w: 56, h: 150 }));
const PACKING = [0, 1, 2].map((i) => ({ id: `PK0${i + 1}`, x: 540 + i * 150, y: 610, w: 120, h: 170 }));
const STAGING = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 1080 + (i % 3) * 62, y: 600 + Math.floor(i / 3) * 62 }));

/* ---------- sprites ------------------------------------------------------ */

function Boxes3({ x, y, w }: { x: number; y: number; w: number }) {
  const n = Math.max(3, Math.floor(w / 34));
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => (
        <rect key={i} x={x + 6 + i * 32} y={y + 7} width={24} height={26} rx={2} fill="#c98a52" stroke="#8d5a2b" strokeWidth={1.2} />
      ))}
    </g>
  );
}

function WarehouseRack({ rack, onClick, hot }: { rack: (typeof RACKS)[number]; onClick: () => void; hot?: boolean }) {
  return (
    <g className="cursor-pointer" onClick={onClick}>
      <rect x={rack.x + 3} y={rack.y + 5} width={rack.w} height={rack.h} rx={4} fill="#0f172a" opacity={0.14} />
      <rect x={rack.x} y={rack.y} width={rack.w} height={rack.h} rx={4} fill="#e2e8f0" stroke={hot ? "#dc2626" : "#1e293b"} strokeWidth={2.4} />
      <Boxes3 x={rack.x} y={rack.y} w={rack.w} />
      <text x={rack.x + 4} y={rack.y - 5} fontSize={13} fontWeight={700} fill="#64748b" letterSpacing={0.6}>{rack.id}</text>
    </g>
  );
}

function WarehousePallet({ x, y, id, onClick, scale = 1 }: { x: number; y: number; id: string; onClick?: () => void; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className={onClick ? "cursor-pointer" : ""} onClick={onClick}>
      <rect x={-22} y={-16} width={44} height={32} rx={3} fill="#b0803f" stroke="#7c5424" strokeWidth={1.5} />
      <path d="M-22 -6 H22 M-22 6 H22" stroke="#7c5424" strokeWidth={1.2} />
      <rect x={-17} y={-13} width={16} height={12} rx={1.5} fill="#d99a5b" stroke="#8d5a2b" />
      <rect x={2} y={-13} width={16} height={12} rx={1.5} fill="#d99a5b" stroke="#8d5a2b" />
      <rect x={-9} y={2} width={18} height={12} rx={1.5} fill="#e2ac72" stroke="#8d5a2b" />
      <title>{id}</title>
    </g>
  );
}

function WarehouseTruck({ x, y, dir = 1, label, tone = "#334155" }: { x: number; y: number; dir?: number; label?: string; tone?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1)`}>
      <rect x={-70} y={-30} width={96} height={60} rx={6} fill="#f1f5f9" stroke={tone} strokeWidth={2.5} />
      <path d="M-62 -18 H18 M-62 18 H18" stroke="#cbd5e1" strokeWidth={2} />
      <rect x={26} y={-26} width={40} height={52} rx={6} fill={tone} />
      <rect x={52} y={-16} width={14} height={32} rx={3} fill="#93c5fd" />
      <rect x={-64} y={-36} width={22} height={8} rx={3} fill="#1e293b" />
      <rect x={-64} y={28} width={22} height={8} rx={3} fill="#1e293b" />
      <rect x={30} y={-34} width={20} height={8} rx={3} fill="#1e293b" />
      <rect x={30} y={26} width={20} height={8} rx={3} fill="#1e293b" />
      {label && <text x={-60} y={5} fontSize={13} fontWeight={800} fill="#475569" transform={dir < 0 ? "scale(-1 1) translate(-0 0)" : undefined}>{label}</text>}
    </g>
  );
}

function WarehouseWorker({ a, selected, onClick }: { a: AgentLike; selected: boolean; onClick: () => void }) {
  const ang = (Math.atan2(a.ty - a.y, a.tx - a.x) * 180) / Math.PI;
  return (
    <g transform={`translate(${toX(a.x)} ${toY(a.y)}) scale(1.5)`} className="cursor-pointer" onClick={onClick}>
      {selected && <circle r={22} fill="#2563eb" opacity={0.13} />}
      <ellipse cy={10} rx={13} ry={5} fill="#0f172a" opacity={0.14} />
      <g transform={`rotate(${ang})`}>
        <path d="M10 0 L2 -5 L2 5 Z" fill="#f59e0b" opacity={0.9} />
      </g>
      <rect x={-9} y={-7} width={18} height={15} rx={5} fill="#1d4ed8" />
      <rect x={-9} y={-1} width={18} height={4.5} fill="#facc15" />
      <circle cy={-8} r={6.5} fill="#f6d5b8" stroke="#0f172a" strokeWidth={1.2} />
      <path d="M-6.5 -11 a6.5 6.5 0 0 1 13 0 Z" fill="#facc15" stroke="#0f172a" strokeWidth={1} />
      <text y={26} textAnchor="middle" fontSize={11} fontWeight={800} fill="#334155">{a.id}</text>
      <title>{`${a.id} · ${a.task} · ${Math.round(a.progress)}%`}</title>
    </g>
  );
}

function WarehouseForklift({ a, selected, onClick, carrying }: { a: AgentLike; selected: boolean; onClick: () => void; carrying?: boolean }) {
  const ang = (Math.atan2(a.ty - a.y, a.tx - a.x) * 180) / Math.PI;
  const agv = a.type === "agv";
  return (
    <g transform={`translate(${toX(a.x)} ${toY(a.y)}) scale(1.4)`} className="cursor-pointer" onClick={onClick}>
      {selected && <circle r={26} fill="#2563eb" opacity={0.13} />}
      <ellipse cy={12} rx={20} ry={7} fill="#0f172a" opacity={0.14} />
      <g transform={`rotate(${ang})`}>
        {agv ? (
          <>
            <rect x={-19} y={-14} width={38} height={28} rx={7} fill="#2563eb" stroke="#1e3a8a" strokeWidth={2} />
            <rect x={-11} y={-7} width={22} height={14} rx={3} fill="#bfdbfe" />
            <circle cx={14} r={3} fill="#facc15" />
          </>
        ) : (
          <>
            <rect x={-20} y={-13} width={30} height={26} rx={4} fill="#f59e0b" stroke="#b45309" strokeWidth={2} />
            <rect x={-15} y={-9} width={14} height={18} rx={2} fill="#fde68a" />
            <rect x={-22} y={-15} width={7} height={7} rx={2} fill="#1e293b" />
            <rect x={-22} y={8} width={7} height={7} rx={2} fill="#1e293b" />
            <path d="M10 -9 H26 M10 9 H26" stroke="#475569" strokeWidth={4} strokeLinecap="round" />
            {carrying && <rect x={12} y={-11} width={20} height={22} rx={2} fill="#c98a52" stroke="#8d5a2b" strokeWidth={1.4} />}
          </>
        )}
      </g>
      <text y={30} textAnchor="middle" fontSize={11} fontWeight={800} fill="#334155">{a.id}</text>
      <title>{`${a.id} · ${a.task} · ${Math.round(a.progress)}%`}</title>
    </g>
  );
}

function WarehousePackingStation({ s, onClick }: { s: (typeof PACKING)[number]; onClick: () => void }) {
  return (
    <g className="cursor-pointer" onClick={onClick}>
      <rect x={s.x + 3} y={s.y + 5} width={s.w} height={s.h} rx={6} fill="#0f172a" opacity={0.1} />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={6} fill="#f8fafc" stroke="#475569" strokeWidth={2.2} />
      <rect x={s.x + 10} y={s.y + 14} width={s.w - 20} height={62} rx={4} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.5} />
      <rect x={s.x + 18} y={s.y + 24} width={28} height={26} rx={2} fill="#c98a52" stroke="#8d5a2b" strokeWidth={1.2} />
      <rect x={s.x + 58} y={s.y + 30} width={22} height={20} rx={2} fill="#d99a5b" stroke="#8d5a2b" strokeWidth={1.2} />
      <rect x={s.x + 10} y={s.y + 96} width={s.w - 20} height={22} rx={3} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.2} />
      <path d={`M${s.x + 16} ${s.y + 107} H${s.x + s.w - 16}`} stroke="#94a3b8" strokeWidth={2} strokeDasharray="8 6" />
      <text x={s.x + s.w / 2} y={s.y + 140} textAnchor="middle" fontSize={13} fontWeight={800} fill="#475569">{s.id}</text>
    </g>
  );
}

function WarehousePath({ a }: { a: AgentLike }) {
  const x1 = toX(a.x), y1 = toY(a.y), x2 = toX(a.tx), y2 = toY(a.ty);
  const midY = y1 < 470 && y2 < 470 ? Math.min(y1, y2) : 480;
  const d = `M${x1} ${y1} L${x1} ${midY} L${x2} ${midY} L${x2} ${y2}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#2563eb" strokeWidth={3} strokeDasharray="12 10" strokeLinecap="round" opacity={0.85}>
        <animate attributeName="stroke-dashoffset" from="44" to="0" dur="1s" repeatCount="indefinite" />
      </path>
      <circle cx={x2} cy={y2} r={7} fill="none" stroke="#2563eb" strokeWidth={3} />
    </g>
  );
}

function FloorLabel({ x, y, children, size = 26 }: { x: number; y: number; children: string; size?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={800} letterSpacing={6} fill="#94a3b8" opacity={0.75}>{children}</text>
  );
}

/* ---------- world ------------------------------------------------------- */

export function WarehouseWorld({
  agents, zoneState, truck, pallets, selected, setSelected, zoom, busy,
}: {
  agents: AgentLike[];
  zoneState: "normal" | "warning" | "critical" | "recovering";
  truck: boolean;
  pallets: number;
  selected: string | null;
  setSelected: (v: string | null) => void;
  zoom: number;
  busy?: boolean;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const zoneTone = zoneState === "critical" ? "#dc2626" : zoneState === "warning" ? "#f59e0b" : zoneState === "recovering" ? "#f59e0b" : "#16a34a";
  const util = zoneState === "critical" ? 92 : zoneState === "warning" ? 84 : zoneState === "recovering" ? 78 : 71;
  const selectedAgent = useMemo(() => agents.find((a) => a.id === selected), [agents, selected]);
  const stagingCount = busy ? STAGING.length : 3;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="size-full touch-none select-none"
      aria-label="Mô phỏng kho 2D nhìn từ trên xuống"
      onPointerDown={(e) => { drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }}
      onPointerMove={(e) => { if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      <defs>
        <pattern id="concrete" width={40} height={40} patternUnits="userSpaceOnUse">
          <rect width={40} height={40} fill="#eef2f6" />
          <path d="M40 0 H0 V40" fill="none" stroke="#cbd5e1" strokeWidth={1} strokeOpacity={0.55} />
        </pattern>
        <linearGradient id="aisleG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#dfe6ee" />
          <stop offset="1" stopColor="#d5dee8" />
        </linearGradient>
      </defs>

      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} style={{ transformOrigin: "center", transition: drag.current ? undefined : "transform .25s ease" }}>
        {/* floor + shell */}
        <rect width={W} height={H} fill="url(#concrete)" />
        <rect x={8} y={8} width={W - 16} height={H - 16} fill="none" stroke="#94a3b8" strokeWidth={6} rx={10} />

        {/* main aisles */}
        <rect x={20} y={452} width={W - 40} height={62} fill="url(#aisleG)" />
        <path d={`M30 483 H${W - 30}`} stroke="#f8fafc" strokeWidth={3} strokeDasharray="26 22" />
        <rect x={330} y={60} width={26} height={400} fill="url(#aisleG)" />
        <rect x={670} y={60} width={26} height={400} fill="url(#aisleG)" />
        <rect x={1010} y={60} width={26} height={400} fill="url(#aisleG)" />
        <rect x={460} y={520} width={26} height={340} fill="url(#aisleG)" />
        <rect x={990} y={520} width={26} height={340} fill="url(#aisleG)" />

        {/* zone floor markings */}
        {ZONES.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y - 26} width={z.w} height={z.h + 34} rx={8} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="14 10" opacity={0.6} />
            <FloorLabel x={z.x + 6} y={z.y - 34}>{z.label}</FloorLabel>
          </g>
        ))}
        <FloorLabel x={44} y={54}>RECEIVING</FloorLabel>
        <FloorLabel x={60} y={588}>PICKING</FloorLabel>
        <FloorLabel x={540} y={588}>PACKING</FloorLabel>
        <FloorLabel x={1070} y={568}>SHIPPING</FloorLabel>

        {/* zone status overlay on the floor */}
        {zoneState !== "normal" && (
          <g>
            <rect x={700} y={44} width={300} height={380} rx={10} fill={zoneTone} opacity={zoneState === "critical" ? 0.14 : 0.1} />
            <rect x={700} y={44} width={300} height={380} rx={10} fill="none" stroke={zoneTone} strokeWidth={3} opacity={0.7}>
              {zoneState === "critical" && <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.6s" repeatCount="indefinite" />}
            </rect>
            <text x={850} y={36} textAnchor="middle" fontSize={17} fontWeight={800} fill={zoneTone}>
              {zoneState === "critical" ? `ZONE B ${util}% · BOTTLENECK` : `Zone B ${util}%`}
            </text>
          </g>
        )}

        {/* receiving docks */}
        {[0, 1].map((i) => (
          <g key={i} className="cursor-pointer" onClick={() => setSelected(`Dock 0${i + 1}`)}>
            <rect x={20} y={110 + i * 150} width={70} height={104} fill="#334155" opacity={0.14} />
            <rect x={20} y={110 + i * 150} width={70} height={104} fill="none" stroke="#334155" strokeWidth={3} strokeDasharray="10 8" />
            <text x={22} y={232 + i * 150} fontSize={13} fontWeight={800} fill="#475569">DOCK 0{i + 1}</text>
          </g>
        ))}

        {/* inbound truck */}
        {truck && (
          <g>
            <WarehouseTruck x={215} y={312} dir={1} label="ASN-1025" tone="#1d4ed8" />
            <text x={120} y={392} fontSize={13} fontWeight={700} fill="#1d4ed8">Đang dỡ hàng · Dock 02</text>
          </g>
        )}
        <WarehouseTruck x={215} y={162} dir={1} />

        {/* pallets staged in receiving */}
        {Array.from({ length: Math.min(pallets, 10) }).map((_, i) => (
          <WarehousePallet key={i} x={130 + (i % 5) * 52} y={380 + Math.floor(i / 5) * 46} id={`Pallet ${i + 1} · SKU-102`} onClick={() => setSelected(`Pallet ${i + 1}`)} />
        ))}

        {/* storage racks */}
        {RACKS.map((r) => <WarehouseRack key={r.id} rack={r} hot={zoneState === "critical" && r.zone === "B"} onClick={() => setSelected(`Rack ${r.id}`)} />)}

        {/* picking faces */}
        {PICK_FACES.map((f) => (
          <g key={f.id} className="cursor-pointer" onClick={() => setSelected("Picking")}>
            <rect x={f.x + 3} y={f.y + 5} width={f.w} height={f.h} rx={4} fill="#0f172a" opacity={0.12} />
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={4} fill="#e2e8f0" stroke="#1e293b" strokeWidth={2.2} />
            {[0, 1, 2, 3].map((i) => <rect key={i} x={f.x + 8} y={f.y + 10 + i * 36} width={f.w - 16} height={26} rx={2} fill="#c98a52" stroke="#8d5a2b" strokeWidth={1.2} />)}
          </g>
        ))}

        {/* packing stations */}
        {PACKING.map((s) => <WarehousePackingStation key={s.id} s={s} onClick={() => setSelected("Packing")} />)}

        {/* shipping staging + docks */}
        {STAGING.slice(0, stagingCount).map((p, i) => (
          <WarehousePallet key={i} x={p.x} y={p.y} id={`Kiện xuất ${i + 1}`} scale={0.95} onClick={() => setSelected("Shipping")} />
        ))}
        {[0, 1].map((i) => (
          <g key={i} className="cursor-pointer" onClick={() => setSelected(`Dock 0${i + 3}`)}>
            <rect x={W - 90} y={600 + i * 150} width={70} height={104} fill="#334155" opacity={0.14} />
            <rect x={W - 90} y={600 + i * 150} width={70} height={104} fill="none" stroke="#334155" strokeWidth={3} strokeDasharray="10 8" />
            <text x={W - 210} y={640 + i * 150} fontSize={14} fontWeight={800} fill="#475569">DOCK 0{i + 3}</text>
          </g>
        ))}
        <WarehouseTruck x={W - 135} y={652} dir={-1} tone="#0f766e" />
        <WarehouseTruck x={W - 135} y={802} dir={-1} />

        {/* active route for the selected agent */}
        {selectedAgent && <WarehousePath a={selectedAgent} />}

        {/* agents */}
        {agents.map((a) =>
          a.type === "picker"
            ? <WarehouseWorker key={a.id} a={a} selected={selected === a.id} onClick={() => setSelected(a.id)} />
            : <WarehouseForklift key={a.id} a={a} selected={selected === a.id} onClick={() => setSelected(a.id)} carrying={a.progress > 40 && a.progress < 90} />,
        )}

        {/* tiny picking progress indicators */}
        {agents.filter((a) => a.type === "picker" && Math.abs(a.tx - a.x) < 4 && Math.abs(a.ty - a.y) < 4).map((a) => (
          <g key={`pg-${a.id}`} transform={`translate(${toX(a.x) - 26} ${toY(a.y) - 34})`}>
            <rect width={52} height={20} rx={5} fill="#0f172a" opacity={0.82} />
            <rect x={5} y={12} width={42} height={4} rx={2} fill="#334155" />
            <rect x={5} y={12} width={(42 * Math.round(a.progress)) / 100} height={4} rx={2} fill="#22c55e" />
            <text x={26} y={9} textAnchor="middle" fontSize={9} fontWeight={700} fill="#f8fafc">Picking {Math.round(a.progress)}%</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
