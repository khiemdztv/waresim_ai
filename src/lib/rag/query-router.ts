import { eventStore } from "./event-store";
import { liveState } from "./live-state";
import { knowledgeBase } from "./knowledge-base";
import { ruleEngine } from "./rule-engine";

export enum Intent {
  CURRENT_STATE,
  HISTORY,
  KNOWLEDGE,
  COMPLEX
}

class QueryRouter {
  
  detectIntent(query: string): Intent {
    const lowerQ = query.toLowerCase();
    
    if (lowerQ.includes("hiện tại") || lowerQ.includes("còn bao nhiêu") || lowerQ.includes("còn lại")) {
      return Intent.CURRENT_STATE;
    }
    if (lowerQ.includes("lịch sử") || lowerQ.includes("hôm qua") || lowerQ.includes("trước đó") || lowerQ.includes("đã xảy ra")) {
      return Intent.HISTORY;
    }
    if (lowerQ.includes("quy trình") || lowerQ.includes("hướng dẫn") || lowerQ.includes("sop") || lowerQ.includes("chính sách")) {
      return Intent.KNOWLEDGE;
    }
    return Intent.COMPLEX;
  }

  /**
   * Gọi LLM qua Groq API
   */
  private async callLLM(prompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b",
          messages: [
            { role: "system", content: "Bạn là AI Operations Agent (Temporal RAG) của hệ thống kho hàng WareSim. Hãy trả lời ngắn gọn, súc tích bằng tiếng Việt dựa trên Context được cung cấp. Nếu Context không có thông tin, hãy nói không biết. Đừng bịa dữ liệu." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error("LLM Error:", errText);
        let errMsg = "lỗi kết nối";
        try {
           const parsed = JSON.parse(errText);
           if (parsed.error && parsed.error.message) {
               errMsg = parsed.error.message;
           }
        } catch(e) {}
        return `🤖 [Lỗi API từ Groq]: ${errMsg}.`;
      }
      
      const data = await res.json();
      return `🤖 ${data.choices[0].message.content}`;
    } catch (err) {
      console.error("Fetch error:", err);
      return "🤖 Xin lỗi, không thể gọi AI API lúc này.";
    }
  }

  /**
   * Agentic RAG: Phân tích ngữ cảnh và gọi LLM
   */
  async processQuery(query: string): Promise<string> {
    const intent = this.detectIntent(query);
    
    // Tìm mã SKU trong câu hỏi (hardcode mock, thực tế LLM có thể làm)
    let targetSku = "";
    if (query.includes("SKU-001") || query.includes("Sữa") || query.includes("sữa")) targetSku = "milk-1";
    if (query.includes("SKU-002") || query.includes("Cà phê")) targetSku = "coffee-1";
    if (!targetSku) targetSku = "milk-1"; // default

    let context = "";

    switch (intent) {
      case Intent.CURRENT_STATE: {
        const inventory = liveState.getInventory(targetSku);
        if (!inventory) return `🤖 Không tìm thấy dữ liệu hiện tại cho ${targetSku}.`;
        context = `[Live DB Context]: Trạng thái hiện tại của ${inventory.name}: Kệ bán (${inventory.shelf}), Kho dự trữ (${inventory.warehouse}), Kho sau (${inventory.backroom}), Đang trung chuyển (${inventory.transit}).`;
        break;
      }
      
      case Intent.HISTORY: {
        const history = eventStore.queryHistory(targetSku, 5);
        if (history.length === 0) return `🤖 [Event Store] Không có lịch sử hoạt động nào gần đây cho ${targetSku}.`;
        const historyStr = history.map(h => `- ${h.title}: ${h.detail}`).join("\n");
        context = `[Event Store Context]: Các sự kiện gần đây liên quan tới ${targetSku}:\n${historyStr}`;
        break;
      }
      
      case Intent.KNOWLEDGE: {
        const docs = knowledgeBase.search(query);
        if (docs.length === 0) return `🤖 [Vector DB] Không tìm thấy hướng dẫn nào phù hợp.`;
        const docsStr = docs.map(d => `- [${d.type}] ${d.content}`).join("\n\n");
        context = `[Vector DB Context]: Dựa trên quy định SOP:\n${docsStr}`;
        break;
      }
      
      case Intent.COMPLEX:
      default: {
        const inventory = liveState.getInventory(targetSku);
        const alerts = ruleEngine.getActiveAlerts().filter(a => a.sku === targetSku);
        const docs = knowledgeBase.search("restock"); 
        
        context = `[Agentic RAG Context]:\n`;
        context += `- Trạng thái hiện tại: Kệ có ${inventory?.shelf || 0}, Kho dự trữ có ${inventory?.warehouse || 0}.\n`;
        if (alerts.length > 0) context += `- Cảnh báo đang Active: ${alerts[0].message}\n`;
        if (docs.length > 0) context += `- SOP hệ thống: ${docs[0].content}\n`;
        break;
      }
    }
    
    // Gọi LLM với Query + Context
    const prompt = `Câu hỏi của người dùng: "${query}"\n\nContext từ hệ thống:\n${context}\n\nHãy trả lời câu hỏi của người dùng dựa trên Context.`;
    return await this.callLLM(prompt);
  }
}

export const queryRouter = new QueryRouter();
