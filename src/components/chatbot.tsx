import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Database, LoaderCircle, MessageCircle, Send, Sparkles, User, X } from "lucide-react";
import { queryRouter, type WarehouseAnswer } from "@/lib/rag/query-router";
import { generateGroqAnswer } from "@/lib/rag/groq-server";
import type { Simulation } from "@/lib/simulation";

type Message = {
  id: number;
  sender: "user" | "bot";
  text: string;
  answer?: WarehouseAnswer;
};

const suggestions = [
  "Phần mềm có chức năng gì?",
  "Có bao nhiêu SKU và lô?",
  "SKU-0001 còn bao nhiêu?",
  "Giải thích cảnh báo đỏ",
  "Quy trình bổ sung kệ?",
  "Dữ liệu realtime lấy từ đâu?",
  "Food Rescue hoạt động thế nào?",
];

export type RagRequest = { id: number; question: string };

export function Chatbot({
  state,
  request,
  onGuardrailBlocked,
}: {
  state: Simulation;
  request?: RagRequest | null;
  onGuardrailBlocked?: (code: string, question: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: "bot",
      text: "Mình là trợ lý Hybrid RAG của WareSim. Bạn có thể hỏi về chức năng phần mềm, dữ liệu realtime, SKU/lô/kệ/HSD, cảnh báo, lịch sử và mọi quy trình nhập–bổ sung–bán–cách ly.",
    },
  ]);
  const nextId = useRef(2);
  const endRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const messagesRef = useRef(messages);
  const busyRef = useRef(false);
  const handledRequest = useRef<number | null>(null);
  const guardrailCallbackRef = useRef(onGuardrailBlocked);
  stateRef.current = state;
  messagesRef.current = messages;
  guardrailCallbackRef.current = onGuardrailBlocked;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, open]);

  const ask = useCallback(async (question: string) => {
    const value = question.trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setThinking(true);
    setInput("");
    const history = messagesRef.current
      .filter((message) => message.id !== 1)
      .slice(-8)
      .map((message) => {
        const content = message.answer?.aiText ?? message.text;
        return {
          role: message.sender === "user" ? ("user" as const) : ("assistant" as const),
          content: content.length > 2400 ? `${content.slice(0, 2399)}…` : content,
        };
      });
    const userMessage: Message = { id: nextId.current++, sender: "user", text: value };
    setMessages((current) => {
      const next = [...current, userMessage];
      messagesRef.current = next;
      return next;
    });

    try {
      const grounded = await queryRouter.processQuery(value, stateRef.current);
      if (grounded.blocked)
        guardrailCallbackRef.current?.(grounded.guardrailCode ?? "UNKNOWN", value);
      const generated = grounded.blocked
        ? { ok: false as const, reason: "Yêu cầu bị guardrail chặn." }
        : await generateGroqAnswer({
            data: {
              question: value,
              groundedContext: grounded.text,
              source: grounded.source,
              snapshot: grounded.snapshot,
              citations: grounded.citations ?? [],
              history,
            },
          });
      const answer: WarehouseAnswer = generated.ok
        ? { ...grounded, aiText: generated.text, model: generated.model }
        : { ...grounded, aiError: generated.reason };
      const botMessage: Message = {
        id: nextId.current++,
        sender: "bot",
        text: grounded.text,
        answer,
      };
      setMessages((current) => {
        const next = [...current, botMessage];
        messagesRef.current = next;
        return next;
      });
    } catch (error) {
      console.error("Optional Groq layer failed; using deterministic RAG fallback", error);
      const grounded = await queryRouter.processQuery(value, stateRef.current);
      const botMessage: Message = {
        id: nextId.current++,
        sender: "bot",
        text: grounded.text,
        answer: { ...grounded, aiError: "Không gọi được lớp diễn giải Groq." },
      };
      setMessages((current) => {
        const next = [...current, botMessage];
        messagesRef.current = next;
        return next;
      });
    } finally {
      busyRef.current = false;
      setThinking(false);
    }
  }, []);

  useEffect(() => {
    if (!request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    setOpen(true);
    void ask(request.question);
  }, [ask, request]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  return (
    <>
      <button
        className={`warehouse-chat-launcher ${open ? "hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Mở trợ lý kho thời gian thực"
      >
        <MessageCircle size={23} />
        <span>
          <b>Hỏi Hybrid RAG</b>
          <small>Phần mềm · dữ liệu · vận hành</small>
        </span>
        <i />
      </button>
      <section
        className={`warehouse-chat ${open ? "open" : ""}`}
        aria-label="Trợ lý kho thời gian thực"
        aria-hidden={!open}
      >
        <header>
          <span className="warehouse-chat-bot">
            <Bot size={20} />
          </span>
          <div>
            <b>WareSim Operations Agent</b>
            <small>
              <i /> GROQ + HYBRID RAG · đang đồng bộ
            </small>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Đóng trợ lý">
            <X size={18} />
          </button>
        </header>
        <div className="warehouse-chat-freshness">
          <Database size={13} /> Trạng thái mới nhất ·{" "}
          {state.products.length.toLocaleString("vi-VN")} SKU
        </div>
        <div className="warehouse-chat-messages" aria-live="polite">
          {messages.map((message) => (
            <article key={message.id} className={message.sender}>
              <span>{message.sender === "bot" ? <Bot size={14} /> : <User size={14} />}</span>
              <div>
                <p>{message.answer?.aiText ?? message.text}</p>
                {message.answer && (
                  <>
                    <small>
                      {message.answer.model
                        ? `GROQ ${message.answer.model} · `
                        : message.answer.aiError
                          ? "LOCAL FALLBACK · "
                          : ""}
                      {message.answer.source} · snapshot {message.answer.snapshot}
                    </small>
                    {message.answer.aiError && (
                      <small className="warehouse-chat-ai-error">{message.answer.aiError}</small>
                    )}
                    {message.answer.aiText && (
                      <details className="warehouse-chat-grounding">
                        <summary>Dữ liệu RAG đã truy xuất</summary>
                        <p>{message.text}</p>
                      </details>
                    )}
                    {message.answer.citations && (
                      <div className="warehouse-chat-citations">
                        {message.answer.citations.map((citation) => (
                          <span key={citation}>
                            <Sparkles size={9} /> {citation}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
          {thinking && (
            <article className="bot warehouse-chat-thinking">
              <span>
                <Bot size={14} />
              </span>
              <div>
                <p>
                  <LoaderCircle size={14} /> Groq đang phân tích context realtime…
                </p>
              </div>
            </article>
          )}
          <div ref={endRef} />
        </div>
        {messages.length < 4 && (
          <div className="warehouse-chat-suggestions">
            {suggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => void ask(suggestion)} disabled={thinking}>
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={thinking}
            placeholder="Hỏi về phần mềm, dữ liệu hoặc vận hành…"
            aria-label="Câu hỏi cho trợ lý kho"
          />
          <button type="submit" disabled={!input.trim() || thinking} aria-label="Gửi câu hỏi">
            {thinking ? (
              <LoaderCircle className="warehouse-chat-spinner" size={17} />
            ) : (
              <Send size={17} />
            )}
          </button>
        </form>
        <footer>
          Groq diễn giải · Live State giữ số liệu · Event History giữ lịch sử · Knowledge RAG giữ
          SOP.
        </footer>
      </section>
    </>
  );
}
