/**
 * 新增預約（B3、B4）。網址與參數先定好，讓其他模組可以連過來：
 *   <ButtonLink to="/booking/new" search={{ roomId }}>預約這間</ButtonLink>
 * 實作時保留 validateSearch 的欄位（可以加，不要改名或刪除）。
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DateStrSchema } from "@class/shared/time";
import { ModulePlaceholder } from "../../components/ModulePlaceholder.tsx";
import { requireApproved } from "../../lib/auth.ts";

export const Route = createFileRoute("/booking/new")({
  validateSearch: z.object({
    roomId: z.string().optional(),
    /** 該週週一 */
    week: DateStrSchema.optional(),
  }),
  beforeLoad: requireApproved,
  component: () => <ModulePlaceholder title="新增預約" task="docs/modules/booking.md B3、B4" />,
});
