/**
 * Vector DB / Knowledge Base
 * Chứa các văn bản tĩnh (SOP, Rule, Guideline).
 */
export interface SOPDocument {
    id: string;
    content: string;
    type: 'SOP' | 'POLICY' | 'GUIDELINE';
  }
  
  class KnowledgeBase {
    private docs: SOPDocument[] = [
      {
        id: "sop_restock",
        type: "SOP",
        content: "Quy trình bổ sung (Restock): Khi lượng hàng trên kệ (shelf) tụt xuống dưới điểm tái đặt hàng (reorderPoint), cần tạo lệnh xuất từ kho dự trữ (warehouse) hoặc backroom lên kệ. Chú ý luôn tuân thủ nguyên tắc FEFO (Hết hạn trước xuất trước)."
      },
      {
        id: "sop_damage",
        type: "SOP",
        content: "Hàng hỏng (Damage): Nếu phát hiện hàng hỏng, nhân viên cần cách ly vào khu vực hỏng (damaged). Lượng hàng này không được tính vào tồn kho khả dụng để bán."
      },
      {
        id: "policy_fefo",
        type: "POLICY",
        content: "Chính sách FEFO (First Expired First Out): Hệ thống tự động ưu tiên phân bổ các lô hàng có HSD gần nhất cho việc trưng bày lên kệ và bán ra. Hàng hết hạn sẽ tự động bị hệ thống cách ly."
      }
    ];
  
    // Mô phỏng Vector Search (Ở đây dùng filter từ khóa đơn giản)
    search(query: string): SOPDocument[] {
      const q = query.toLowerCase();
      // Nếu không có từ khóa liên quan, trả về rỗng để Agent biết không có trong Knowledge
      if (!q.includes("quy trình") && !q.includes("sop") && !q.includes("chính sách") && !q.includes("luật") && !q.includes("làm sao")) {
        return [];
      }
      
      return this.docs.filter(doc => 
        q.includes("bổ sung") || q.includes("restock") ? doc.id === "sop_restock" :
        q.includes("hỏng") || q.includes("cách ly") ? doc.id === "sop_damage" :
        q.includes("fefo") || q.includes("hết hạn") ? doc.id === "policy_fefo" : true
      );
    }
  }
  
  export const knowledgeBase = new KnowledgeBase();
  
