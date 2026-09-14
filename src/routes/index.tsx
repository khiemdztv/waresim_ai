import { createFileRoute } from "@tanstack/react-router";
import { OperationsSimulator } from "@/components/operations-simulator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WareSim — Mô phỏng kho & cửa hàng" },
      {
        name: "description",
        content:
          "Mô phỏng trực quan quy trình nhập kho, lấy hàng, đóng gói, chuyển cửa hàng và thanh toán.",
      },
      { property: "og:title", content: "WareSim — Mô phỏng kho & cửa hàng" },
      {
        property: "og:description",
        content: "Không gian isometric tương tác cho kho hàng và cửa hàng bán lẻ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <OperationsSimulator />;
}
