import { mkdir, writeFile } from "node:fs/promises";
import { createCatalog, BASE_DATE, storageLabels } from "../src/lib/grocery-catalog.ts";

const products = createCatalog();
const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const headers = [
  "ngay_mo_phong",
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
];
const rows = products.flatMap((product) =>
  product.lots.map((lot) => [
    BASE_DATE,
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
  ]),
);
const csv = [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
const directory = new URL("../public/data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("grocery-store-3000.csv", directory), "\uFEFF" + csv, "utf8");
console.log(`Đã tạo CSV: ${products.length} SKU · ${rows.length} dòng lô hàng`);
