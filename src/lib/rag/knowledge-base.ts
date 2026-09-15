export type KnowledgeType = "SOP" | "POLICY" | "GUIDE" | "DATA";

export interface KnowledgeDocument {
  id: string;
  title: string;
  type: KnowledgeType;
  tags: string[];
  content: string;
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

const documents: KnowledgeDocument[] = [
  {
    id: "guide_modules",
    title: "Các chức năng của WareSim",
    type: "GUIDE",
    tags: ["phan mem", "chuc nang", "tong quan", "module", "menu", "su dung"],
    content:
      "WareSim gồm Tổng quan, Mô phỏng không gian, Quản lý tồn kho, Đơn đặt hàng cá nhân/doanh nghiệp, Luồng hoạt động, Hệ thống camera, tìm kiếm SKU, trung tâm cảnh báo, trợ lý Hybrid RAG và xuất CSV. Kho dự trữ WH-01 và cửa hàng ST-01 dùng chung một trạng thái tồn theo lô.",
  },
  {
    id: "guide_simulation",
    title: "Mô phỏng thời gian và không gian",
    type: "GUIDE",
    tags: ["mo phong", "luon chay", "toc do", "camera", "khong gian", "reset", "ngay moi"],
    content:
      "Mô phỏng tự chạy liên tục, có các tốc độ 1×, 2×, 5× và 60×. Người dùng có thể chuyển kho/cửa hàng, đổi phối cảnh hoặc mặt bằng, bật nhãn, luồng di chuyển, camera, phóng to, sang ngày tiếp theo và khởi động lại dữ liệu phiên.",
  },
  {
    id: "data_catalog",
    title: "Dữ liệu danh mục và tồn kho",
    type: "DATA",
    tags: ["du lieu", "sku", "san pham", "lo", "cot", "truong", "danh muc", "ton kho"],
    content:
      "Mỗi SKU có tên, nhãn hàng, nhà cung cấp, quy cách, giá, nhóm, vùng bảo quản, sức chứa kệ, ngưỡng bổ sung, nhu cầu bán, vị trí kho và kệ. Mỗi lô có ngày sản xuất, ngày nhận, HSD và số lượng ở kho, kệ, backroom, transit, damaged, expired.",
  },
  {
    id: "data_realtime",
    title: "Kiến trúc dữ liệu thời gian thực",
    type: "DATA",
    tags: ["realtime", "thoi gian thuc", "live state", "event", "dong bo", "rag", "nguon"],
    content:
      "Số liệu hiện tại được truy vấn trực tiếp từ Live State của phiên tại lúc gửi câu hỏi. Lịch sử lấy từ Event History. Rule Engine quét lại cảnh báo từ cùng snapshot. Kho tri thức RAG chỉ lưu hướng dẫn, mô hình dữ liệu và SOP để tránh dùng tìm kiếm ngữ nghĩa cho số tồn hiện tại.",
  },
  {
    id: "sop_inbound",
    title: "SOP nhập hàng",
    type: "SOP",
    tags: ["nhap hang", "nha cung cap", "tiep nhan", "kiem tra lo", "putaway"],
    content:
      "Quy trình nhập hàng gồm tiếp nhận nhà cung cấp, kiểm tra lô và HSD, cất đúng vùng nhiệt rồi hoàn tất. HSD lô nhập không được trước ngày mô phỏng và không vượt quá vòng đời giả định của SKU. Tồn kho chỉ tăng khi quy trình hoàn tất.",
  },
  {
    id: "sop_restock",
    title: "SOP bổ sung kho lên kệ",
    type: "SOP",
    tags: ["bo sung", "restock", "chuyen hang", "kho len ke", "nguong", "suc chua"],
    content:
      "Khi tồn kệ bằng hoặc dưới reorderPoint, kiểm tra tồn khả dụng và sức chứa còn lại, giữ lô theo FEFO, lấy hàng từ kho, kiểm đếm, đẩy xe ra quầy, chờ lên kệ và xác nhận hoàn tất. Hệ thống không cho giữ chỗ vượt tồn hoặc vượt sức chứa.",
  },
  {
    id: "sop_sale",
    title: "SOP bán hàng tại POS",
    type: "SOP",
    tags: ["ban hang", "pos", "thanh toan", "khach mua", "doanh thu"],
    content:
      "Khách chọn hàng, quét mã tại POS, thanh toán rồi hoàn tất. Hệ thống giữ chỗ tồn kệ khi tạo lượt mua và chỉ trừ đúng lô FEFO, cộng doanh thu khi thanh toán hoàn thành. Khách mua tự động hoạt động trong khung 07:00–21:00.",
  },
  {
    id: "sop_customer_orders",
    title: "SOP đơn đặt hàng cá nhân và doanh nghiệp",
    type: "SOP",
    tags: [
      "don dat hang",
      "don hang",
      "khach hang",
      "doanh nghiep",
      "cong ty",
      "auto order",
      "tu dong dat hang",
    ],
    content:
      "Đơn đặt hàng hỗ trợ khách cá nhân và công ty/đơn vị. Khi xác nhận, hệ thống kiểm tra tồn khả dụng trên kệ, giữ đúng lô theo FEFO và tạo tác vụ lấy hàng, quét mã, thanh toán. Trạng thái đơn chuyển từ chờ lấy hàng sang đang xử lý rồi hoàn tất; đơn bị hủy nếu phần giữ lô không còn hợp lệ. Auto Order có thể tự sinh nhu cầu mỗi phút mô phỏng trong giờ mở cửa và Quản lý có quyền bật hoặc tạm dừng.",
  },
  {
    id: "policy_fefo",
    title: "Chính sách FEFO và hạn sử dụng",
    type: "POLICY",
    tags: ["fefo", "hsd", "han su dung", "can han", "het han", "lo"],
    content:
      "FEFO ưu tiên lô có HSD gần nhất; nếu cùng HSD thì ưu tiên ngày nhận cũ hơn. Lô quá ngày HSD bị tách khỏi tồn khả dụng, chuyển sang expired/cách ly và các tác vụ đang giữ lô không còn hợp lệ sẽ bị hủy.",
  },
  {
    id: "sop_damage",
    title: "SOP hàng hỏng và cách ly",
    type: "SOP",
    tags: ["hang hong", "damage", "cach ly", "kiem dem", "tieu huy"],
    content:
      "Hàng hỏng được lấy khỏi tồn khả dụng theo lô và đưa vào khu cách ly. Nhân viên kiểm đếm, đối soát nhật ký, xác định nguyên nhân và xử lý tiêu hủy hoặc hoàn nhà cung cấp theo quyết định quản lý.",
  },
  {
    id: "guide_alerts",
    title: "Rule Engine và trung tâm cảnh báo",
    type: "GUIDE",
    tags: ["canh bao", "thong bao do", "rule engine", "out of stock", "low stock", "xu ly"],
    content:
      "Rule Engine tạo bốn loại cảnh báo: hết hàng trên kệ, tồn kệ thấp, lô cận hạn và hàng hết hạn trong khu cách ly. Trung tâm cảnh báo hiển thị điều kiện kích hoạt, bằng chứng từ Live State, ảnh hưởng và đề xuất Hybrid RAG dựa trên SOP. Bấm biểu tượng tam giác đỏ hoặc dải cảnh báo trên bản đồ để mở.",
  },
  {
    id: "guide_csv",
    title: "Xuất và đọc dữ liệu CSV",
    type: "GUIDE",
    tags: ["csv", "xuat du lieu", "excel", "tai file", "snapshot"],
    content:
      "Nút Xuất CSV tạo snapshot theo từng lô tại thời điểm bấm. File có 9.025 dòng lô và các cột sản phẩm, vị trí, bảo quản, ngày lô, số lượng ở từng trạng thái, giữ chỗ, số đã bán và doanh thu phiên; có BOM UTF-8 để mở bằng Excel.",
  },
  {
    id: "guide_chat",
    title: "Cách dùng trợ lý Hybrid RAG",
    type: "GUIDE",
    tags: ["chatbot", "tro ly", "hoi", "rag", "cau hoi", "ai"],
    content:
      "Trợ lý nhận câu hỏi tiếng Việt về phần mềm, dữ liệu, SKU, tên hàng, nhóm, kệ, lô, HSD, cảnh báo, đơn đặt hàng, Auto Order, tác vụ, lịch sử, doanh thu và SOP. Câu trả lời ghi nguồn và thời điểm snapshot; có thể hỏi bằng mã SKU-0001, mã lô SKU-0001-L01 hoặc mã đơn ORD-1043.",
  },
  {
    id: "guide_metrics",
    title: "Dashboard đánh giá AI và KPI doanh nghiệp",
    type: "GUIDE",
    tags: ["metrics", "chi so", "danh gia", "faithfulness", "latency", "oos", "kpi"],
    content:
      "Tab Chỉ số & đánh giá chạy golden set local để đo routing accuracy, grounding/faithfulness proxy, hallucination proxy và P95 retrieval. KPI OOS, Food Rescue và vòng quay phiên được tính trực tiếp từ Live State; nhãn giao diện phân biệt số đo local với mục tiêu pilot.",
  },
  {
    id: "guide_food_rescue",
    title: "Dynamic Markdown và Food Rescue",
    type: "POLICY",
    tags: ["food rescue", "giam gia", "flash sale", "gio vang", "chuyen tang", "sdg 12"],
    content:
      "Food Rescue đọc lô FEFO và vận tốc bán: trong 24 giờ đề xuất giảm 25%, trong 8 giờ đề xuất giờ vàng giảm 50%, trong 2 giờ đề xuất đóng gói chuyển Food Bank. Đây là khuyến nghị nháp; chỉ Quản lý được duyệt, nhân viên có Human Override và mọi quyết định được ghi audit.",
  },
  {
    id: "guide_what_if",
    title: "What-If Digital Twin và ba agent chuyên trách",
    type: "GUIDE",
    tags: ["what if", "kich ban", "bao", "nha cung cap tre", "multi agent", "digital twin"],
    content:
      "What-If chạy trên bản sao Live State và không đổi tồn thật. Ba tình huống gồm nhu cầu tăng, nhà cung cấp giao trễ và sự cố chuỗi lạnh. Inventory Guardian tìm SKU rủi ro, Logistics Dispatcher ưu tiên luồng bổ sung, Store Manager Copilot tổng hợp lượng đặt dự phòng.",
  },
  {
    id: "policy_security",
    title: "RBAC, AI Guardrail và Audit Trail",
    type: "POLICY",
    tags: ["rbac", "bao mat", "guardrail", "prompt injection", "audit", "phan quyen"],
    content:
      "RBAC có Nhân viên sàn, Quản lý và Kiểm toán viên. Guardrail chặn ghi đè prompt, lấy secret, vượt quyền, giao dịch nguy hiểm và injection trước khi gọi LLM. Quyết định được nối vào audit hash chain append-only trong phiên.",
  },
];

class KnowledgeBase {
  search(query: string, limit = 3): KnowledgeDocument[] {
    const normalized = fold(query);
    const words = normalized.split(/[^a-z0-9]+/).filter((word) => word.length > 1);
    return documents
      .map((doc) => {
        const tags = doc.tags.map(fold);
        const haystack = fold(`${doc.title} ${doc.content} ${tags.join(" ")}`);
        const phraseScore = tags.reduce(
          (score, tag) => score + (tag.length > 2 && normalized.includes(tag) ? 8 : 0),
          0,
        );
        const wordScore = words.reduce(
          (score, word) => score + (haystack.includes(word) ? (word.length > 4 ? 2 : 1) : 0),
          0,
        );
        return { doc, score: phraseScore + wordScore };
      })
      .filter(({ score }) => score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ doc }) => doc);
  }

  getAll() {
    return documents;
  }
}

export const knowledgeBase = new KnowledgeBase();
