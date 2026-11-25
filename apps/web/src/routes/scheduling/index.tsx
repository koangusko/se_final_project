import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "../../components/ModulePlaceholder.tsx";
import { requireApproved } from "../../lib/auth.ts";

export const Route = createFileRoute("/scheduling/")({
  beforeLoad: requireApproved,
  component: () => <ModulePlaceholder title="課程排課" task="docs/modules/scheduling.md" />,
});
