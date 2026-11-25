import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "../../../components/ModulePlaceholder.tsx";
import { requireRole } from "../../../lib/auth.ts";

export const Route = createFileRoute("/space/admin/")({
  beforeLoad: requireRole(["admin"]),
  component: () => <ModulePlaceholder title="教室管理" task="docs/modules/space.md" />,
});
