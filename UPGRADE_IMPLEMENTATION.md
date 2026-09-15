# Đối chiếu đề xuất nâng cấp AI Talent Bảng C

Tài liệu này ghi rõ phần nào đã được triển khai từ báo cáo `Bao_Cao_Danh_Gia_Va_Nang_Cap_AI_Talent_Bang_C.pdf`, cách kiểm chứng và giới hạn của bản free-tier.

| Đề xuất trong báo cáo                      | Hiện trạng triển khai                                                                                                                                         | Điểm kiểm chứng                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Metrics Dashboard                          | Đã có tab **Chỉ số & đánh giá**; chạy golden set trên snapshot, tính routing/grounding/hallucination proxy/P95 local và KPI OOS, Food Rescue, vòng quay phiên | `src/components/metrics-dashboard.tsx`, `src/lib/analytics.ts` |
| Demand Forecasting + Dynamic Reorder Point | Đã có mô hình nhẹ deterministic từ daily demand, lead time và safety stock 95%; không cần Python/model server                                                 | `demandForecast()`                                             |
| RBAC                                       | 3 vai trò Staff/Manager/Auditor; chặn thao tác tại handler, không chỉ ẩn nút                                                                                  | `src/lib/security.ts`                                          |
| Prompt Injection Defense                   | Quét ghi đè prompt, lấy secret, vượt quyền, giao dịch nguy hiểm và injection; chạy ở Query Router và lặp lại phía server Groq                                 | `inspectPrompt()`                                              |
| Immutable Audit Logging                    | Audit append-only trong phiên, sequence + previous hash + hash; có kiểm tra toàn chuỗi và màn hình riêng                                                      | `src/lib/audit-log.ts`                                         |
| Dynamic Markdown / Food Rescue             | Engine duyệt lô theo giờ còn lại: T−24h giảm 25%, T−8h giảm 50%, T−2h chuyển tặng; có Human Override và audit                                                 | `src/lib/food-rescue.ts`                                       |
| What‑If Digital Twin                       | 3 tình huống: nhu cầu tăng, NCC trễ, sự cố chuỗi lạnh; chạy trên bản sao state, không đổi tồn thật                                                            | `src/lib/scenario-simulator.ts`                                |
| Multi-Agent Collaboration                  | Kết quả What‑If được phân tích bởi Inventory Guardian, Logistics Dispatcher và Store Manager Copilot từ cùng snapshot                                         | `ScenarioLab`                                                  |
| API Bridge                                 | Có health endpoint và contract ERP/POS/WMS được Zod validate + Bearer secret; mặc định khóa ghi                                                               | `/api/v1/health`, `/api/v1/bridge`                             |
| Customer/Business Orders + Auto Order      | Có tab đơn hàng, giữ tồn FEFO, tác vụ POS liên kết, trạng thái tự cập nhật và bộ sinh đơn định kỳ có thể bật/tắt                                              | `customer-orders.tsx`, `grocery-simulation.ts`                 |
| Free deployment                            | Cloudflare-module build, không bắt buộc DB/LLM; script preview/deploy và runbook secrets/smoke test                                                           | `DEPLOYMENT.md`                                                |

## Minh bạch đo lường

- Chỉ số AI trên dashboard là kết quả của golden set local, không giả mạo kết quả Ragas/LLM production.
- P95 hiển thị thời gian Query Router + retrieval local, không bao gồm độ trễ mạng Groq; nhãn trên UI nói rõ điều này.
- Business KPI lấy từ Live State và quyết định Food Rescue trong phiên. Các mốc tác động 35–45% hoặc vòng quay 1,4× trong báo cáo là mục tiêu pilot, không hiển thị như kết quả đã đạt nếu chưa có dữ liệu thực.
- API bridge free-tier chỉ xác thực/chuẩn hóa event. Đồng bộ đa người dùng cần bổ sung projector persistent; xem `DEPLOYMENT.md`.
