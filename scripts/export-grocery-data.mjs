import { mkdir, writeFile } from "node:fs/promises";
import {
  createCatalog,
  BASE_DATE,
  departments,
  storageLabels,
} from "../src/lib/grocery-catalog.ts";

const products = createCatalog();
const sum = (key) => products.reduce((n, p) => n + p[key], 0);
const data = {
  schemaVersion: 2,
  simulationDate: BASE_DATE,
  store: {
    id: "ST-01",
    warehouse: "WH-01",
    relationship: "Kho dự trữ và khu bán hàng trong cùng cửa hàng",
  },
  assumptions: [
    "Dữ liệu tổng hợp, không phải dữ liệu nội bộ Bách Hóa Xanh; không sử dụng AI_TL.",
    "3.000 SKU do người dùng chọn. Số lượng, nhãn, giá, HSD và nhiệt độ là giả định mô phỏng.",
    "Một đơn vị tồn là một quy cách bán. Hàng tươi đóng khay/túi theo khối lượng, chưa bán cân lẻ.",
    "Lô còn hạn đến cuối ngày HSD. Hàng hết hạn đã cách ly riêng.",
  ],
  categoryReference: "https://www.bachhoaxanh.com/",
  storageZones: storageLabels,
  totals: {
    skus: products.length,
    lots: products.reduce((n, p) => n + p.lots.length, 0),
    warehouse: sum("warehouse"),
    shelf: sum("shelf"),
    quarantine: sum("damaged"),
  },
  departments: departments.map(({ id, name, count, storage }) => ({ id, name, count, storage })),
  products,
};
const directory = new URL("../public/data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("grocery-store-3000.json", directory),
  JSON.stringify(data, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(data.totals, null, 2));
