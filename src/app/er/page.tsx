import { EmergencyCase } from "@/components/EmergencyCase";
import { DEMO_CASE } from "@/data/demo-case";

export default function ERPage() {
  // Thực tế: lấy case_run đang dở (resume từ thiết bị khác) hoặc chọn case có nhiều thẻ đến hạn nhất,
  // rồi truyền `submit` gọi POST /api/runs/:runId/answer.
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight">Phòng cấp cứu</h1>
      <EmergencyCase data={DEMO_CASE} />
    </div>
  );
}
