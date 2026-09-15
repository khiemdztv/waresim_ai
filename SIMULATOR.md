# WareSim — Cửa hàng bách hóa 3.000 SKU

Ứng dụng React, TypeScript và TanStack Start mô phỏng **kho dự trữ WH-01 và khu bán hàng ST-01 thuộc cùng một cửa hàng**. Hàng từ kho được đẩy ra quầy để bổ sung kệ.

## Chạy

```powershell
cd "D:\Documents\AI Talent\Building Blocks"
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

Mở http://127.0.0.1:3000. Dữ liệu trong bộ nhớ phiên; tải lại trang sẽ khởi tạo lại. Mô phỏng và khách mua tự động bắt đầu ngay, không cần bấm chạy. Nút **Xuất CSV** tải snapshot tồn theo từng lô để mở trực tiếp bằng Excel.

Trợ lý dùng Groq qua server function. Khóa đặt trong `.env.local` với tên `GROQ_API_KEY`; không dùng tiền tố `VITE_` để tránh đưa khóa xuống bundle trình duyệt. Model mặc định là `openai/gpt-oss-20b`, có thể đổi bằng `GROQ_MODEL`. Xem mẫu tại `.env.example`. Nếu Groq tạm lỗi, trợ lý trả lại kết quả deterministic từ Live State/Rule Engine/Knowledge RAG.

## Nâng cấp AI Talent Bảng C

- **Chỉ số & đánh giá:** golden set local đo routing, grounding/faithfulness proxy, hallucination proxy và P95 retrieval; KPI OOS/Food Rescue/vòng quay lấy từ Live State.
- **Dự báo nhẹ:** Dynamic Reorder Point dùng daily demand, lead time và safety stock 95%, chạy hoàn toàn trên trình duyệt.
- **Food Rescue:** T−24h Flash Sale 25%, T−8h Giờ vàng 50%, T−2h chuyển tặng Food Bank. Quản lý phải duyệt; có Human Override.
- **What‑If Digital Twin:** nhu cầu tăng, nhà cung cấp giao trễ hoặc sự cố chuỗi lạnh; kết quả không làm thay đổi tồn kho thật.
- **Multi-Agent:** Inventory Guardian, Logistics Dispatcher và Store Manager Copilot cùng đọc một snapshot để tránh mâu thuẫn số liệu.
- **RBAC & Audit:** chuyển vai trò ở thanh trên cùng; Staff/Manager/Auditor có quyền khác nhau. Quyết định được nối vào audit hash chain trong phiên.
- **AI Guardrail:** chặn prompt override, lấy secret, vượt quyền, giao dịch nguy hiểm và chuỗi lệnh phá hoại trước khi gọi Groq.
- **API Bridge:** `GET /api/v1/health`; contract ERP/POS/WMS tại `/api/v1/bridge`. POST khóa mặc định nếu thiếu `WARESIM_BRIDGE_TOKEN`.

Xem bảng đối chiếu đầy đủ tại `UPGRADE_IMPLEMENTATION.md` và hướng dẫn free-tier tại `DEPLOYMENT.md`.

Nhật ký giữ 100 sự kiện gần nhất, danh sách quy trình giữ toàn bộ lệnh đang chạy và khoảng 60 lệnh đã kết thúc. Bộ đếm hàng đã nhập, đã bán, đã bổ sung và doanh thu vẫn cộng dồn cả phiên; số quy trình hoàn tất trên giao diện tính theo danh sách còn giữ.

## Bộ dữ liệu

Ngày đầu: **14/09/2026, 08:30**. Danh mục xác định, tạo lại cho cùng kết quả:

| Thành phần                                  | Số lượng |
| ------------------------------------------- | -------: |
| SKU riêng biệt (mặt hàng + quy cách + nhãn) |    3.000 |
| Nhóm hàng                                   |       21 |
| Lô hàng                                     |    9.025 |
| Đơn vị tại kho dự trữ                       |   59.253 |
| Đơn vị trên kệ bán                          |   35.896 |
| Đơn vị hết hạn đã cách ly                   |       50 |
| Tổng hàng vật lý ban đầu, gồm cách ly       |   95.199 |

Một đơn vị tồn tương ứng **một quy cách bán**: chai, hộp, khay, túi, lốc hoặc thùng. Hàng tươi đóng túi/khay với khối lượng rõ ràng; chưa có bán cân lẻ. SKU-0001 đến SKU-3000 có tên, nhãn giả lập, quy cách, giá, nhà cung cấp, vùng bảo quản, vị trí, sức chứa kệ, ngưỡng bổ sung và nhiều lô.

21 nhóm: nước uống; nước ép; sữa; bia/giải khát; vệ sinh nhà; chăm sóc cá nhân; mẹ & bé; mì ăn liền; bánh kẹo; trà/cà phê; đồ hộp; gạo/bột; gia vị; giấy/đồ dùng; rau lá; củ quả/nấm; trái cây; đông lạnh; trứng/đậu hũ; thịt; cá/hải sản.

Nhóm hàng lấy cảm hứng từ [danh mục Bách Hóa Xanh](https://www.bachhoaxanh.com/). **Không sử dụng AI_TL hoặc dữ liệu nội bộ Bách Hóa Xanh.** Quy mô 3.000 SKU do người dùng chọn; số lượng, giá, nhãn, HSD, vòng đời và vùng nhiệt là giả định để vận hành mô hình, chưa hiệu chỉnh theo một cửa hàng thực tế cụ thể. Trường dailyDemand là tham số nhu cầu tham khảo của từng SKU, chưa dùng để dự báo doanh số.

Bản CSV độc lập có sẵn ở `public/data/grocery-store-3000.csv`, truy cập qua `/data/grocery-store-3000.csv`. Tạo lại bằng `npm run data:generate` (script dùng hỗ trợ TypeScript trực tiếp của Node 22.18+; máy hiện tại Node 25).

## Thao tác

- **Quản lý tồn kho:** tìm không dấu, theo SKU/nhãn/nhóm/khu kệ; lọc 21 nhóm, kho khô/mát/đông, sắp hết hạn, hết hạn hoặc cần bổ sung; phân trang 50 dòng.
- **Xem lô:** NSX, ngày nhập, HSD, tồn kho, tồn kệ, xe đẩy/chờ lên kệ, giữ chỗ, cách ly của từng lô.
- **Nhập lô mới:** tìm sản phẩm, chọn lượng và HSD. Đồ dùng giấy không áp dụng HSD. Với hàng có HSD, hạn nhập phải từ ngày mô phỏng đến ngày mô phỏng + vòng đời giả định; NSX suy ra từ HSD và vòng đời.
- **Bổ sung FEFO:** lấy lô còn hạn với ngày hết hạn gần nhất trước; cùng HSD ưu tiên ngày nhập cũ hơn. Hàng không HSD theo FIFO. Hàng chuyển qua kho → xe đẩy → chờ lên kệ → kệ bán, giữ nguyên mã lô.
- **Bán tại POS:** giữ hàng theo lô trên kệ khi khách chọn, trừ khi thanh toán, cộng số đã bán và doanh thu giả lập.
- **Đơn đặt hàng:** tiếp nhận khách cá nhân hoặc công ty/đơn vị, giữ tồn FEFO và liên kết mỗi đơn với tác vụ lấy hàng–quét mã–thanh toán. Trạng thái `chờ lấy hàng → đang xử lý → hoàn tất/hủy` cập nhật theo tác vụ; Quản lý mới có quyền tạo đơn.
- **Cách ly hỏng:** tách hàng khả dụng ở kho vào nhóm hỏng, không lấy hàng đã giữ chỗ.
- **Auto Order / khách mua tự động:** một lượt lựa chọn SKU mỗi phút mô phỏng, từ 7:00 đến trước 21:00. Đơn cá nhân lấy 1–3 đơn vị; định kỳ có đơn công ty/đơn vị 4–10 đơn vị. Quản lý có thể tạm dừng việc ghi nhận Auto Order; mô phỏng khách tại POS vẫn tiếp tục và tự tạo lệnh bổ sung khi tồn thấp. Đây là mô hình đơn giản, chưa tái hiện giỏ nhiều mặt hàng, khuyến mãi, thuế, đổi trả hay tối ưu đặt hàng nhà cung cấp.
- **Thời gian:** luôn chạy, có tốc độ 1×/2×/5×/60×. Nút **Qua ngày** chỉ khả dụng khi không còn quy trình đang chạy; chuyển 24 giờ, kiểm tra HSD rồi tiếp tục chạy. Không sinh doanh số cho khoảng thời gian bỏ qua.
- **Sơ đồ:** 13 cụm hàng khô và vùng lạnh trong kho; 21 cụm nhóm hàng ở sàn bán. Đây là sơ đồ tổng hợp theo nhóm, không phải 21 kệ vật lý chứa cả 3.000 SKU. Nhấp cụm để xem sản phẩm đại diện hoặc mở cả nhóm.
- **Cảnh báo live:** rule engine tạo cảnh báo đỏ/cam cho hết kệ, tồn thấp, cận hạn và hàng hết hạn. Badge đỏ trên từng cụm và dải cảnh báo trong sơ đồ cập nhật theo state; AI chỉ giải thích cảnh báo đã được luật xác định.
- **Trợ lý Groq + Hybrid RAG:** hỏi tự nhiên về chức năng phần mềm, mô hình dữ liệu, mã SKU/lô/đơn (`ORD-*`), khách hàng, Auto Order, kệ A1–C7, HSD, cảnh báo, tác vụ, lịch sử, doanh thu hoặc SOP nhập–bổ sung–bán–cách ly. Router truy xuất Live State/Event History/Knowledge RAG trước, sau đó Groq diễn giải trên context này. Giao diện giữ phần dữ liệu gốc trong mục **Dữ liệu RAG đã truy xuất** và ghi model, nguồn cùng thời điểm snapshot.
- **Trung tâm cảnh báo:** bấm biểu tượng tam giác đỏ trên thanh trên cùng hoặc dải đỏ trên bản đồ để xem từng luật, nguyên nhân, ảnh hưởng, bằng chứng Live State và đề xuất Hybrid RAG. Từ đây có thể tạo lệnh xử lý, xem lô/HSD, mở danh sách liên quan hoặc chuyển câu hỏi sang trợ lý.

## Quy tắc tồn và hạn dùng

HSD có hiệu lực **đến cuối ngày** ghi trên lô. Qua nửa đêm, hàng hết hạn tại kho, kệ, xe đẩy hoặc khu chờ đều chuyển sang cách ly. Các quy trình liên quan bị hủy; phần còn hạn của lệnh chuyển được hoàn về kho, giải phóng giữ chỗ. Không bán hoặc bổ sung hàng hết hạn.

Cảnh báo cận hạn: 1 ngày cho hàng tươi, 5 ngày cho sữa bảo quản mát, 30 ngày cho các nhóm còn lại có HSD. Có lô cận hạn và lô hết hạn cách ly từ đầu để thực hành xử lý.

Mỗi bước vận hành kéo dài 5 giây mô phỏng (rút ngắn để quan sát): nhập/POS 15 giây, bổ sung kệ 30 giây. Tăng tốc vẫn xử lý đúng thứ tự hoàn tất, lượt mua và nửa đêm.

Lượng mỗi lệnh là số nguyên 1–1.000. Giữ chỗ theo lô ngăn lấy trùng hàng. Sức chứa kệ tính cả lệnh đang bổ sung. Bất biến: **kho + kệ + xe + chờ + cách ly = tồn ban đầu + đã nhập − đã bán**.

Vùng nhiệt giả định: khô 15–30°C, mát 0–4°C, đông ≤ −18°C. Chưa mô phỏng cảm biến nhiệt hoặc hư hỏng do đứt chuỗi lạnh. Hoạt cảnh nhân viên/thiết bị và camera là minh họa SVG; không có vật lý 3D, WMS, POS hay camera thật.

## Kiểm tra và cấu trúc

```powershell
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Kiểm thử quy mô/độ nhất quán dữ liệu, FEFO nhiều lô, đặt chỗ đồng thời, sức chứa, HSD nhập, thanh toán, bảo toàn tồn, hủy lệnh qua nửa đêm, thời gian tăng tốc, khách tự động và giao diện desktop/mobile. Ảnh trong `test-results/`.

- `src/lib/grocery-catalog.ts`: danh mục, giả định, tạo 3.000 SKU và lô.
- `src/lib/grocery-simulation.ts`: FEFO, giữ chỗ, luồng hàng và thời gian.
- `src/lib/simulation.ts`: điểm xuất API tương thích cho giao diện.
- `src/components/operations-simulator.tsx`: màn hình và điều khiển.
- `src/components/grocery-inventory.tsx`: bộ lọc, tồn và bảng lô.
- `src/components/customer-orders.tsx`: đơn cá nhân/doanh nghiệp và điều khiển Auto Order.
- `src/components/simulator-scene.tsx`: sơ đồ nhóm hàng.
- `src/lib/operational-alerts.ts`: rule engine cảnh báo xác định.
- `src/lib/rag/query-router.ts`: định tuyến câu hỏi Live State/Event History/SOP.
- `src/components/chatbot.tsx`: giao diện trợ lý kho thời gian thực.
- `scripts/export-grocery-data.mjs`: tạo bản CSV độc lập.
