/** 預約詳細（B5、B8）。B4 送出後導到這裡。 */
import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "../../components/ModulePlaceholder.tsx";
import { requireApproved } from "../../lib/auth.ts";

export const Route = createFileRoute("/booking/$bookingId")({
  beforeLoad: requireApproved,
  component: () => <ModulePlaceholder title="預約詳細" task="docs/modules/booking.md B5、B8" />,
});
