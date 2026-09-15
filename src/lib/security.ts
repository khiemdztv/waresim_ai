export type UserRole = "staff" | "manager" | "auditor";

export type Permission =
  | "inventory:read"
  | "operation:create"
  | "operation:approve"
  | "financial:read"
  | "rescue:approve"
  | "scenario:run"
  | "audit:read";

export const roleLabels: Record<UserRole, { name: string; short: string; description: string }> = {
  staff: {
    name: "Nhân viên sàn",
    short: "Staff",
    description: "Xem tồn kho, cảnh báo và tạo lệnh bổ sung nháp.",
  },
  manager: {
    name: "Quản lý",
    short: "Manager",
    description: "Duyệt tác vụ, Food Rescue, xem KPI tài chính và chạy kịch bản.",
  },
  auditor: {
    name: "Kiểm toán viên",
    short: "Auditor",
    description: "Chỉ đọc dữ liệu vận hành và toàn bộ nhật ký kiểm toán.",
  },
};

const permissions: Record<UserRole, ReadonlySet<Permission>> = {
  staff: new Set(["inventory:read", "operation:create"]),
  manager: new Set([
    "inventory:read",
    "operation:create",
    "operation:approve",
    "financial:read",
    "rescue:approve",
    "scenario:run",
    "audit:read",
  ]),
  auditor: new Set(["inventory:read", "financial:read", "audit:read"]),
};

export function can(role: UserRole, permission: Permission) {
  return permissions[role].has(permission);
}

export type GuardrailCode =
  | "PROMPT_OVERRIDE"
  | "SECRET_EXTRACTION"
  | "PRIVILEGE_ESCALATION"
  | "UNSAFE_TRANSACTION"
  | "DESTRUCTIVE_INJECTION";

export type GuardrailResult = { safe: true } | { safe: false; code: GuardrailCode; reason: string };

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

const promptRules: Array<{ code: GuardrailCode; reason: string; patterns: RegExp[] }> = [
  {
    code: "PROMPT_OVERRIDE",
    reason: "Yêu cầu cố ghi đè chỉ dẫn hệ thống hoặc bỏ qua phạm vi trợ lý.",
    patterns: [
      /ignore (all |the )?(previous|system) instructions?/,
      /bo qua (tat ca )?(chi dan|huong dan|quy tac).*(truoc|he thong)/,
      /system prompt/,
      /developer message/,
      /jailbreak/,
    ],
  },
  {
    code: "SECRET_EXTRACTION",
    reason: "Yêu cầu truy xuất bí mật, biến môi trường hoặc khóa dịch vụ.",
    patterns: [
      /(show|reveal|print|extract|doc|lay|hien thi).*(api.?key|secret|token|password|env)/,
      /(api.?key|groq.?key|secret|token|mat khau).*(la gi|value|gia tri)/,
      /process\.env/,
      /\.env(\.local)?/,
    ],
  },
  {
    code: "PRIVILEGE_ESCALATION",
    reason: "Yêu cầu vượt quyền, giả mạo quản lý hoặc vô hiệu hóa phê duyệt.",
    patterns: [
      /(pretend|act as|impersonate).*(admin|manager|root)/,
      /(gia mao|dong vai|tu nhan).*(quan ly|admin|root)/,
      /(bypass|bo qua|vo hieu).*(rbac|phan quyen|phe duyet|approval)/,
      /(grant|cap).*(admin|root|quyen quan ly)/,
    ],
  },
  {
    code: "UNSAFE_TRANSACTION",
    reason:
      "AI không được tự tạo giao dịch miễn phí hoặc thực thi lệnh tồn kho ngoài quy trình duyệt.",
    patterns: [
      /(xuat|ban|chuyen).*(0 dong|mien phi).*(khong can|bo qua|tu dong)/,
      /(execute|create|issue).*(free|zero.?price).*(order|shipment|transaction)/,
      /(tu dong|ngay lap tuc).*(xoa|huy|xuat).*(toan bo|tat ca).*(hang|ton kho)/,
    ],
  },
  {
    code: "DESTRUCTIVE_INJECTION",
    reason: "Phát hiện chuỗi lệnh phá hoại hoặc chèn truy vấn nguy hiểm.",
    patterns: [
      /drop\s+(table|database)/,
      /truncate\s+table/,
      /delete\s+from\s+\w+\s*(;|$)/,
      /rm\s+-rf/,
      /<script[\s>]/,
    ],
  },
];

export function inspectPrompt(input: string): GuardrailResult {
  const normalized = fold(input).replace(/\s+/g, " ").trim();
  for (const rule of promptRules) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return { safe: false, code: rule.code, reason: rule.reason };
    }
  }
  return { safe: true };
}
