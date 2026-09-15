# Kế hoạch Hybrid Real-Time Temporal RAG

Tài liệu này chuyển đề xuất trong `../rag.txt` thành các pha có thể triển khai cho WareSim. Nguyên tắc bắt buộc: dữ liệu tồn hiện tại lấy từ Current State DB; lịch sử lấy từ Event Store; Vector RAG chỉ chứa SOP, hướng dẫn, mô tả và báo cáo bán tĩnh. Cảnh báo do rule engine xác định, AI chỉ giải thích và đề xuất.

## Pha 0 — Simulator làm nguồn sự kiện

Trạng thái: đã có bản frontend mẫu gồm rule alert, trung tâm phân tích cảnh báo, chatbot Hybrid RAG đọc Live State/Event History/kho tri thức phần mềm–dữ liệu–SOP và CSV snapshot. Event Store bền vững và backend realtime nằm ở các pha tiếp theo.

- Chuẩn hóa event append-only: `RECEIVE`, `PICK`, `MOVE`, `RESTOCK`, `TAKE`, `SALE`, `DAMAGE`, `EXPIRE`, `TASK_CANCELLED`.
- Mỗi event cần `event_id`, `occurred_at`, `simulation_time`, `store_id`, `actor_id`, `sku`, `lot_id`, `from_location`, `to_location`, `quantity`, `correlation_id`.
- Rule engine đồng bộ tạo cảnh báo tồn thấp, hết kệ, cận hạn và hết hạn.
- Xuất snapshot theo lô dưới dạng CSV để kiểm tra độc lập.

Điều kiện hoàn tất: replay cùng event cho ra cùng tồn; không có số âm; tổng hàng được bảo toàn; cảnh báo có mã luật và dữ liệu giải thích.

## Pha 1 — Live State và Event Store

- FastAPI nhận event qua WebSocket/HTTP; Redis Streams dùng làm event bus giai đoạn đầu.
- PostgreSQL giữ bảng append-only `inventory_events`; TimescaleDB chỉ thêm khi truy vấn chuỗi thời gian thực sự cần.
- Projector cập nhật `inventory_current`, `task_current`, `worker_current` và `alert_current`.
- WebSocket đẩy snapshot/delta về simulator. Mỗi consumer idempotent theo `event_id`.

Điều kiện hoàn tất: truy vấn SKU hiện tại không dùng vector search; mất kết nối rồi nhận lại event không cộng tồn hai lần; có thể lấy trạng thái tại một thời điểm bằng checkpoint + replay.

## Pha 2 — Query Router và công cụ cho Agent

- Phân loại intent: `CURRENT_STATE`, `HISTORY`, `TREND`, `SOP`, `ROOT_CAUSE`.
- Công cụ SQL chỉ đọc cho trạng thái hiện tại; truy vấn event theo khoảng thời gian cho lịch sử; tìm vector cho SOP.
- Root-cause kết hợp current state, sự kiện, bán hàng, nhiệm vụ bổ sung và trạng thái nhân viên.
- Mọi câu trả lời trả kèm thời điểm snapshot và nguồn dữ liệu đã dùng.

Điều kiện hoàn tất: bộ câu hỏi vàng xác nhận router không dùng RAG để trả số tồn hiện tại; câu trả lời lịch sử có đúng cửa sổ thời gian; câu trả lời SOP có trích nguồn.

## Pha 3 — Knowledge RAG và temporal analytics

- Ingest SOP/manual/report có version, `valid_from`, `valid_to`, cửa hàng áp dụng và checksum.
- Hybrid retrieval: metadata/time filter trước, semantic search sau.
- Thêm temporal graph khi có nhu cầu truy vết box/lot/worker qua nhiều địa điểm; chưa đưa mọi event vào graph.
- Tính sales velocity, thời gian dự kiến hết kệ, độ trễ restock và chênh lệch kiểm kê bằng pipeline xác định.

Điều kiện hoàn tất: không truy hồi SOP hết hiệu lực; truy vấn “lúc T ở đâu” đúng theo khoảng hiệu lực; chỉ số phân tích tái tạo được từ event.

## Pha 4 — AI giải thích và đề xuất

- AI nhận alert đã được rule engine tạo, giải thích nguyên nhân bằng dữ liệu live + lịch sử và đề xuất lượng bổ sung.
- Đề xuất tạo task ở trạng thái nháp; con người duyệt trước khi tác động vận hành.
- Ghi lại context, tool call, đề xuất, quyết định và kết quả để đánh giá.

Điều kiện hoàn tất: AI không tự sinh hoặc đóng cảnh báo; đề xuất luôn nêu tồn kệ, tồn kho, tốc độ bán và dữ liệu thời gian; mọi hành động có audit trail.

## Pha 5 — Vận hành và đánh giá

- Theo dõi event lag, projector lag, freshness của snapshot, tỷ lệ route đúng, groundedness và thời gian trả lời.
- Kiểm thử tải, reconnect, event trùng/thứ tự sai, schema migration và phục hồi từ checkpoint.
- Phân quyền theo cửa hàng, giới hạn công cụ SQL, che dữ liệu nhạy cảm và đặt retention.

Stack khởi đầu đề xuất: FastAPI + WebSocket, Redis Streams, PostgreSQL, pgvector cho SOP. Chỉ thêm Kafka, TimescaleDB hoặc graph database khi lưu lượng và truy vấn chứng minh cần thiết.
