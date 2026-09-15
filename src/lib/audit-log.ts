import type { UserRole } from "./security";

export type AuditDecision = "CREATED" | "APPROVED" | "REJECTED" | "BLOCKED" | "VIEWED";

export type AuditEntry = Readonly<{
  id: string;
  sequence: number;
  simulationTime: number;
  actorRole: UserRole;
  action: string;
  target: string;
  decision: AuditDecision;
  detail: string;
  previousHash: string;
  hash: string;
}>;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function appendAuditEntry(
  entries: readonly AuditEntry[],
  input: Omit<AuditEntry, "id" | "sequence" | "previousHash" | "hash">,
): readonly AuditEntry[] {
  const sequence = (entries.at(-1)?.sequence ?? 0) + 1;
  const previousHash = entries.at(-1)?.hash ?? "GENESIS";
  const payload = [
    sequence,
    input.simulationTime,
    input.actorRole,
    input.action,
    input.target,
    input.decision,
    input.detail,
    previousHash,
  ].join("|");
  const hash = stableHash(payload);
  const entry = Object.freeze({
    ...input,
    id: `AUD-${String(sequence).padStart(5, "0")}`,
    sequence,
    previousHash,
    hash,
  });
  return Object.freeze([...entries, entry]);
}

export function verifyAuditChain(entries: readonly AuditEntry[]) {
  let previousHash = "GENESIS";
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!;
    const payload = [
      entry.sequence,
      entry.simulationTime,
      entry.actorRole,
      entry.action,
      entry.target,
      entry.decision,
      entry.detail,
      previousHash,
    ].join("|");
    if (
      entry.sequence !== index + 1 ||
      entry.previousHash !== previousHash ||
      entry.hash !== stableHash(payload)
    )
      return false;
    previousHash = entry.hash;
  }
  return true;
}
