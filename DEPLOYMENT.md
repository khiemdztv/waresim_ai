# Chạy local và deploy Cloudflare free-tier

## 1. Chuẩn bị local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 3000
```

Các biến môi trường đều là server-side, tuyệt đối không thêm tiền tố `VITE_`:

- `GROQ_API_KEY`: tùy chọn. Không có key thì chatbot dùng câu trả lời deterministic từ Live State/Rule Engine/Knowledge RAG.
- `GROQ_MODEL`: tùy chọn, mặc định `openai/gpt-oss-20b`.
- `WARESIM_BRIDGE_TOKEN`: tùy chọn. Không có token thì `POST /api/v1/bridge` trả `503 BRIDGE_DISABLED`; trang web và endpoint đọc vẫn chạy bình thường.

Kiểm tra trước khi đưa lên mạng:

```powershell
npm run verify
```

## 2. Deploy lên Cloudflare Workers

TanStack Start/Nitro đang build trực tiếp ra Cloudflare module tại `.output/server`; static assets nằm ở `.output/public`.

```powershell
npx wrangler login
npm run build
npx wrangler secret put GROQ_API_KEY --config .output/server/wrangler.json
npx wrangler secret put WARESIM_BRIDGE_TOKEN --config .output/server/wrangler.json
npx wrangler deploy --config .output/server/wrangler.json
```

Nếu không dùng Groq hoặc bridge ghi, bỏ qua secret tương ứng. Có thể deploy các lần sau bằng:

```powershell
npm run deploy:cloudflare
```

Secrets đã lưu trên Cloudflare không bị xóa khi build lại.

## 3. Smoke test sau deploy

Thay `<domain>` bằng URL Worker:

```powershell
Invoke-RestMethod https://<domain>/api/v1/health
Invoke-RestMethod https://<domain>/api/v1/bridge
```

Kết quả health phải có `ok: true`. `GET /api/v1/bridge` chỉ mô tả contract và không đổi dữ liệu.

Ví dụ kiểm tra event ERP/POS (chỉ khi đã đặt secret):

```powershell
$headers = @{ Authorization = "Bearer <WARESIM_BRIDGE_TOKEN>" }
$body = @{
  source = "POS"
  type = "SALE"
  sku = "SKU-0001"
  lotId = "SKU-0001-L01"
  quantity = 2
  occurredAt = (Get-Date).ToUniversalTime().ToString("o")
  correlationId = "pos-demo-0001"
  location = "ST-01"
} | ConvertTo-Json
Invoke-RestMethod https://<domain>/api/v1/bridge -Method Post -Headers $headers -ContentType "application/json" -Body $body
```

## 4. Giới hạn chủ đích của bản miễn phí

- Trạng thái mô phỏng sống trong từng tab trình duyệt và reset khi tải lại; cách này không tốn database và demo ổn định.
- Đơn đặt hàng và Auto Order cũng dùng state của phiên trình duyệt; muốn dùng chung giữa nhiều máy cần nối D1/Durable Objects ở giai đoạn pilot.
- API bridge hiện xác thực + chuẩn hóa contract nhưng không lưu event trên serverless instance. Khi chuyển sang pilot thật, nối endpoint với Cloudflare D1/Queues hoặc PostgreSQL/Redis projector.
- Realtime trong UI dùng reducer local. WebSocket dùng chung nhiều người cần Durable Objects hoặc một backend persistent; không bật giả lập WebSocket stateless để tránh mất sự kiện âm thầm.
- Audit hash chain chứng minh bản ghi không bị sửa trong phiên; audit pháp lý cần kho append-only phía server.
