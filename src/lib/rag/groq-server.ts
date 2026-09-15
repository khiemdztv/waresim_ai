import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { inspectPrompt } from "../security";

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2500),
});

const requestSchema = z.object({
  question: z.string().min(1).max(600),
  groundedContext: z.string().min(1).max(12000),
  source: z.string().min(1).max(80),
  snapshot: z.string().min(1).max(80),
  citations: z.array(z.string().max(160)).max(12),
  history: z.array(turnSchema).max(8),
});

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  error?: { message?: string };
};

export const generateGroqAnswer = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }) => {
    const guardrail = inspectPrompt(data.question);
    if (!guardrail.safe)
      return {
        ok: false as const,
        reason: `Yêu cầu bị chặn bởi ${guardrail.code}.`,
      };
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) return { ok: false as const, reason: "GROQ_API_KEY chưa được cấu hình." };

    const model = process.env["GROQ_MODEL"] || "openai/gpt-oss-20b";
    const retrieved = [
      `Nguồn truy xuất: ${data.source}`,
      `Snapshot: ${data.snapshot}`,
      `Tài liệu/bằng chứng: ${data.citations.join("; ") || "Live State"}`,
      "NỘI DUNG ĐÃ TRUY XUẤT (nguồn sự thật):",
      data.groundedContext,
    ].join("\n");

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.15,
          max_completion_tokens: 1200,
          reasoning_effort: "low",
          reasoning_format: "hidden",
          messages: [
            {
              role: "system",
              content:
                "Bạn là WareSim Operations Copilot, trả lời tiếng Việt về phần mềm mô phỏng kho và cửa hàng. Dữ liệu trong phần NỘI DUNG ĐÃ TRUY XUẤT là nguồn sự thật duy nhất cho số liệu hiện tại. Giữ nguyên mọi con số, mã SKU/lô, vị trí và thời điểm; không tự tạo dữ liệu. Kết hợp Live State với SOP để giải thích rõ nguyên nhân, ảnh hưởng và hành động khi phù hợp. Nếu context chưa đủ, nói chính xác dữ liệu nào còn thiếu. Trả lời trực tiếp, dễ đọc, tối đa khoảng 350 từ.",
            },
            ...data.history.map((turn) => ({ role: turn.role, content: turn.content })),
            {
              role: "user",
              content: `${retrieved}\n\nCÂU HỎI HIỆN TẠI: ${data.question}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      const payload = (await response.json()) as GroqResponse;
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!response.ok || !content) {
        console.error("Groq request failed", response.status, payload.error?.message ?? "empty");
        return { ok: false as const, reason: "Groq tạm thời không trả về nội dung." };
      }

      return {
        ok: true as const,
        text: content,
        model: payload.model || model,
      };
    } catch (error) {
      console.error("Groq request failed", error instanceof Error ? error.message : "unknown");
      return { ok: false as const, reason: "Không kết nối được Groq trong lần hỏi này." };
    }
  });
