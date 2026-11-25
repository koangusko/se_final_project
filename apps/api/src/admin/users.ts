/** /api/admin/users：註冊審核與角色管理（管理員）。 */
import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { ReviewUserInput, UpdateUserRoleInput, type UserDto } from "@class/shared/core";
import { USER_STATUSES } from "@class/shared/permissions";
import { users } from "../db/schema/index.ts";
import { invalidState, notFound } from "../core/errors.ts";
import { requireAction, requireApproved } from "../core/guards.ts";
import type { AppEnv } from "../core/http.ts";
import { validate } from "../core/validate.ts";
import { invalidateUserSessions } from "../auth/session.ts";
import { toUserDto } from "../auth/users.ts";

const idParam = z.object({ id: z.uuid() });

export const adminUserRoutes = new Hono<AppEnv>()
  .use(requireAction("user.manage"))

  .get(
    "/",
    validate("query", z.object({ status: z.enum(USER_STATUSES).optional() })),
    async (c) => {
      const { status } = c.req.valid("query");
      const rows = await c.var.db
        .select()
        .from(users)
        .where(status ? eq(users.status, status) : undefined)
        .orderBy(asc(users.status), desc(users.createdAt));
      const list: UserDto[] = rows.map(toUserDto);
      return c.json({ users: list });
    },
  )

  .post("/:id/review", validate("param", idParam), validate("json", ReviewUserInput), async (c) => {
    const admin = requireApproved(c);
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const [target] = await c.var.db.select().from(users).where(eq(users.id, id));
    if (!target) throw notFound("使用者");
    if (target.status === "unregistered") throw invalidState("對方還沒填註冊資料");
    const reviewed = { reviewedBy: admin.id, reviewedAt: new Date() };
    const [row] = await c.var.db
      .update(users)
      .set(
        input.decision === "approve"
          ? { status: "approved", role: input.role, reviewNote: null, ...reviewed }
          : { status: "rejected", reviewNote: input.note ?? null, ...reviewed },
      )
      .where(eq(users.id, id))
      .returning();
    if (!row) throw notFound("使用者");
    if (input.decision === "reject") await invalidateUserSessions(c.var.db, id);
    return c.json({ user: toUserDto(row) });
  })

  .patch(
    "/:id/role",
    validate("param", idParam),
    validate("json", UpdateUserRoleInput),
    async (c) => {
      const admin = requireApproved(c);
      const { id } = c.req.valid("param");
      const { role } = c.req.valid("json");
      if (id === admin.id && role !== "admin") throw invalidState("不能移除自己的管理員權限");
      const [row] = await c.var.db.update(users).set({ role }).where(eq(users.id, id)).returning();
      if (!row) throw notFound("使用者");
      return c.json({ user: toUserDto(row) });
    },
  );
