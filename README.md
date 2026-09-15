# WareSim AI — Hybrid Real‑Time Warehouse & Retail Twin

WareSim mô phỏng kho dự trữ và cửa hàng bách hóa 3.000 SKU, quản lý 9.025 lô theo FEFO/HSD. Bản nâng cấp phục vụ AI Talent Bảng C bổ sung đơn đặt hàng cá nhân/doanh nghiệp và Auto Order, dashboard đánh giá AI, Dynamic Markdown & Food Rescue, What‑If Digital Twin, mạng 3 agent chuyên trách, RBAC, guardrail và audit trail có chuỗi hash.

Ứng dụng ưu tiên chạy độc lập: toàn bộ simulator, rule engine, RAG deterministic, dự báo nhẹ và What‑If chạy local trong trình duyệt. Groq chỉ là lớp diễn giải tùy chọn; thiếu API key hoặc mất mạng không làm hỏng chức năng cốt lõi.

## Chạy local

Yêu cầu Node.js 22 trở lên.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 3000
```

Mở <http://127.0.0.1:3000>. `GROQ_API_KEY` là tùy chọn; có thể xóa giá trị mẫu để dùng hoàn toàn offline.

## Kiểm tra

```powershell
npm run typecheck
npm run build
npm test
```

Hoặc chạy toàn bộ bằng `npm run verify`. Xem hướng dẫn chức năng chi tiết tại [SIMULATOR.md](./SIMULATOR.md).

## Deploy miễn phí

Bundle mặc định nhắm Cloudflare Workers và không cần database. Quy trình đầy đủ, secrets và kiểm tra sau deploy nằm trong [DEPLOYMENT.md](./DEPLOYMENT.md).

```powershell
npm run deploy:cloudflare
```

## Kiến trúc an toàn

- Live State trả số tồn hiện tại; Event History trả lịch sử; Knowledge RAG chỉ giữ SOP/hướng dẫn.
- Đơn đặt hàng dùng chung luồng giữ tồn FEFO/POS; Auto Order sinh nhu cầu theo phút mô phỏng và Quản lý có thể bật/tắt.
- Rule Engine quyết định cảnh báo. LLM không tự tạo cảnh báo hay tự tác động tồn kho.
- Input guardrail chạy trước Query Router và chạy lại tại server Groq.
- RBAC tách Nhân viên sàn, Quản lý và Kiểm toán viên.
- Food Rescue/What‑If là khuyến nghị có Human‑in‑the‑loop; mọi quyết định được nối vào audit hash chain.
- API bridge ghi bị khóa mặc định và chỉ mở khi đặt `WARESIM_BRIDGE_TOKEN` phía server.
