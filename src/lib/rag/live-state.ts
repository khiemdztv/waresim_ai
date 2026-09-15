import { Simulation } from "../grocery-simulation";

/**
 * Live State DB
 * Đóng vai trò lưu trữ Snapshot hiện tại. Agent sẽ gọi vào đây thay vì gọi Vector DB
 * để lấy các thông số chính xác 100% thời gian thực.
 */
class LiveState {
  private currentState: Simulation | null = null;

  // Projector: Cập nhật trạng thái mới nhất từ hệ thống
  updateState(state: Simulation) {
    this.currentState = state;
  }

  // Truy vấn tồn kho hiện tại (Current DB Query)
  getInventory(sku: string) {
    if (!this.currentState) return null;
    const product = this.currentState.products.find((p) => p.id === sku);
    if (!product) return null;

    return {
      sku: product.id,
      name: product.name,
      shelf: product.shelf,
      warehouse: product.warehouse,
      backroom: product.backroom,
      transit: product.lots.reduce((total, lot) => total + lot.transit, 0),
    };
  }

  // Lấy các chỉ số tổng quan
  getOverview() {
    if (!this.currentState) return null;
    return {
      time: this.currentState.time,
      sold: this.currentState.sold,
      revenue: this.currentState.revenue,
      activeJobs: this.currentState.jobs.filter((j) => !j.done).length,
    };
  }
}

export const liveState = new LiveState();
