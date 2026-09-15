import { memo, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { expiryInfo, stages, type Job, type Simulation, type Site } from "@/lib/simulation";

import { departments } from "@/lib/grocery-catalog";

export type SceneItem = {
  id: string;
  label: string;
  description: string;
  kind: "rack" | "worker" | "equipment" | "zone" | "camera";
  sku?: string;
};
type Props = {
  site: Site;
  state: Simulation;
  zoom: number;
  flat: boolean;
  labels: boolean;
  paths: boolean;
  cameras: boolean;
  selected: string | null;
  onSelect: (item: SceneItem) => void;
  readOnly?: boolean;
};
type Point = [number, number, number?];

function sceneJobSignature(state: Simulation, site: Site) {
  return state.jobs
    .filter(
      (job) =>
        !job.done &&
        (site === "warehouse"
          ? job.kind === "inbound" || (job.kind === "transfer" && job.stage < 4)
          : job.kind === "sale" || (job.kind === "transfer" && job.stage >= 4)),
    )
    .slice(0, 3)
    .map((job) => `${job.id}:${job.stage}`)
    .join("|");
}

function sameSceneProps(previous: Props, next: Props) {
  return (
    previous.site === next.site &&
    previous.zoom === next.zoom &&
    previous.flat === next.flat &&
    previous.labels === next.labels &&
    previous.paths === next.paths &&
    previous.cameras === next.cameras &&
    previous.selected === next.selected &&
    previous.readOnly === next.readOnly &&
    previous.onSelect === next.onSelect &&
    previous.state.products === next.state.products &&
    Math.floor(previous.state.time / 86400) === Math.floor(next.state.time / 86400) &&
    sceneJobSignature(previous.state, previous.site) === sceneJobSignature(next.state, next.site)
  );
}

export const SimulatorScene = memo(function SimulatorScene({
  site,
  state,
  zoom,
  flat,
  labels,
  paths,
  cameras,
  selected,
  onSelect,
  readOnly = false,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const retail = site === "store";
  const sceneTime = Math.floor(state.time / 86400) * 86400;
  const grouped = useMemo(
    () =>
      departments.map((g) => {
        const products = state.products.filter((p) => p.categoryId === g.id);
        return {
          group: g,
          products,
          warehouse: products.reduce((n, p) => n + p.warehouse, 0),
          shelf: products.reduce((n, p) => n + p.shelf, 0),
          storeAlerts: products.reduce(
            (count, product) =>
              count +
              Number(product.shelf <= product.reorderPoint) +
              Number(expiryInfo(product, sceneTime).nearUnits > 0),
            0,
          ),
          warehouseAlerts: products.reduce(
            (count, product) => count + Number(expiryInfo(product, sceneTime).nearUnits > 0),
            0,
          ),
        };
      }),
    [sceneTime, state.products],
  );
  const liveJob = state.jobs.find(
    (job) =>
      !job.done &&
      (retail
        ? job.kind === "sale" || (job.kind === "transfer" && job.stage >= 4)
        : job.kind === "inbound" || (job.kind === "transfer" && job.stage < 4)),
  );
  const project = ([x, y, z = 0]: Point) =>
    flat
      ? [125 + x * 1.05, 55 + y * 1.15 - z * 0.06]
      : [330 + x * 0.86 - y * 0.62, 105 + x * 0.34 + y * 0.45 - z];
  const pts = (points: Point[]) => points.map((p) => project(p).join(",")).join(" ");
  const poly = (points: Point[], fill: string, stroke = "none", strokeWidth = 1) => (
    <polygon
      points={pts(points)}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  );
  const line = (points: Point[], stroke: string, width = 1, dash?: string) => (
    <polyline
      points={pts(points)}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeDasharray={dash}
      strokeLinecap="round"
    />
  );
  const label = (
    text: string,
    x: number,
    y: number,
    z: number,
    size = 11,
    color = "#728881",
    bold = false,
  ) => {
    const [px, py] = project([x, y, z]);
    return (
      <text
        x={px}
        y={py}
        textAnchor="middle"
        fontSize={size}
        fontWeight={bold ? 700 : 500}
        fill={color}
        fontFamily="Manrope, sans-serif"
      >
        {text}
      </text>
    );
  };
  const box = (
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    top: string,
    front: string,
    side: string,
    z = 0,
  ) => (
    <g>
      {poly(
        [
          [x, y + d, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ],
        front,
      )}
      {poly(
        [
          [x + w, y, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x + w, y, z + h],
        ],
        side,
      )}
      {poly(
        [
          [x, y, z + h],
          [x + w, y, z + h],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ],
        top,
      )}
    </g>
  );
  const interactive = (item: SceneItem, children: ReactNode) => (
    <g
      key={item.id}
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      aria-label={item.label}
      className={`scene-object ${selected === item.id ? "scene-selected" : ""}`}
      onClick={readOnly ? undefined : () => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item);
        }
      }}
    >
      <title>{`${item.label} · ${item.description}`}</title>
      {children}
    </g>
  );
  const parcel = (x: number, y: number, z = 0, color = "#d9b488") => (
    <g>
      {box(x, y, 15, 13, 13, "#edcfaa", color, "#b58d61", z)}
      {line(
        [
          [x + 7, y, z + 13.4],
          [x + 7, y + 13, z + 13.4],
        ],
        "#f7e6c8",
        2,
      )}
    </g>
  );
  const person = (id: string, x: number, y: number, color: string, task: string, worker = true) => {
    const [px = 0, py = 0] = project([x, y]);
    const stride = 0;
    return interactive(
      { id, label: id, kind: "worker", description: task },
      <g transform={`translate(${px} ${py})`}>
        <g className="scene-person-motion" style={{ animationDelay: `${-(x % 10) / 10}s` }}>
          <ellipse cy={1} rx={10} ry={4} fill="#526b66" opacity=".13" />
          <path
            d={`M-3 -11 L${-4 - stride} -1 M3 -11 L${4 + stride} -1`}
            stroke="#354d55"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <path
            d="M-7 -22 L-10 -13 M7 -22 L10 -15"
            stroke="#d2aa86"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          <rect x={-6.5} y={-25} width={13} height={17} rx={4} fill={color} />
          {worker && (
            <path d="M-6 -16 H6 M-3 -24 V-10 M3 -24 V-10" stroke="#e5ef9b" strokeWidth={1.4} />
          )}
          <circle cy={-29} r={5} fill="#dfb896" />
          <path d="M-5 -31 Q0 -40 5 -31 Z" fill={worker ? "#f1bc54" : "#4b4844"} />
          {labels && (
            <>
              <rect x={-23} y={8} width={46} height={15} rx={4} fill="white" opacity=".95" />
              <text y={18} textAnchor="middle" fontSize={8} fill="#536660" fontWeight={700}>
                {id}
              </text>
            </>
          )}
        </g>
      </g>,
    );
  };
  const cart = (id: string, x: number, y: number) =>
    interactive(
      {
        id,
        label: id,
        kind: "equipment",
        description: retail ? "Xe đẩy mua sắm" : "Xe đẩy picking · vận chuyển hàng trong kho",
      },
      <g className="scene-cart-motion">
        {box(x, y, 21, 18, 5, "#a1b4b4", "#718b89", "#647e7e", 6)}
        {parcel(x + 2, y + 2, 11)}
        {line(
          [
            [x, y + 18, 10],
            [x, y + 18, 29],
            [x + 21, y + 18, 29],
            [x + 21, y + 18, 10],
          ],
          "#587974",
          2,
        )}
        {[0, 17].map((n) => {
          const [px, py] = project([x + n, y + 18, 3]);
          return <circle key={n} cx={px} cy={py} r={3} fill="#48635e" />;
        })}
      </g>,
    );
  const forklift = (id: string, x: number, y: number) =>
    interactive(
      { id, label: id, kind: "equipment", description: "Xe nâng · tiếp nhận và cất pallet vào kệ" },
      <g className={`scene-forklift-motion ${id.endsWith("02") ? "reverse" : ""}`}>
        {box(x, y, 32, 22, 15, "#e8b45e", "#c7923c", "#aa7731", 5)}
        {[2, 25].map((n) => {
          const [px, py] = project([x + n, y + 23, 5]);
          return (
            <circle
              key={n}
              cx={px}
              cy={py}
              r={5.5}
              fill="#384d4a"
              stroke="#87938b"
              strokeWidth={2}
            />
          );
        })}
        {box(x + 4, y + 3, 15, 17, 22, "#475f5d", "#728c87", "#526f69", 20)}
        {box(x + 6, y + 4, 12, 15, 16, "#bdd8d4", "#cae0d8", "#82aaa2", 24)}
        {line(
          [
            [x + 32, y, 0],
            [x + 32, y, 42],
            [x + 32, y + 22, 42],
            [x + 32, y + 22, 0],
          ],
          "#4b615d",
          3,
        )}
        {box(x + 32, y + 3, 23, 16, 2, "#758780", "#536b65", "#536b65", 3)}
        {parcel(x + 34, y + 4, 5)}
        {labels && label(id, x + 18, y + 40, 0, 8, "#748078", true)}
      </g>,
    );
  const rows = retail ? ["A", "B", "C"] : ["A", "B"];
  const rack = (row: string, ri: number, i: number) => {
    const x = 42 + i * 93,
      y = (retail ? 43 : 58) + ri * (retail ? 110 : 168),
      w = 66,
      d = retail ? 32 : 43,
      h = retail ? 49 : 72;
    const category = (retail ? grouped : grouped.filter((c) => c.group.storage === "ambient"))[
      ri * 7 + i
    ];
    if (!category) return null;
    const p = category.products[0]!;
    const alertCount = retail ? category.storeAlerts : category.warehouseAlerts;
    const id = `${retail ? "SHELF" : "RACK"}-${row}${i + 1}`;
    return interactive(
      {
        id,
        label: `${retail ? "Kệ cửa hàng" : "Kệ kho"} ${row}${i + 1}`,
        description: `${category.group.emoji} ${category.group.name} · ${category.products.length} SKU · ${retail ? category.shelf : category.warehouse} đơn vị ${retail ? "trên kệ" : "trong kho"} · ${alertCount} cảnh báo theo luật. Sơ đồ hiển thị cụm hàng; sản phẩm đại diện: ${p.name}.`,
        kind: "rack",
        sku: p.id,
      },
      <g>
        <polygon
          points={pts([
            [x + 7, y + d, 0],
            [x + w + 15, y + d, 0],
            [x + w + 17, y + d + 17, 0],
            [x + 7, y + d + 17, 0],
          ])}
          fill="#55766b"
          opacity=".08"
        />
        {selected === id &&
          poly(
            [
              [x - 6, y - 6],
              [x + w + 6, y - 6],
              [x + w + 6, y + d + 6],
              [x - 6, y + d + 6],
            ],
            "#b7e9ce",
            "#299970",
            2,
          )}
        {[4, h / 2, h - 3].map((z, level) => (
          <g key={z}>
            {box(x, y, w, d, 3, retail ? "#e4eae5" : "#d9e2df", "#889e97", "#738e85", z)}
            {Array.from({ length: retail ? 5 : 3 }, (_, col) => (
              <g key={col}>
                {retail
                  ? box(
                      x + 4 + col * 12,
                      y + 8,
                      8,
                      15,
                      level === 2 ? 10 : 14,
                      p.color,
                      p.color,
                      "#6e8b7e",
                      z + 3,
                    )
                  : parcel(x + 6 + col * 20, y + 15, z + 3)}
              </g>
            ))}
          </g>
        ))}
        {[
          [x, y],
          [x + w - 3, y],
          [x, y + d - 3],
          [x + w - 3, y + d - 3],
        ].map(([xx = 0, yy = 0], n) => (
          <g key={n}>{box(xx, yy, 3, 3, h + 14, "#658d81", "#497464", "#3c6558")}</g>
        ))}
        {box(
          x - 1,
          y + d - 1,
          w + 2,
          2,
          8,
          "#a6c8b9",
          retail ? "#6e9989" : "#4c806d",
          "#4c806d",
          h + 6,
        )}
        {label(`${row}${i + 1}`, x + w / 2, y + d + 1, h + 7, 9, "#ffffff", true)}
        {labels && label(category.group.short, x + w / 2, y + d + 20, 0, 7.5, "#526f60")}
        {labels && label(category.group.emoji, x + w / 2, y + d, h + 25, 17)}
        {alertCount > 0 && (
          <g className="scene-alert-badge">
            {(() => {
              const [cx = 0, cy = 0] = project([x + w + 8, y + 2, h + 23]);
              return (
                <>
                  <circle className="scene-alert-ring" cx={cx} cy={cy} r={13} />
                  <circle cx={cx} cy={cy} r={9} fill="#d94747" stroke="#fff" strokeWidth={2} />
                  <text
                    x={cx}
                    y={cy + 3}
                    textAnchor="middle"
                    fontSize={7}
                    fontWeight={800}
                    fill="#fff"
                  >
                    {alertCount > 99 ? "99+" : alertCount}
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </g>,
    );
  };
  const zone = (
    id: string,
    name: string,
    x: number,
    y: number,
    w: number,
    color: string,
    description: string,
    contents: ReactNode,
  ) =>
    interactive(
      { id, label: name, kind: "zone", description },
      <g>
        {poly(
          [
            [x, y],
            [x + w, y],
            [x + w, y + 64],
            [x, y + 64],
          ],
          color,
          "#b2c7bd",
          0.8,
        )}
        {line(
          [
            [x + 3, y + 3],
            [x + w - 3, y + 3],
            [x + w - 3, y + 61],
            [x + 3, y + 61],
            [x + 3, y + 3],
          ],
          "#ffffff",
          1.3,
          "4 3",
        )}
        {contents}
        {label(name, x + w / 2, y + 77, 0, retail ? 8 : 9, "#5c776c", true)}
      </g>,
    );
  const liveAction = (job: Job) => {
    const action =
      job.kind === "inbound"
        ? {
            start: [80, 408] as Point,
            end: [400, 188] as Point,
            label: job.stage < 2 ? "Kiểm tra lô nhập" : "Xe nâng đang cất hàng",
            icon: "IN",
          }
        : job.kind === "transfer" && !retail
          ? {
              start: [260, 210] as Point,
              end: [690, 405] as Point,
              label: job.stage < 2 ? "Picking lô FEFO" : "Đưa hàng ra cửa hàng",
              icon: "FEFO",
            }
          : job.kind === "transfer"
            ? {
                start: [65, 405] as Point,
                end: [355, 220] as Point,
                label: job.stage < 5 ? "Nhận xe bổ sung" : "Đang xếp hàng lên kệ",
                icon: "KỆ",
              }
            : {
                start: [250, 220] as Point,
                end: [565, 412] as Point,
                label: job.stage === 0 ? "Khách đang chọn hàng" : "Quét mã & thanh toán",
                icon: "POS",
              };
    const [startX = 0, startY = 0] = project(action.start);
    const [endX = 0, endY = 0] = project(action.end);
    const style = {
      "--scene-dx": `${endX - startX}px`,
      "--scene-dy": `${endY - startY}px`,
    } as CSSProperties;
    const moving =
      (job.kind === "inbound" && job.stage >= 2) ||
      (job.kind === "transfer" && (job.stage === 3 || job.stage >= 5)) ||
      (job.kind === "sale" && job.stage >= 1);

    return (
      <g className={`scene-live-action ${job.kind} stage-${job.stage}`} aria-hidden="true">
        <line className="scene-action-route" x1={startX} y1={startY} x2={endX} y2={endY} />
        <g transform={`translate(${startX} ${startY})`}>
          <g
            className={moving ? "scene-action-actor is-moving" : "scene-action-actor"}
            style={style}
          >
            <ellipse cy={7} rx={17} ry={5} fill="#244f3c" opacity=".16" />
            <rect x={-16} y={-17} width={32} height={22} rx={7} fill="#fff" stroke="#2d9b68" />
            <rect x={-12} y={-13} width={24} height={13} rx={4} fill="#dff5e8" />
            <text y={-4} textAnchor="middle" fontSize={7} fontWeight={800} fill="#267b53">
              {action.icon}
            </text>
            <circle cx={-10} cy={7} r={4} fill="#385b4d" />
            <circle cx={10} cy={7} r={4} fill="#385b4d" />
            <g className="scene-action-box">
              <rect x={-7} y={-28} width={14} height={11} rx={2} fill="#d2a56f" />
              <path d="M-7 -23 H7 M0 -28 V-17" stroke="#f5dfc1" strokeWidth="1" />
            </g>
          </g>
        </g>
        <g className="scene-action-label" transform={`translate(${startX + 5} ${startY - 50})`}>
          <rect x={-4} y={-15} width={142} height={31} rx={8} />
          <circle cx={8} cy={0} r={4} />
          <text x={18} y={-2}>
            {action.label}
          </text>
          <text className="scene-action-detail" x={18} y={9}>
            {job.id} · {job.sku} · {stages[job.kind][job.stage]}
          </text>
        </g>
      </g>
    );
  };
  return (
    <svg
      viewBox="0 0 1040 660"
      className="sim-scene-svg"
      aria-label={
        retail
          ? "Mô hình cửa hàng với 21 cụm nhóm hàng, khách hàng và quầy thanh toán"
          : "Mô hình kho với 13 cụm hàng khô và vùng lạnh, nhân viên, xe nâng và 5 khu xử lý"
      }
    >
      <defs>
        <pattern id={`${uid}-grid`} width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".7" fill="#cbd6cf" />
        </pattern>
        <filter id={`${uid}-shadow`} x="-20%" y="-30%" width="150%" height="170%">
          <feDropShadow dx="0" dy="16" stdDeviation="14" floodColor="#294e3b" floodOpacity=".09" />
        </filter>
      </defs>
      <rect width="1040" height="660" fill={`url(#${uid}-grid)`} opacity=".55" />
      <g transform={`translate(${520 * (1 - zoom)} ${330 * (1 - zoom)}) scale(${zoom})`}>
        <g filter={`url(#${uid}-shadow)`}>
          {box(0, 0, 750, 456, 9, "#eaf0e8", "#c9d6ca", "#bccfc2", -9)}
        </g>
        {Array.from({ length: 16 }, (_, i) => (
          <g key={i}>
            {line(
              [
                [i * 50, 0],
                [i * 50, 456],
              ],
              "#dce6dc",
              0.7,
            )}
            {i < 10 &&
              line(
                [
                  [0, i * 50],
                  [750, i * 50],
                ],
                "#dce6dc",
                0.7,
              )}
          </g>
        ))}
        {box(0, 0, 750, 5, 22, "#d5e2d7", "#c4d5c6", "#a9c1af")}
        {box(0, 0, 5, 456, 22, "#d5e2d7", "#c4d5c6", "#b4cbb9")}
        {labels &&
          label(
            retail ? "RETAIL STORE / CỬA HÀNG" : "WAREHOUSE / KHO HÀNG",
            375,
            -21,
            0,
            12,
            "#8ba196",
            true,
          )}
        {paths && (
          <g className="sim-path">
            {line(
              retail
                ? [
                    [24, 420],
                    [24, 110],
                    [714, 110],
                    [714, 332],
                    [510, 332],
                    [510, 393],
                  ]
                : [
                    [24, 383],
                    [24, 174],
                    [705, 174],
                    [705, 332],
                    [332, 332],
                    [332, 382],
                    [564, 382],
                  ],
              "#5da689",
              2,
              "6 7",
            )}
          </g>
        )}
        {cameras &&
          [100, 270, 440, 610].map((x, i) =>
            interactive(
              {
                id: `CAM-${retail ? "ST" : "WH"}-0${i + 1}`,
                label: `CAM-${retail ? "ST" : "WH"}-0${i + 1}`,
                kind: "camera",
                description: "Camera mô phỏng · vùng quan sát màu xanh",
              },
              <g>
                <polygon
                  points={pts([
                    [x, 5],
                    [x - 60, 155],
                    [x + 100, 155],
                  ])}
                  fill="#74c1b2"
                  opacity=".13"
                />
                {line(
                  [
                    [x, 5],
                    [x, 5, 84],
                  ],
                  "#94aaa0",
                  2,
                )}
                {box(x - 8, 2, 17, 10, 8, "#eef5ef", "#7e998c", "#456f62", 84)}
                {labels && label(`CAM-0${i + 1}`, x, 5, 106, 8, "#8a9e94")}
              </g>,
            ),
          )}
        {rows.map((row, ri) => (
          <g key={row}>
            {Array.from({ length: 7 }, (_, i) => rack(row, ri, i))}
            {retail ? (
              <>
                {Array.from({ length: ri === 2 ? 2 : 3 }, (_, i) =>
                  person(
                    `KH-0${ri * 3 + i + 1}`,
                    100 + i * 220,
                    113 + ri * 110,
                    ["#8195b3", "#b6a0ad", "#bcaa80"][i]!,
                    ["Chọn hàng", "Xem sản phẩm", "Trả lại sản phẩm lên kệ"][i]!,
                    false,
                  ),
                )}
                {ri < 2 && cart(`CART-ST-0${ri + 1}`, 305, 115 + ri * 110)}
              </>
            ) : ri === 0 ? (
              <>
                {forklift("FORKLIFT-01", 80, 167)}
                {person("NV-01", 310, 147, "#699886", "Lấy hàng tại kệ A3")}
                {person("NV-02", 565, 145, "#699886", "Cất hàng vào kệ A6")}
                {cart("CART-01", 335, 153)}
                {cart("CART-02", 600, 157)}
              </>
            ) : (
              <>
                {forklift("FORKLIFT-02", 390, 322)}
                {person("NV-03", 167, 310, "#679384", "Quét mã sản phẩm · SCANNER-03")}
                {person("NV-04", 420, 311, "#679384", "Kiểm đếm tồn kho")}
                {cart("CART-03", 202, 308)}
                {cart("CART-04", 640, 312)}
              </>
            )}
          </g>
        ))}
        {retail ? (
          <>
            {zone(
              "backroom",
              "CHỜ LÊN KỆ",
              22,
              373,
              87,
              "#dee7da",
              "Nhận xe đẩy từ kho dự trữ của cùng cửa hàng",
              <>
                {parcel(35, 387)}
                {parcel(57, 387)}
                {parcel(41, 407)}
              </>,
            )}
            {zone(
              "cold",
              "MÁT / ĐÔNG",
              121,
              373,
              87,
              "#dce9ed",
              "Ngăn mát 0–4°C và tủ đông ≤ −18°C, tách riêng theo sản phẩm",
              box(142, 382, 40, 35, 35, "#e5f0f0", "#99c1c5", "#7eaaaf"),
            )}
            {zone(
              "returns",
              "HÀNG TRẢ / HỎNG",
              220,
              373,
              87,
              "#efe4d6",
              "Khu tiếp nhận hàng lỗi và trả lại",
              <>
                {parcel(240, 393)}
                {label("!", 272, 399, 15, 17, "#bd884b", true)}
              </>,
            )}
            {zone(
              "restock",
              "BỔ SUNG KỆ",
              319,
              373,
              87,
              "#dce9d4",
              "NV-ST-03 nhận hàng và bổ sung theo SKU",
              cart("RESTOCK-CART", 337, 395),
            )}
            {[0, 1, 2].map((i) =>
              zone(
                `POS-0${i + 1}`,
                `POS-0${i + 1}`,
                431 + i * 102,
                373,
                89,
                "#e0e7df",
                `Quầy thanh toán ${i + 1} · máy quét và thanh toán`,
                <>
                  {box(444 + i * 102, 390, 58, 23, 24, "#f2f0df", "#aec1ad", "#8caa97")}
                  {box(474 + i * 102, 396, 15, 4, 15, "#476e5f", "#304c44", "#476e5f", 24)}
                </>,
              ),
            )}
            {person("NV-ST-01", 690, 234, "#689983", "Bổ sung kệ A4")}
            {person("NV-ST-02", 28, 332, "#689983", "Bổ sung hàng thực phẩm")}
            {person("NV-ST-03", 398, 407, "#689983", "Nhận hàng từ kho phụ")}
            {[0, 1, 2].map((i) =>
              person(
                `TN-0${i + 1}`,
                462 + i * 102,
                384,
                "#648d7c",
                "Thu ngân · quét mã và nhận thanh toán",
              ),
            )}
          </>
        ) : (
          <>
            {zone(
              "receiving",
              "TIẾP NHẬN",
              22,
              366,
              124,
              "#dce8df",
              "Receiving · NV-05 tiếp nhận và quét hàng",
              <>
                {parcel(38, 380)}
                {parcel(58, 380)}
                {parcel(78, 380)}
                {parcel(45, 400)}
                {parcel(66, 400)}
              </>,
            )}
            {zone(
              "picking",
              "LẤY HÀNG",
              159,
              366,
              124,
              "#e6e8d8",
              "FEFO · lấy lô hạn gần nhất để bổ sung kệ bán",
              <>
                {parcel(185, 390)}
                {parcel(207, 390)}
              </>,
            )}
            {zone(
              "packing",
              "ĐÓNG GÓI",
              296,
              366,
              124,
              "#e2e5db",
              "Packing · 2 máy in nhãn, 2 cân và NV-06",
              <>
                {box(317, 380, 63, 23, 23, "#d4dcca", "#9dab96", "#8c9f88")}
                {parcel(326, 385, 23)}
                {box(355, 385, 16, 13, 12, "#f2f3ed", "#94aaa0", "#768e84", 23)}
              </>,
            )}
            {zone(
              "staging",
              "MÁT 0–4° / ĐÔNG −18°",
              433,
              366,
              124,
              "#dce6d4",
              "Kho dự trữ lạnh: tách ngăn mát và đông; 8 nhóm hàng gồm sữa, rau lá, củ quả, trái cây, trứng, thịt, cá và thực phẩm đông lạnh",
              <>
                {box(446, 378, 43, 40, 38, "#dcebee", "#a7c5ce", "#81a9b8")}
                {box(498, 378, 43, 40, 38, "#e2e6f0", "#b0b9d4", "#8c9dbd")}
                {label("MÁT", 467, 420, 41, 8, "#41798c", true)}
                {label("ĐÔNG", 519, 420, 41, 8, "#606f9a", true)}
              </>,
            )}
            {zone(
              "quarantine",
              "CÁCH LY",
              570,
              366,
              145,
              "#f5dada",
              "Quarantine · DAMAGED-01, DAMAGED-02 · chờ kiểm tra",
              <>
                {parcel(602, 391)}
                {parcel(627, 391)}
                <g className="scene-alert-badge">{label("!", 665, 400, 10, 22, "#d33f3f", true)}</g>
              </>,
            )}
            {person("NV-05", 115, 402, "#679384", "Tiếp nhận và quét mã hàng · SCANNER-05")}
            {person("NV-06", 393, 403, "#679384", "Đóng gói, cân và in nhãn")}
            {[0, 1].map((i) =>
              interactive(
                {
                  id: `CONVEYOR-0${i + 1}`,
                  label: `Băng chuyền 0${i + 1}`,
                  kind: "equipment",
                  description: "Vận chuyển kiện hàng qua khu đóng gói",
                },
                <g>
                  {box(169 + i * 156, 443, 148, 15, 10, "#9caaa1", "#738a7c", "#587361")}
                  {Array.from({ length: 19 }, (_, n) => (
                    <g key={n}>
                      {line(
                        [
                          [172 + i * 156 + n * 7.5, 444, 11],
                          [172 + i * 156 + n * 7.5, 457, 11],
                        ],
                        "#d2dbcf",
                        1.5,
                      )}
                    </g>
                  ))}
                  <g className="scene-conveyor-parcel" style={{ animationDelay: `${-i * 1.5}s` }}>
                    {parcel(179 + i * 156, 445, 11)}
                  </g>
                </g>,
              ),
            )}
          </>
        )}
        {labels &&
          label(retail ? "↓ LỐI VÀO / LỐI RA ↑" : "NHẬP HÀNG →", 69, 470, 0, 9, "#789183", true)}
        {labels &&
          label(
            retail ? "CHECKOUT / THANH TOÁN" : "→ ĐẨY XE RA KỆ BÁN",
            608,
            470,
            0,
            9,
            "#789183",
            true,
          )}
        {liveJob && liveAction(liveJob)}
      </g>
    </svg>
  );
}, sameSceneProps);
