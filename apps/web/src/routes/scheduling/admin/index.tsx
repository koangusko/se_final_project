import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "../../../components/ModulePlaceholder.tsx";
import { requireRole } from "../../../lib/auth.ts";

export const Route = createFileRoute("/scheduling/admin/")({
  beforeLoad: requireRole(["admin"]),
  component: () => <ModulePlaceholder title="排課管理" task="docs/modules/scheduling.md" />,
});
