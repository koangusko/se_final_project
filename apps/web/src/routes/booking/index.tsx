import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "../../components/ModulePlaceholder.tsx";
import { requireApproved } from "../../lib/auth.ts";

export const Route = createFileRoute("/booking/")({
  beforeLoad: requireApproved,
  component: () => <ModulePlaceholder title="預約借用" task="docs/modules/booking.md" />,
});
