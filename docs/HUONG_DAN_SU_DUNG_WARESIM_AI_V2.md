# HƯỚNG DẪN SỬ DỤNG WARESIM AI

## Dành cho người quản lý vận hành và chuyên gia góp ý

Phiên bản 2.0 — cập nhật ngày 15/09/2026

Phạm vi: Digital Twin kho – cửa hàng, 3.000 SKU, 9.025 lô, FEFO/HSD, đơn hàng, Auto Order, Hybrid RAG, What‑If, Food Rescue, RBAC và Audit.

> Tài liệu này thay thế phiên bản 1.0 vốn mô tả ML service và Decision Center không còn khớp kiến trúc hiện tại. File gốc được giữ nguyên để đối chiếu.

Nguyên tắc vận hành: dữ liệu của phiên là nguồn sự thật; AI chỉ diễn giải hoặc khuyến nghị; con người phê duyệt hành động có tác động; kết quả phải kiểm chứng qua Live State, Event History và Audit.

---PAGE---

# 1. WareSim AI là gì?

WareSim AI là prototype Digital Twin mô phỏng đồng thời kho dự trữ WH‑01 và cửa hàng ST‑01. Hệ thống kết hợp quy tắc tồn kho xác định, truy xuất dữ liệu theo ngữ cảnh và LLM tùy chọn để hỗ trợ quyết định có bằng chứng.

| Thành phần | Quy mô/phạm vi |
| --- | --- |
| Danh mục | 3.000 SKU thuộc 21 nhóm hàng |
| Quản lý lô | 9.025 lô có ngày sản xuất, ngày nhận và HSD |
| Vùng bảo quản | Khô, mát và đông |
| Luồng nghiệp vụ | Nhập hàng, bổ sung kệ, bán/POS, cách ly |
| Tự động hóa | Khách mua nền và Auto Order trong giờ mở cửa |
| Hỗ trợ AI | Hybrid RAG, Dynamic Reorder, Food Rescue, What‑If |
| Quản trị | RBAC, prompt guardrail, Human Override, audit hash chain |

## 1.1 Bài toán thực tiễn

- Hết hàng trên kệ dù kho dự trữ còn hàng.
- Khó ưu tiên đúng lô FEFO và xử lý hàng cận hạn.
- Đơn khách cá nhân và doanh nghiệp cùng cạnh tranh một lượng tồn.
- LLM có thể trả lời trôi khỏi số liệu hiện tại nếu không được grounding.
- Khuyến nghị AI thiếu bằng chứng, quyền hạn và dấu vết phê duyệt.

## 1.2 Kiến trúc vận hành

| Lớp | Vai trò | Nguồn sự thật |
| --- | --- | --- |
| Canonical simulator | FEFO, reservation, nhập/chuyển/bán, HSD, bất biến tồn | Live State theo SKU/lô |
| Rule Engine | Hết kệ, tồn thấp, cận hạn, hết hạn/cách ly | Luật xác định |
| Hybrid RAG | Truy xuất state, lịch sử, SOP rồi mới gọi Groq | Context đã truy xuất |
| Decision support | Dynamic Reorder, Food Rescue, What‑If, ba agent | Bản sao snapshot |
| Governance | RBAC, guardrail, human approval, audit | Chính sách và nhật ký |

![Tổng quan vận hành](assets/01-overview.png)

Hình 1 — Dashboard tổng quan lấy số liệu trực tiếp từ Live State.

> Giới hạn: đây là prototype dùng dữ liệu giả lập, chưa phải WMS/POS/ERP thật. Trạng thái hiện sống trong phiên trình duyệt và reset khi tải lại.

---PAGE---

# 2. Khởi động local và kiểm tra đầu phiên

## 2.1 Yêu cầu

- Node.js 22 trở lên.
- Trình duyệt Chrome, Edge hoặc Chromium hiện đại.
- Groq API key là tùy chọn; không có key thì RAG deterministic vẫn hoạt động.

## 2.2 Khởi động

    cd "D:\Documents\AI Talent\Building Blocks"
    npm install
    npm run dev -- --host 127.0.0.1 --port 3000

Mở http://127.0.0.1:3000. Không cần ML service, Python server hoặc database để sử dụng core simulator.

## 2.3 Checklist đầu phiên

1. Trang hiển thị 3.000 SKU, 9.025 lô và đồng hồ đang tăng.
2. Chọn vai trò trên thanh đầu trang: Nhân viên sàn, Quản lý hoặc Kiểm toán viên.
3. Mở Trung tâm cảnh báo và kiểm tra bằng chứng Live State.
4. Mở chatbot, hỏi “SKU‑0001 còn bao nhiêu?” và kiểm tra nhãn nguồn/snapshot.
5. Nếu có key, câu trả lời ghi GROQ openai/gpt‑oss‑20b; nếu lỗi sẽ ghi LOCAL FALLBACK cùng nguyên nhân.

## 2.4 Ma trận quyền hiện tại

| Vai trò | Xem dữ liệu | Tạo nghiệp vụ | Duyệt Food Rescue | Audit |
| --- | --- | --- | --- | --- |
| Nhân viên sàn | Có | Chỉ bổ sung theo quyền | Không | Không |
| Quản lý | Có, gồm tài chính | Nhập/chuyển/bán/đơn hàng | Có | Xem |
| Kiểm toán viên | Chỉ đọc theo policy | Không | Không | Xem và kiểm tra chuỗi |

> Bảo mật khóa: GROQ_API_KEY chỉ đặt trong .env.local hoặc Cloudflare secret, không dùng tiền tố VITE_ và không đưa vào Git.

---PAGE---

# 3. Mô phỏng không gian và quản lý tồn kho

## 3.1 Mô phỏng không gian

1. Chọn Kho hàng WH‑01 hoặc Cửa hàng ST‑01.
2. Đổi Phối cảnh/Mặt bằng; bật nhãn, luồng di chuyển và camera.
3. Nhấp kệ, nhân viên, thiết bị hoặc khu vực để xem chi tiết.
4. Tạo quy trình và quan sát tuyến chuyển động, mã tác vụ, SKU cùng bước đang thực hiện.
5. Dùng 1× để trình bày, 2×/5× để demo và 60× để kiểm thử nhanh.

![Hoạt ảnh quy trình](assets/02-simulation-action.png)

Hình 2 — Hoạt ảnh tác vụ gắn với trạng thái nghiệp vụ thay vì minh họa ngẫu nhiên.

## 3.2 Quản lý tồn kho và lô

- Tìm không dấu theo SKU, tên, nhãn; lọc nhóm, vùng nhiệt, tồn thấp, cận/hết hạn.
- Xem từng lô: NSX, ngày nhận, HSD, kho, kệ, backroom, transit, damaged và expired.
- Nhập hàng: kiểm tra HSD rồi tăng kho khi quy trình hoàn tất.
- Bổ sung: giữ lô FEFO, đi qua kho → transit → backroom → kệ.
- Bán: giữ tồn kệ khi tạo tác vụ; chỉ trừ hàng và cộng doanh thu khi thanh toán hoàn tất.
- Cách ly: loại hàng hỏng/hết hạn khỏi tồn khả dụng.

> Bất biến kiểm chứng: kho + kệ + transit + backroom + cách ly = tồn ban đầu + đã nhập − đã bán.

---PAGE---

# 4. Quy trình nghiệp vụ cơ bản

## 4.1 Nhập hàng vào kho

1. Chọn Nhập hàng mới hoặc Tạo quy trình.
2. Chọn SKU, số lượng và HSD nếu sản phẩm yêu cầu.
3. HSD phải từ ngày mô phỏng đến ngày mô phỏng cộng vòng đời giả định.
4. Theo dõi Tiếp nhận NCC → Kiểm tra lô & HSD → Cất đúng vùng nhiệt → Hoàn tất.
5. Tồn kho chỉ tăng khi quy trình hoàn tất.

## 4.2 Bổ sung từ kho lên kệ

1. Kiểm tra kho khả dụng, reservation và sức chứa còn lại của kệ.
2. Chọn Bổ sung/Chuyển hàng và nhập số lượng.
3. Hệ thống tự phân bổ lô theo FEFO; người dùng không chọn lô tùy ý.
4. Theo dõi Chọn lô → Lấy hàng → Kiểm tra → Transit → Backroom → Lên kệ.
5. Nếu lô hết hạn giữa quy trình, tác vụ bị hủy và phần còn hạn được hoàn về đúng vị trí.

## 4.3 Bán hàng/POS

1. Chọn Bán hoặc tạo đơn đặt hàng.
2. Hệ thống giữ tồn kệ theo lô ngay khi tạo tác vụ.
3. Theo dõi Khách chọn hàng → Quét mã → Thanh toán → Hoàn tất.
4. Chỉ khi thanh toán hoàn tất, tồn kệ giảm và doanh thu mô phỏng tăng.
5. Lượng vượt tồn khả dụng bị từ chối, không tạo tồn âm.

## 4.4 Cách ly

Hàng hỏng hoặc hết hạn được đưa khỏi tồn khả dụng vào khu cách ly. Quản lý phải kiểm đếm và xử lý theo SOP; không tự sửa số tồn để làm đẹp kết quả.

---PAGE---

# 5. Đơn hàng và Auto Order

## 5.1 Tạo đơn khách cá nhân/doanh nghiệp

1. Mở tab Đơn đặt hàng và chọn Tạo đơn mới.
2. Chọn khách cá nhân hoặc công ty/đơn vị.
3. Nhập tên khách hàng, SKU và số lượng.
4. Hệ thống kiểm tra tồn kệ khả dụng, giữ đúng lô FEFO và liên kết đơn với tác vụ POS.
5. Theo dõi Chờ lấy hàng → Đang xử lý → Hoàn tất/Hủy.

![Đơn đặt hàng](assets/03-orders.png)

Hình 3 — Đơn hàng cá nhân/doanh nghiệp dùng chung state và quy tắc FEFO với simulator.

## 5.2 Auto Order

Quản lý có quyền bật hoặc tạm dừng Auto Order. Trong giờ mở cửa 07:00–21:00, mô phỏng sinh một nhu cầu mỗi phút; đơn cá nhân thường 1–3 đơn vị và định kỳ có đơn công ty/đơn vị 4–10 đơn vị.

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Đặt lớn hơn tồn kệ khả dụng | Từ chối, không tạo tồn âm |
| Hai đơn cùng giữ một SKU | Reservation ngăn giữ trùng |
| Lô hết hạn giữa quy trình | Tác vụ và đơn liên kết bị hủy |
| Tắt Auto Order | Không ghi thêm đơn tự động |

> Hiểu đúng “Auto”: bản miễn phí tự chạy khi tab trình duyệt đang mở. Chạy 24/7 đa người dùng cần Cloudflare Cron và D1/Durable Objects hoặc backend persistent.

---PAGE---

# 6. Trung tâm cảnh báo và Hybrid RAG

## 6.1 Các luật cảnh báo

| Luật | Điều kiện | Hành động gợi ý |
| --- | --- | --- |
| OUT_OF_STOCK | Tồn kệ bằng 0 | Bổ sung FEFO hoặc nhập nếu kho hết |
| LOW_STOCK | Tồn kệ ≤ reorder point | Tính sức chứa và kho khả dụng |
| EXPIRY_NEAR | Lô vào cửa sổ HSD | Ưu tiên bán, markdown hoặc chuyển tặng |
| EXPIRED_QUARANTINE | Có hàng hết hạn cách ly | Kiểm đếm và xử lý theo SOP |

Mỗi cảnh báo trình bày phát hiện, nguyên nhân, ảnh hưởng, bằng chứng Live State và đề xuất có nguồn. AI chỉ giải thích cảnh báo đã được Rule Engine xác định.

## 6.2 Luồng Hybrid RAG

1. Guardrail kiểm tra prompt override, lấy secret, vượt quyền và giao dịch nguy hiểm.
2. Query Router xác định Live State, Event History, Rule Engine hoặc SOP cần truy xuất.
3. Hệ thống tạo câu trả lời deterministic và citations từ snapshot.
4. Nếu có Groq, LLM chỉ diễn giải context đã truy xuất; không tự sửa số liệu hoặc tác động tồn.
5. Nếu Groq lỗi/không có key, RAG local vẫn trả lời và ghi LOCAL FALLBACK.

![Hybrid RAG](assets/07-groq-rag.png)

Hình 4 — Câu trả lời hiển thị model, nguồn, snapshot và dữ liệu RAG gốc để đối chiếu.

---PAGE---

# 7. Metrics, Dynamic Reorder và Food Rescue

## 7.1 Dashboard đánh giá

- Golden set local đo routing accuracy.
- Grounding/faithfulness proxy kiểm tra số liệu có bám context.
- Hallucination proxy phát hiện mã/số liệu không có trong bằng chứng.
- P95 retrieval đo Query Router + retrieval local, không bao gồm mạng Groq.
- KPI OOS, cơ hội Food Rescue và vòng quay lấy từ Live State.

![Metrics](assets/04-metrics.png)

Hình 5 — Chỉ số có thể tái chạy từ cùng snapshot; mục tiêu pilot không được trình bày như kết quả đã đạt.

## 7.2 Dynamic Reorder Point

Mô hình nhẹ dùng daily demand, lead time và safety stock 95%. Kết quả phục vụ tham khảo trong prototype, không thay thế chính sách mua hàng thực.

## 7.3 Food Rescue

- T−24 giờ: đề xuất Flash Sale giảm 25%.
- T−8 giờ: đề xuất Giờ vàng giảm 50%.
- T−2 giờ: đề xuất đóng gói chuyển Food Bank.
- Kế hoạch chỉ là bản nháp; Quản lý duyệt hoặc Human Override.
- Mọi quyết định được ghi vào audit.

![Food Rescue](assets/05-food-rescue.png)

Hình 6 — Food Rescue dựa trên lô FEFO và thời gian còn lại.

---PAGE---

# 8. What‑If Digital Twin và ba agent

What‑If chạy trên bản sao Live State, tuyệt đối không thay đổi tồn thật của phiên.

## 8.1 Ba kịch bản

- Nhu cầu tăng: stress test sức phục vụ và nguy cơ OOS.
- Nhà cung cấp giao trễ: đánh giá thiếu nguồn bổ sung.
- Sự cố chuỗi lạnh: đánh giá lượng hàng rủi ro và phương án điều phối.

## 8.2 Ba agent chuyên trách

| Agent | Nhiệm vụ |
| --- | --- |
| Inventory Guardian | Xác định SKU và lô có rủi ro |
| Logistics Dispatcher | Ưu tiên luồng bổ sung/điều phối |
| Store Manager Copilot | Tổng hợp tác động và lượng đặt dự phòng |

Các agent dùng cùng một snapshot để tránh mâu thuẫn số liệu.

![What-If](assets/06-what-if.png)

Hình 7 — Kết quả What‑If gồm tác động, ưu tiên và đề xuất của từng agent.

## 8.3 Cách sử dụng

1. Chọn loại kịch bản và mức độ.
2. Chạy mô phỏng.
3. Đọc baseline, SKU ảnh hưởng và đề xuất.
4. Kiểm tra giả định, không gọi kết quả sandbox là kết quả cửa hàng thật.
5. Nếu áp dụng thủ công, tạo tác vụ canonical và theo dõi audit riêng.

---PAGE---

# 9. RBAC, Guardrail và Audit

## 9.1 RBAC

Giao diện ẩn dữ liệu hoặc vô hiệu hóa nút theo vai trò, đồng thời handler kiểm tra quyền lần nữa trước khi thực thi. Không dựa chỉ vào việc ẩn nút.

## 9.2 AI Guardrail

Guardrail chạy trước Query Router và lặp lại phía server Groq để chặn:

- Yêu cầu ghi đè chỉ dẫn hệ thống.
- Yêu cầu lấy API key, secret, token hoặc mật khẩu.
- Yêu cầu vượt quyền/phê duyệt thay con người.
- Giao dịch nguy hiểm hoặc chuỗi lệnh phá hoại.

## 9.3 Audit hash chain

Mỗi bản ghi có sequence, previous hash và hash. Các quyết định Food Rescue, chạy What‑If, thao tác bị RBAC từ chối, tạo đơn và bật/tắt Auto Order đều có thể được ghi trong phiên.

> Audit hiện chứng minh bản ghi không bị sửa trong phiên; audit pháp lý cần kho append‑only phía server.

## 9.4 Quy trình phê duyệt an toàn

1. Xác nhận snapshot, SKU/lô và số liệu tồn.
2. Kiểm tra nguồn/citation và điều kiện kích hoạt luật.
3. So sánh baseline với What‑If; ghi rõ giới hạn.
4. Quản lý duyệt hoặc Human Override.
5. Theo dõi tác vụ canonical đến hoàn tất.
6. Đối chiếu Event History và Audit.

---PAGE---

# 10. Kiểm chứng và giới hạn

## 10.1 Bằng chứng kỹ thuật hiện tại

- 28/28 kiểm thử Playwright đạt.
- TypeScript typecheck đạt.
- Production build Cloudflare đạt.
- Groq server-side đã smoke test.
- Golden set local có thể tái chạy.

Phạm vi kiểm thử gồm quy mô dữ liệu, FEFO nhiều lô, reservation, sức chứa, HSD, thanh toán, bất biến tồn, nửa đêm, Auto Order, RBAC, guardrail, audit, Food Rescue, What‑If, RAG và giao diện desktop/mobile.

## 10.2 Những điều chưa được phép khẳng định

- Dữ liệu giả lập chưa chứng minh tác động kinh doanh thực.
- Golden set local chưa thay benchmark độc lập hoặc Ragas production.
- State theo tab chưa hỗ trợ persistence và đa người dùng.
- API bridge mới xác thực/chuẩn hóa contract, chưa có projector production.
- Audit trong RAM chưa phải audit pháp lý.
- What‑If và Dynamic Reorder chưa được hiệu chỉnh bằng dữ liệu cửa hàng thật.

## 10.3 Xử lý tình huống

| Hiện tượng | Cách xử lý |
| --- | --- |
| LOCAL FALLBACK | Kiểm tra GROQ_API_KEY phía server, mạng và thông báo lỗi |
| Không tạo được tác vụ | Kiểm tra vai trò, lượng khả dụng, reservation, sức chứa, HSD |
| Hoạt ảnh không chạy | Kiểm tra prefers-reduced-motion; dùng 1×/2× |
| Reload mất trạng thái | Đúng giới hạn prototype; cần persistence |
| Expected khác Actual | Kiểm tra snapshot, events và tác vụ phát sinh |

---PAGE---

# 11. Deploy miễn phí và demo 5 phút

## 11.1 Deploy Cloudflare Workers

    npm run build
    npx wrangler login
    npx wrangler secret put GROQ_API_KEY --config .output/server/wrangler.json
    npm run deploy:cloudflare

Không có Groq vẫn dùng được simulator, Rule Engine, RAG deterministic, metrics và What‑If. Health endpoint là /api/v1/health. API bridge ERP/POS/WMS khóa ghi mặc định nếu chưa đặt WARESIM_BRIDGE_TOKEN.

## 11.2 Kịch bản demo

| Thời lượng | Nội dung |
| --- | --- |
| 0:00–0:40 | Bài toán, 3.000 SKU/9.025 lô và snapshot dùng chung |
| 0:40–1:40 | Tạo bổ sung FEFO, quan sát hoạt ảnh và tiến độ |
| 1:40–2:25 | Tạo đơn doanh nghiệp, Auto Order và trạng thái POS |
| 2:25–3:15 | Mở cảnh báo, hỏi RAG và đối chiếu nguồn |
| 3:15–4:15 | Food Rescue, What‑If, ba agent, Human‑in‑the‑loop |
| 4:15–5:00 | Metrics, RBAC/audit, test, giới hạn và roadmap |

## 11.3 Checklist bàn giao

- Không còn tác vụ/đơn chờ xử lý mà chưa được giải thích.
- Ghi nhận lô cận hạn và hàng cách ly.
- Kiểm tra Auto Order đang bật hay tạm dừng.
- Xuất CSV/audit nếu cần giữ bằng chứng trước khi reset.
- Ghi nhận mọi lần LOCAL FALLBACK hoặc bridge unavailable.

---PAGE---

# 12. Phù hợp Bảng C và câu hỏi xin chuyên gia góp ý

Theo cổng thông tin chính thức, Bảng C tập trung thiết kế, xây dựng, đánh giá và triển khai hệ thống AI với dữ liệu, mô hình, chỉ số, bảo mật và đạo đức. Trọng tâm đánh giá gồm giá trị thực tiễn, phương pháp, nguồn gốc dữ liệu, mức độ làm chủ, kết quả thử nghiệm, khả năng kiểm chứng đầu ra và khả năng triển khai.

| Trọng tâm Bảng C | Minh chứng WareSim | Việc cần củng cố |
| --- | --- | --- |
| Giá trị thực tiễn | OOS, Food Rescue, đơn hàng, điều phối | Phỏng vấn người dùng/pilot |
| Dữ liệu và mô hình | 3.000 SKU/9.025 lô, giả định công khai | Hiệu chỉnh dữ liệu thật được phép |
| Chỉ số và kiểm chứng | Golden set, KPI Live State, 28 test | Benchmark độc lập và user study |
| Bảo mật và đạo đức | RBAC, guardrail, secret server-side, approval, audit | Threat model sâu hơn |
| Khả năng triển khai | Local-first, Cloudflare, health/API bridge | Persistence và multi-user |

## 12.1 Câu hỏi xin phản biện

1. Nên ưu tiên OOS, Food Rescue hay điều phối đơn làm use case pilot?
2. Digital Twin cần thêm biến hoặc độ chi tiết nào?
3. Benchmark/baseline nào phù hợp để đánh giá RAG và What‑If?
4. Dữ liệu thật tối thiểu bao nhiêu ngày và ở cấp SKU/lô nào?
5. Threat model và governance còn thiếu điểm nào?
6. Lộ trình ba tháng nên ưu tiên persistence, POS connector hay forecasting?

## 12.2 Kê khai công cụ

Ứng dụng dùng React, TypeScript, TanStack Start, Playwright, Cloudflare Workers và Groq API tùy chọn. Dữ liệu danh mục là dữ liệu giả lập lấy cảm hứng từ phân loại bách hóa công khai, không phải dữ liệu nội bộ doanh nghiệp.

Yêu cầu Bảng C: PDF dự án tối đa 20 trang; video thuyết trình tối đa 5 phút; video demo tối đa 5 phút; phải kê khai trung thực công cụ AI, dataset, API, thư viện, mã nguồn mở và phần tự xây dựng.

Nguồn thể lệ tham khảo:

- https://ai.tainangviet.vn/bang-thi/C
- https://ai.tainangviet.vn/ho-so

Truy cập ngày 15/09/2026. Tài liệu này dùng để xin góp ý chuyên gia, không thay thế mẫu hồ sơ chính thức của Ban Tổ chức.
