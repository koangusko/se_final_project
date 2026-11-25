import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "../../components/ModulePlaceholder.tsx";

export const Route = createFileRoute("/space/")({
  component: () => <ModulePlaceholder title="空間查詢" task="docs/modules/space.md" />,
});
