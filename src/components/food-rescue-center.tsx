import { useMemo, useState } from "react";
import { Check, Clock3, HeartHandshake, Leaf, ShieldCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  buildFoodRescuePlans,
  rescueStageLabels,
  type RescueDecision,
  type RescuePlan,
} from "@/lib/food-rescue";
import { can, roleLabels, type UserRole } from "@/lib/security";
import type { Simulation } from "@/lib/simulation";

const fmt = (value: number) => value.toLocaleString("vi-VN");

export function FoodRescueCenter({
  open,
  onOpenChange,
  state,
  role,
  decisions,
  onDecision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: Simulation;
  role: UserRole;
  decisions: readonly RescueDecision[];
  onDecision: (plan: RescuePlan, status: RescueDecision["status"]) => void;
}) {
  const plans = useMemo(() => buildFoodRescuePlans(state), [state]);
  const [filter, setFilter] = useState<"all" | RescuePlan["stage"]>("all");
  const filtered = plans.filter((plan) => filter === "all" || plan.stage === filter);
  const decided = new Map(decisions.map((decision) => [decision.planId, decision]));
  const totalUnits = plans.reduce((sum, plan) => sum + plan.projectedRescuedUnits, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="food-rescue-modal">
        <div className="food-rescue-head">
          <span>
            <Leaf size={24} />
          </span>
          <div>
            <DialogTitle>Dynamic Markdown & Food Rescue Engine</DialogTitle>
            <DialogDescription>
              Ưu tiên lô FEFO theo thời gian còn lại. Mọi hành động cần quản lý duyệt và được ghi
              audit.
            </DialogDescription>
          </div>
          <span className="food-rescue-sdg">SDG 12</span>
        </div>
        <div className="food-rescue-kpis">
          <span>
            <small>Kế hoạch đang chờ</small>
            <b>{fmt(plans.length)}</b>
          </span>
          <span>
            <small>Có thể cứu</small>
            <b>{fmt(totalUnits)} đơn vị</b>
          </span>
          <span>
            <small>Vai trò hiện tại</small>
            <b>{roleLabels[role].name}</b>
          </span>
          <span>
            <small>Human-in-the-loop</small>
            <b>
              <ShieldCheck size={15} /> Bắt buộc duyệt
            </b>
          </span>
        </div>
        {!can(role, "rescue:approve") && (
          <div className="food-rescue-permission">
            <ShieldCheck size={17} /> Bạn có thể xem đề xuất. Chỉ vai trò Quản lý được duyệt hoặc từ
            chối.
          </div>
        )}
        <div className="food-rescue-filters">
          {(["all", "FLASH_24H", "GOLDEN_8H", "DONATE_2H"] as const).map((value) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "Tất cả" : rescueStageLabels[value]}
            </button>
          ))}
        </div>
        <div className="food-rescue-list">
          {filtered.map((plan) => {
            const decision = decided.get(plan.id);
            return (
              <article key={plan.id} className={`food-rescue-plan ${plan.stage.toLowerCase()}`}>
                <div className="food-rescue-plan-top">
                  <span className="food-rescue-stage">{rescueStageLabels[plan.stage]}</span>
                  <span className="food-rescue-clock">
                    <Clock3 size={13} /> còn {plan.hoursRemaining}h
                  </span>
                </div>
                <h3>{plan.productName}</h3>
                <p>
                  {plan.sku} · lô {plan.lotId} · HSD {plan.expiryDate}
                </p>
                <div className="food-rescue-values">
                  <span>
                    <small>Tồn lô</small>
                    <b>{fmt(plan.units)}</b>
                  </span>
                  <span>
                    <small>Vận tốc bán</small>
                    <b>{plan.salesVelocityPerHour}/giờ</b>
                  </span>
                  <span>
                    <small>Ưu đãi</small>
                    <b>
                      {plan.discountPercent === 100 ? "Chuyển tặng" : `−${plan.discountPercent}%`}
                    </b>
                  </span>
                  <span>
                    <small>Dự kiến cứu</small>
                    <b>{fmt(plan.projectedRescuedUnits)}</b>
                  </span>
                </div>
                <p className="food-rescue-rationale">
                  {plan.rationale} Kênh: {plan.channel}.
                </p>
                {decision ? (
                  <div className={`food-rescue-decision ${decision.status.toLowerCase()}`}>
                    {decision.status === "APPROVED" ? <Check size={15} /> : <X size={15} />}
                    {decision.status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"} · {decision.note}
                  </div>
                ) : (
                  <div className="food-rescue-actions">
                    <button
                      disabled={!can(role, "rescue:approve")}
                      onClick={() => onDecision(plan, "REJECTED")}
                    >
                      <X size={14} /> Từ chối / Human Override
                    </button>
                    <button
                      className="approve"
                      disabled={!can(role, "rescue:approve")}
                      onClick={() => onDecision(plan, "APPROVED")}
                    >
                      {plan.stage === "DONATE_2H" ? (
                        <HeartHandshake size={15} />
                      ) : (
                        <Check size={15} />
                      )}
                      Duyệt kế hoạch
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div className="sim-empty">
              <Leaf />
              <b>Không có lô trong cửa sổ này</b>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
