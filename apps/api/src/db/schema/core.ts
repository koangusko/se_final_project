/** 帳號與 session。擁有者：整合者。 */
import { sql } from "drizzle-orm";
import { customType, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ROLES, USER_STATUSES } from "@class/shared/permissions";

export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

export const roleEnum = pgEnum("role", ROLES);
export const userStatusEnum = pgEnum("user_status", USER_STATUSES);
export const requestedRoleEnum = pgEnum("requested_role", ["user", "teacher"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
export { timestamps };

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineUserId: text("line_user_id").notNull().unique(),
  lineDisplayName: text("line_display_name").notNull(),
  linePictureUrl: text("line_picture_url"),
  name: text("name"),
  affiliation: text("affiliation"),
  phone: text("phone"),
  requestedRole: requestedRoleEnum("requested_role"),
  role: roleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("unregistered"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    /** token 的前半段（公開識別碼） */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256(token 的後半段)。原始 secret 不存 */
    secretHash: bytea("secret_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);
