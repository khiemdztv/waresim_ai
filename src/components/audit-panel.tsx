import { CheckCircle2, FileCheck2, Link2, ShieldCheck } from "lucide-react";
import { verifyAuditChain, type AuditEntry } from "@/lib/audit-log";
import { clockLabel } from "@/lib/simulation";

export function AuditPanel({ entries }: { entries: readonly AuditEntry[] }) {
  const valid = verifyAuditChain(entries);
  return (
    <section className="audit-panel">
      <div className="audit-head">
        <span>
          <FileCheck2 size={25} />
        </span>
        <div>
          <span className="sim-eyebrow">IMMUTABLE AUDIT TRAIL</span>
          <h2>Nhật ký quyết định có chuỗi kiểm chứng</h2>
          <p>Mỗi bản ghi chứa hash của bản ghi trước; giao diện không có thao tác sửa hoặc xóa.</p>
        </div>
        <strong className={valid ? "valid" : "invalid"}>
          {valid ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
          {valid ? "Chuỗi hợp lệ" : "Chuỗi không hợp lệ"}
        </strong>
      </div>
      <div className="audit-chain-summary">
        <span>
          <b>{entries.length}</b> bản ghi append-only
        </span>
        <span>
          <Link2 size={14} /> Genesis → {entries.at(-1)?.hash ?? "chưa có hash"}
        </span>
      </div>
      <div className="sim-table-scroll">
        <table className="sim-table audit-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Thời điểm</th>
              <th>Vai trò</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th>Quyết định</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().map((entry) => (
              <tr key={entry.id}>
                <td>
                  <b>{entry.id}</b>
                </td>
                <td>{clockLabel(entry.simulationTime)}</td>
                <td>{entry.actorRole}</td>
                <td>
                  {entry.action}
                  <small className="sim-table-sku">{entry.detail}</small>
                </td>
                <td>{entry.target}</td>
                <td>
                  <span className={`audit-decision ${entry.decision.toLowerCase()}`}>
                    {entry.decision}
                  </span>
                </td>
                <td>
                  <code>{entry.hash}</code>
                  <small className="sim-table-sku">prev {entry.previousHash}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length === 0 && (
        <div className="sim-empty">
          <FileCheck2 />
          <b>Chưa có quyết định</b>
          <p>Tạo tác vụ, duyệt Food Rescue hoặc chạy What‑If để ghi audit.</p>
        </div>
      )}
    </section>
  );
}
