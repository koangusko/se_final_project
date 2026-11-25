import { createFileRoute } from "@tanstack/react-router";
import { ButtonLink, EmptyState, PageHeader } from "../../../components/ui/index.ts";
import { requireRole } from "../../../lib/auth.ts";

export const Route = createFileRoute("/booking/admin/")({
  beforeLoad: requireRole(["admin"]),
  component: () => (
    <div>
      <PageHeader
        title="預約審核與借還"
        actions={
          <ButtonLink to="/booking/admin/items" variant="secondary">
            物品管理
          </ButtonLink>
        }
      />
      <EmptyState title="這個頁面還沒實作" description="對應任務：docs/modules/booking.md B6、B7" />
    </div>
  ),
});
