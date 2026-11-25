import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "../../../components/ModulePlaceholder.tsx";
import { requireRole } from "../../../lib/auth.ts";

export const Route = createFileRoute("/booking/admin/")({
  beforeLoad: requireRole(["admin"]),
  component: () => <ModulePlaceholder title="預約審核與借還" task="docs/modules/booking.md" />,
});
