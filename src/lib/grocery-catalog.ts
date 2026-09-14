/** Synthetic assortment: names, packs, prices and shelf lives are simulation assumptions. */
export type Storage = "ambient" | "chilled" | "frozen";
export type Lot = {
  id: string;
  receivedDate: string;
  manufacturedDate: string;
  expiryDate: string | null;
  warehouse: number;
  shelf: number;
  backroom: number;
  transit: number;
  damaged: number;
  expired: number;
};
export type Product = {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  brand: string;
  supplier: string;
  pack: string;
  unit: string;
  price: number;
  color: string;
  emoji: string;
  storage: Storage;
  shelfLifeDays: number | null;
  warningDays: number;
  shelfCapacity: number;
  reorderPoint: number;
  dailyDemand: number;
  displayBay: string;
  warehouseBay: string;
  lots: Lot[];
  warehouse: number;
  shelf: number;
  backroom: number;
  damaged: number;
  expired: number;
};
export const BASE_DATE = "2026-09-14";
export const CATALOG_SIZE = 3000;
export const storageLabels: Record<Storage, string> = {
  ambient: "Kho khô · 15–30°C",
  chilled: "Ngăn mát · 0–4°C",
  frozen: "Tủ đông · ≤ −18°C",
};
export const dateAfter = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const simDate = (time: number) => dateAfter(BASE_DATE, Math.floor(time / 86400));
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
export const validDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
type Group = {
  id: string;
  name: string;
  short: string;
  count: number;
  color: string;
  emoji: string;
  storage: Storage;
  days: number | null;
  price: number;
  unit: string;
  packs: string[];
  names: string[];
};
const group = (
  id: string,
  name: string,
  short: string,
  count: number,
  color: string,
  emoji: string,
  storage: Storage,
  days: number | null,
  price: number,
  unit: string,
  packs: string,
  names: string,
): Group => ({
  id,
  name,
  short,
  count,
  color,
  emoji,
  storage,
  days,
  price,
  unit,
  packs: packs.split("|"),
  names: names.split("|"),
});
export const departments: Group[] = [
  group(
    "water",
    "Nước uống & nước ngọt",
    "NƯỚC UỐNG",
    180,
    "#66a8af",
    "🥤",
    "ambient",
    270,
    9000,
    "chai",
    "330 ml|500 ml|1 lít|1,5 lít|2 lít",
    "Nước tinh khiết|Nước khoáng|Nước khoáng có ga|Nước soda|Nước ngọt cola|Nước ngọt cam|Nước ngọt chanh|Trà xanh|Trà đào|Trà chanh|Nước chanh muối|Nước tăng lực|Nước điện giải|Nước nha đam|Trà bí đao|Nước sâm",
  ),
  group(
    "juice",
    "Nước ép & đồ uống dinh dưỡng",
    "NƯỚC ÉP",
    140,
    "#e2ac58",
    "🧃",
    "ambient",
    180,
    18000,
    "hộp",
    "180 ml|250 ml|330 ml|500 ml|1 lít",
    "Nước ép cam|Nước ép táo|Nước ép ổi|Nước ép dứa|Nước ép xoài|Nước ép nho|Nước ép lựu|Nước ép đào|Nước ép cà rốt|Nước dừa|Nước yến|Nước trái cây hỗn hợp|Sữa bắp|Sữa đậu nành|Sữa hạt óc chó|Sữa hạnh nhân",
  ),
  group(
    "dairy",
    "Sữa & chế phẩm từ sữa",
    "SỮA & SỮA CHUA",
    280,
    "#89b9cf",
    "🥛",
    "chilled",
    21,
    19000,
    "hộp",
    "100 g|180 ml|220 ml|500 ml|1 lít",
    "Sữa tươi thanh trùng nguyên kem|Sữa tươi thanh trùng ít béo|Sữa tươi thanh trùng không đường|Sữa tươi thanh trùng ít đường|Sữa chua nguyên vị|Sữa chua dâu|Sữa chua việt quất|Sữa chua xoài|Sữa chua nha đam|Sữa chua không đường|Sữa chua Hy Lạp|Sữa chua uống|Sữa kefir|Phô mai tươi|Phô mai lát|Phô mai kem|Bơ lạt|Bơ mặn|Kem sữa nấu ăn|Kem sữa đánh bông",
  ),
  group(
    "beverage",
    "Bia & đồ uống giải khát",
    "GIẢI KHÁT",
    100,
    "#bdad66",
    "🍺",
    "ambient",
    270,
    17000,
    "lon",
    "250 ml|330 ml|500 ml|Lốc 6 × 330 ml|Thùng 24 × 330 ml",
    "Bia lager|Bia pilsner|Bia lúa mì|Bia đen|Bia không cồn|Bia ít cồn|Soda chanh|Soda gừng|Nước malt|Nước trái cây có ga",
  ),
  group(
    "cleaning",
    "Giặt giũ & vệ sinh nhà cửa",
    "CHĂM SÓC NHÀ",
    180,
    "#a7a1cb",
    "🧴",
    "ambient",
    730,
    35000,
    "chai",
    "400 ml|800 ml|1 lít|2 lít|Túi 2,5 lít",
    "Nước giặt hương hoa|Nước giặt dịu nhẹ|Nước giặt đồ màu|Nước giặt đồ trắng|Nước xả vải hương nắng|Nước xả vải hương hoa|Nước rửa chén chanh|Nước rửa chén trà xanh|Nước lau sàn|Nước lau kính|Nước tẩy nhà tắm|Nước vệ sinh bếp|Nước tẩy quần áo|Dung dịch khử mùi|Nước giặt em bé|Nước giặt đậm đặc",
  ),
  group(
    "personal",
    "Chăm sóc cá nhân",
    "CÁ NHÂN",
    230,
    "#cba7bd",
    "🪥",
    "ambient",
    730,
    29000,
    "tuýp/chai",
    "50 ml|100 ml|200 ml|400 ml|650 ml",
    "Dầu gội dưỡng ẩm|Dầu gội thảo mộc|Dầu gội bạc hà|Dầu gội giảm gàu|Dầu xả dưỡng tóc|Sữa tắm hương hoa|Sữa tắm trà xanh|Sữa tắm dịu nhẹ|Sữa rửa mặt|Kem đánh răng bạc hà|Kem đánh răng trà xanh|Kem đánh răng trẻ em|Nước súc miệng|Nước rửa tay|Gel rửa tay|Kem dưỡng da|Sữa dưỡng thể|Kem chống nắng|Dung dịch vệ sinh|Gel cạo râu",
  ),
  group(
    "baby",
    "Mẹ, bé & chăm sóc gia đình",
    "MẸ & BÉ",
    170,
    "#d6b28f",
    "🍼",
    "ambient",
    365,
    48000,
    "gói",
    "Gói nhỏ|Gói vừa|Gói lớn|Hộp gia đình|Túi tiết kiệm",
    "Tã dán sơ sinh|Tã dán cỡ S|Tã dán cỡ M|Tã dán cỡ L|Tã quần cỡ M|Tã quần cỡ L|Tã quần cỡ XL|Tã quần cỡ XXL|Khăn ướt em bé|Khăn khô em bé|Bông tẩy trang|Bông vệ sinh|Băng vệ sinh ban ngày|Băng vệ sinh ban đêm|Miếng lót hằng ngày|Miếng lót thấm sữa",
  ),
  group(
    "instant",
    "Mì, bún, phở & ăn liền",
    "MÌ & ĂN LIỀN",
    200,
    "#d8b05f",
    "🍜",
    "ambient",
    180,
    8500,
    "gói",
    "65 g|80 g|100 g|Lốc 5 gói|Thùng 24 gói",
    "Mì tôm chua cay|Mì bò hầm|Mì gà|Mì sườn|Mì xào hải sản|Mì xào bò|Mì rau nấm|Mì cay Hàn Quốc|Mì trộn tương đen|Mì trứng|Phở bò ăn liền|Phở gà ăn liền|Bún bò ăn liền|Hủ tiếu ăn liền|Miến gà|Cháo thịt bằm|Cháo nấm|Bánh đa cua|Nui ăn liền|Mì udon",
  ),
  group(
    "snacks",
    "Bánh, kẹo & đồ ăn vặt",
    "BÁNH KẸO",
    240,
    "#c39875",
    "🍪",
    "ambient",
    180,
    22000,
    "gói",
    "40 g|80 g|150 g|250 g|400 g",
    "Bánh quy bơ|Bánh quy sữa|Bánh quy yến mạch|Bánh quy sô cô la|Bánh cracker|Bánh gạo|Bánh xốp vani|Bánh xốp dâu|Bánh bông lan|Bánh trứng|Kẹo trái cây|Kẹo bạc hà|Kẹo sữa|Kẹo dẻo|Sô cô la sữa|Sô cô la đen|Snack khoai tây|Snack bắp|Hạt điều rang|Đậu phộng rang",
  ),
  group(
    "coffee",
    "Cà phê, trà & bột uống",
    "CÀ PHÊ & TRÀ",
    150,
    "#997a62",
    "☕",
    "ambient",
    365,
    38000,
    "hộp",
    "100 g|200 g|250 g|400 g|500 g",
    "Cà phê rang xay|Cà phê hòa tan đen|Cà phê sữa hòa tan|Cà phê hòa tan ít đường|Cà phê Arabica|Cà phê Robusta|Trà xanh túi lọc|Trà sen túi lọc|Trà lài túi lọc|Trà gừng|Trà hoa cúc|Trà ô long|Bột ca cao|Bột ngũ cốc|Bột đậu xanh",
  ),
  group(
    "canned",
    "Đồ hộp & thực phẩm chế biến",
    "ĐỒ HỘP",
    150,
    "#91a17c",
    "🥫",
    "ambient",
    540,
    26000,
    "hộp",
    "100 g|150 g|200 g|300 g|500 g",
    "Cá ngừ ngâm dầu|Cá ngừ ngâm muối|Cá mòi sốt cà|Cá nục sốt cà|Pate gan heo|Pate nấm|Thịt heo hộp|Thịt bò hộp|Gà hầm hộp|Đậu trắng sốt cà|Đậu Hà Lan hộp|Bắp ngọt hộp|Nấm đóng hộp|Dứa đóng hộp|Đào đóng hộp",
  ),
  group(
    "grains",
    "Gạo, ngũ cốc & bột",
    "GẠO & BỘT",
    130,
    "#ccb98b",
    "🍚",
    "ambient",
    180,
    28000,
    "túi",
    "500 g|1 kg|2 kg|5 kg|10 kg",
    "Gạo thơm|Gạo dẻo|Gạo tấm|Gạo lứt|Gạo nếp|Gạo Japonica|Yến mạch cán|Đậu xanh|Đậu đen|Đậu đỏ|Đậu nành|Bột mì|Bột gạo|Bột nếp|Bột năng",
  ),
  group(
    "seasoning",
    "Dầu ăn & gia vị",
    "DẦU & GIA VỊ",
    220,
    "#b09a68",
    "🧂",
    "ambient",
    365,
    23000,
    "chai/gói",
    "100 g/ml|250 g/ml|500 g/ml|1 kg/lít|2 kg/lít",
    "Nước mắm truyền thống|Nước mắm ít muối|Nước tương đậu nành|Nước tương nấm|Dầu ăn thực vật|Dầu đậu nành|Dầu hướng dương|Dầu mè|Tương ớt|Tương cà|Dầu hào|Hạt nêm thịt|Hạt nêm nấm|Muối hạt|Muối i-ốt|Đường trắng|Đường vàng|Tiêu xay|Bột ngọt|Bột nghệ|Bột ớt|Giấm gạo",
  ),
  group(
    "paper",
    "Giấy & đồ dùng gia đình",
    "GIẤY & ĐỒ DÙNG",
    160,
    "#b2c1bb",
    "🧻",
    "ambient",
    null,
    29000,
    "gói/bộ",
    "Gói 2|Gói 4|Gói 6|Gói 10|Gói 12",
    "Giấy vệ sinh cuộn|Khăn giấy hộp|Khăn giấy rút|Khăn giấy bỏ túi|Giấy lau bếp|Túi rác cỡ nhỏ|Túi rác cỡ vừa|Túi rác cỡ lớn|Túi đựng thực phẩm|Giấy nến|Giấy bạc|Màng bọc thực phẩm|Miếng rửa chén|Găng tay gia dụng|Ly giấy|Ống hút giấy",
  ),
  group(
    "vegetables",
    "Rau lá & rau thơm",
    "RAU LÁ",
    65,
    "#79a367",
    "🥬",
    "chilled",
    3,
    15000,
    "túi",
    "200 g|300 g|500 g",
    "Cải thìa|Cải ngọt|Cải xanh|Cải bó xôi|Rau muống|Mồng tơi|Rau dền|Rau ngót|Xà lách|Bắp cải|Cải thảo|Tần ô|Rau má|Rau lang|Hành lá|Ngò rí|Húng quế|Tía tô|Diếp cá|Rau cần",
  ),
  group(
    "roots",
    "Củ, quả & nấm",
    "CỦ QUẢ & NẤM",
    55,
    "#ce9379",
    "🥕",
    "chilled",
    7,
    18000,
    "túi",
    "250 g|500 g|1 kg",
    "Cà rốt|Khoai tây|Khoai lang|Củ cải trắng|Củ dền|Cà chua|Dưa leo|Bí đỏ|Bí xanh|Bầu|Mướp|Cà tím|Đậu bắp|Đậu cô ve|Nấm kim châm|Nấm đùi gà|Nấm bào ngư|Ớt chuông|Bông cải xanh|Bông cải trắng",
  ),
  group(
    "fruit",
    "Trái cây",
    "TRÁI CÂY",
    130,
    "#ceae60",
    "🍎",
    "chilled",
    7,
    32000,
    "khay/túi",
    "300 g|500 g|1 kg|1,5 kg|2 kg",
    "Táo đỏ|Táo xanh|Cam sành|Cam vàng|Quýt|Bưởi da xanh|Ổi|Xoài cát|Xoài keo|Chuối|Thanh long|Dưa hấu|Dưa lưới|Đu đủ|Dứa|Nho xanh|Nho đỏ|Lê|Kiwi|Chanh dây",
  ),
  group(
    "frozen",
    "Thực phẩm đông lạnh",
    "ĐÔNG LẠNH",
    90,
    "#89b1ca",
    "🧊",
    "frozen",
    180,
    42000,
    "gói",
    "200 g|300 g|500 g|1 kg",
    "Tôm đông lạnh|Cá basa phi lê|Cá viên|Bò viên|Tôm viên|Chả giò|Há cảo|Xíu mại|Bánh bao|Khoai tây chiên|Đậu Hà Lan đông lạnh|Bắp ngọt đông lạnh|Rau củ hỗn hợp|Thịt gà đông lạnh|Mực đông lạnh",
  ),
  group(
    "eggs",
    "Trứng & đậu hũ",
    "TRỨNG & ĐẬU HŨ",
    30,
    "#d9c799",
    "🥚",
    "chilled",
    10,
    21000,
    "hộp",
    "Hộp nhỏ|Hộp vừa|Hộp gia đình",
    "Trứng gà|Trứng vịt|Trứng cút|Trứng gà ta|Trứng vịt muối|Đậu hũ trắng|Đậu hũ non|Đậu hũ trứng|Đậu hũ chiên|Đậu hũ rau củ",
  ),
  group(
    "meat",
    "Thịt heo, bò & gia cầm",
    "THỊT TƯƠI",
    50,
    "#cb9997",
    "🥩",
    "chilled",
    3,
    45000,
    "khay",
    "250 g|400 g|500 g|1 kg",
    "Ba rọi heo|Nạc vai heo|Nạc dăm heo|Thăn heo|Sườn non heo|Cốt lết heo|Thịt heo xay|Chân giò heo|Bắp bò|Thăn bò|Nạm bò|Thịt bò xay|Ức gà|Đùi gà|Cánh gà|Gà nguyên con|Xương heo|Gan heo|Thịt vịt|Chân gà",
  ),
  group(
    "seafood",
    "Cá & hải sản",
    "CÁ & HẢI SẢN",
    50,
    "#80aead",
    "🐟",
    "chilled",
    2,
    39000,
    "khay",
    "250 g|400 g|500 g|1 kg",
    "Cá rô phi|Cá diêu hồng|Cá lóc|Cá basa|Cá thu|Cá nục|Cá bạc má|Cá hồi phi lê|Cá ngừ|Tôm thẻ|Tôm sú|Mực ống|Mực lá|Bạch tuộc|Nghêu|Sò lụa|Hến|Cá chép|Cá trê|Cá đù",
  ),
];
export const lotUnits = (lot: Lot) =>
  lot.warehouse + lot.shelf + lot.backroom + lot.transit + lot.damaged + lot.expired;
export function syncProduct(product: Product): Product {
  return {
    ...product,
    warehouse: product.lots.reduce((n, l) => n + l.warehouse, 0),
    shelf: product.lots.reduce((n, l) => n + l.shelf, 0),
    backroom: product.lots.reduce((n, l) => n + l.backroom, 0),
    damaged: product.lots.reduce((n, l) => n + l.damaged + l.expired, 0),
    expired: product.lots.reduce((n, l) => n + l.expired, 0),
  };
}
export function createCatalog(): Product[] {
  let serial = 0;
  return departments.flatMap((g, gi) =>
    Array.from({ length: g.count }, (_, index) => {
      const i = serial++;
      const name = g.names[index % g.names.length]!;
      const sizeIndex = Math.floor(index / g.names.length) % g.packs.length;
      let packs = g.packs;
      let unit = g.unit;
      if (g.id === "dairy") {
        const solid = /Phô mai|Bơ |Sữa chua(?! uống)/.test(name);
        packs = solid
          ? ["100 g", "180 g", "220 g", "500 g", "1 kg"]
          : ["100 ml", "180 ml", "220 ml", "500 ml", "1 lít"];
      }
      if (g.id === "personal") {
        unit = /Kem|Gel/.test(name) ? "tuýp" : "chai";
        if (/Kem đánh răng/.test(name)) packs = ["50 g", "100 g", "150 g", "200 g", "250 g"];
      }
      if (g.id === "seasoning") {
        const liquid = /Nước|Dầu|Tương|Giấm/.test(name);
        unit = liquid ? "chai" : "gói";
        packs = liquid
          ? ["100 ml", "250 ml", "500 ml", "1 lít", "2 lít"]
          : ["100 g", "250 g", "500 g", "1 kg", "2 kg"];
      }
      if (g.id === "baby") {
        packs = /Tã/.test(name)
          ? ["24 miếng", "36 miếng", "48 miếng", "60 miếng", "72 miếng"]
          : /Khăn|Bông/.test(name)
            ? ["30 miếng", "60 miếng", "80 miếng", "100 miếng", "120 miếng"]
            : ["8 miếng", "12 miếng", "16 miếng", "24 miếng", "32 miếng"];
      }
      if (g.id === "eggs")
        packs = /Trứng/.test(name)
          ? name === "Trứng cút"
            ? ["10 quả", "20 quả", "30 quả"]
            : ["6 quả", "10 quả", "12 quả"]
          : ["200 g", "300 g", "500 g"];
      if (g.id === "paper") {
        unit = "gói";
        packs = /cuộn|lau bếp/.test(name)
          ? ["2 cuộn", "4 cuộn", "6 cuộn", "10 cuộn", "12 cuộn"]
          : /Giấy nến|Giấy bạc|Màng bọc/.test(name)
            ? ["Cuộn 5 m", "Cuộn 10 m", "Cuộn 20 m", "Cuộn 30 m", "Cuộn 50 m"]
            : /Găng tay/.test(name)
              ? ["1 đôi", "2 đôi", "3 đôi", "4 đôi", "5 đôi"]
              : ["10 cái", "20 cái", "30 cái", "50 cái", "100 cái"];
      }
      if (g.id === "fruit") unit = "túi";
      if (name === "Gà nguyên con") packs = ["1 kg", "1,2 kg", "1,5 kg", "2 kg"];
      const pack = packs[sizeIndex]!;
      if (pack.startsWith("Lốc")) unit = "lốc";
      if (pack.startsWith("Thùng")) unit = "thùng";
      if (pack.startsWith("Túi")) unit = "túi";
      const brand = (
        gi >= 14
          ? ["Nông sản Việt", "Trang trại An Lành", "Vườn Nhà"]
          : ["An Gia", "Lành Việt", "Mộc Nhiên"]
      )[Math.floor(index / (g.names.length * g.packs.length)) % 3]!;
      const id = `SKU-${String(i + 1).padStart(4, "0")}`;
      const fresh = gi >= 14 && gi !== 17;
      const fast = index % 5 === 0;
      const demand = fresh ? 3 + (i % 6) : fast ? 5 + (i % 4) : 1 + (i % 3);
      const shelf = fresh ? 5 + (i % 9) : fast ? 16 + (i % 9) : 5 + (i % 12);
      const warehouse = fresh ? 2 + (i % 6) : fast ? 28 + (i % 21) : 8 + (i % 20);
      const capacity = fresh ? 24 : fast ? 60 : 40;
      const shelfLife =
        g.id === "dairy" && /Phô mai|Bơ /.test(name)
          ? 90
          : g.id === "eggs" && /Đậu/.test(name)
            ? 5
            : g.days;
      const lots: Lot[] = [0, 1, 2].map((n) => {
        const near = i % 19 === 0;
        const remaining =
          shelfLife === null
            ? null
            : n === 0 && near
              ? fresh
                ? 0
                : 2
              : Math.max(1, Math.round(shelfLife * (0.3 + n * 0.23)));
        const expiry = remaining === null ? null : dateAfter(BASE_DATE, remaining);
        const manufactured = dateAfter(
          BASE_DATE,
          remaining === null ? -(30 + n * 10) : remaining - shelfLife!,
        );
        return {
          id: `${id}-L0${n + 1}`,
          manufacturedDate: manufactured,
          receivedDate: dateAfter(
            BASE_DATE,
            -Math.min(daysBetween(manufactured, BASE_DATE), 1 + n * 2),
          ),
          expiryDate: expiry,
          warehouse:
            n === 0
              ? Math.floor(warehouse * 0.2)
              : n === 1
                ? Math.floor(warehouse * 0.5)
                : warehouse - Math.floor(warehouse * 0.2) - Math.floor(warehouse * 0.5),
          shelf: n === 0 ? Math.ceil(shelf * 0.6) : n === 1 ? shelf - Math.ceil(shelf * 0.6) : 0,
          backroom: 0,
          transit: 0,
          damaged: 0,
          expired: 0,
        };
      });
      if (i % 113 === 0 && shelfLife !== null)
        lots.push({
          id: `${id}-QC`,
          manufacturedDate: dateAfter(BASE_DATE, -shelfLife - 1),
          receivedDate: dateAfter(BASE_DATE, -2),
          expiryDate: dateAfter(BASE_DATE, -1),
          warehouse: 0,
          shelf: 0,
          backroom: 0,
          transit: 0,
          damaged: 0,
          expired: 2,
        });
      const bay = `${String.fromCharCode(65 + Math.floor(gi / 7))}${(gi % 7) + 1}`;
      const priceScale = unit === "thùng" ? 20 : unit === "lốc" ? 4.5 : 1 + sizeIndex * 0.55;
      return syncProduct({
        id,
        name: `${name} ${pack}`,
        category: g.name,
        categoryId: g.id,
        brand,
        supplier: fresh ? "HTX Nông sản An Lành (mô phỏng)" : `NPP ${brand} (mô phỏng)`,
        pack,
        unit,
        price: Math.round((g.price * (priceScale + (i % 7) * 0.04)) / 500) * 500,
        color: g.color,
        emoji: g.emoji,
        storage: g.storage,
        shelfLifeDays: shelfLife,
        warningDays: fresh ? 1 : g.storage === "chilled" ? 5 : 30,
        shelfCapacity: capacity,
        reorderPoint: fresh ? 4 : fast ? 12 : 5,
        dailyDemand: demand,
        displayBay: bay,
        warehouseBay:
          g.storage === "frozen"
            ? "ĐÔNG-01"
            : g.storage === "chilled"
              ? `MÁT-${String((gi % 3) + 1).padStart(2, "0")}`
              : `KHÔ-${String(gi + 1).padStart(2, "0")}`,
        lots,
        warehouse: 0,
        shelf: 0,
        backroom: 0,
        damaged: 0,
        expired: 0,
      });
    }),
  );
}
