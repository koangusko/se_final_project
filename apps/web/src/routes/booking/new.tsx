/**
 * 新增預約（B3、B4）。網址與參數先定好，讓其他模組可以連過來：
 *   <ButtonLink to="/booking/new" search={{ roomId }}>預約這間</ButtonLink>
 * 實作時保留 validateSearch 的欄位（可以加，不要改名或刪除）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  BOOKING_CLOSE_TIME,
  BOOKING_LEAD_DAYS,
  BOOKING_MAX_MINUTES,
  BOOKING_OPEN_TIME,
  BOOKING_RULES_URL,
  BOOKING_STEP_MINUTES,
  ITEM_CATEGORY_LABELS,
  type CreateBookingInput,
} from "@class/shared/booking";
import {
  addDays,
  addMinutes,
  DateStrSchema,
  formatDate,
  overlaps,
  taipeiParts,
  timeToMinutes,
  todayInTaipei,
  toInstant,
  weekStartOf,
} from "@class/shared/time";
import {
  Button,
  Card,
  Checkbox,
  ErrorBlock,
  Field,
  fieldErrors,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Textarea,
  toast,
} from "../../components/ui/index.ts";
import { WeekGrid, WeekNav, type WeekGridEvent } from "../../components/week-grid/index.ts";
import { api, ApiError, unwrap } from "../../lib/api.ts";
import { requireApproved, useMe } from "../../lib/auth.ts";
import {
  availabilityQuery,
  bookableRoomsQuery,
  bookingKeys,
  roomWeekQuery,
} from "../../modules/booking/queries.ts";
import { RoomOptions } from "../../modules/booking/RoomOptions.tsx";

export const Route = createFileRoute("/booking/new")({
  validateSearch: z.object({
    roomId: z.string().optional(),
    /** 該週週一 */
    week: DateStrSchema.optional(),
  }),
  beforeLoad: requireApproved,
  component: NewBookingPage,
});

interface Draft {
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  attendeeCount: string;
  /** itemId -> 數量 */
  items: Record<string, number>;
}

const EMPTY_DRAFT: Draft = {
  date: "",
  startTime: "",
  endTime: "",
  purpose: "",
  attendeeCount: "",
  items: {},
};

/** 後端回來的欄位錯誤裡，表單上有顯示位置的欄位 */
const FORM_FIELDS = new Set(["date", "startTime", "endTime", "purpose", "attendeeCount"]);

function NewBookingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const me = useMe();
  // 管理要點：使用日 3 天前申請；管理員代為登記不受限
  const today = todayInTaipei();
  const minDate = me?.role === "admin" ? today : addDays(today, BOOKING_LEAD_DAYS);
  const week = weekStartOf(search.week ?? minDate);
  const roomId = search.roomId ?? "";

  const rooms = useQuery(bookableRoomsQuery);
  const room = rooms.data?.find((r) => r.id === roomId);
  const roomWeek = useQuery({ ...roomWeekQuery(roomId, week), enabled: roomId !== "" });

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const timeReady =
    roomId !== "" &&
    draft.date !== "" &&
    draft.startTime !== "" &&
    draft.endTime !== "" &&
    timeToMinutes(draft.endTime) > timeToMinutes(draft.startTime);
  const draftInterval = useMemo(
    () =>
      timeReady
        ? {
            start: toInstant(draft.date, draft.startTime),
            end: toInstant(draft.date, draft.endTime),
          }
        : null,
    [timeReady, draft.date, draft.startTime, draft.endTime],
  );

  const availability = useQuery({
    ...availabilityQuery({
      roomId,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
    }),
    enabled: timeReady,
  });

  const clash = useMemo(() => {
    if (!draftInterval) return null;
    return (roomWeek.data?.occupancy ?? []).find((o) =>
      overlaps(draftInterval, { start: new Date(o.startsAt), end: new Date(o.endsAt) }),
    );
  }, [roomWeek.data, draftInterval]);

  const events: WeekGridEvent[] = useMemo(() => {
    const list: WeekGridEvent[] = [];
    for (const o of roomWeek.data?.occupancy ?? []) {
      list.push({
        id: `occ-${o.refId}`,
        start: new Date(o.startsAt),
        end: new Date(o.endsAt),
        title: o.label,
        tone: o.source === "course" ? "course" : "booking",
      });
    }
    for (const b of roomWeek.data?.mine ?? []) {
      list.push({
        id: `mine-${b.id}`,
        start: new Date(b.startsAt),
        end: new Date(b.endsAt),
        title: "我的申請",
        subtitle: "待審核",
        tone: "pending",
      });
    }
    if (draftInterval) {
      list.push({ id: "draft", ...draftInterval, title: "這次預約", tone: "conflict" });
    }
    return list;
  }, [roomWeek.data, draftInterval]);

  const submit = useMutation({
    mutationFn: (input: CreateBookingInput) => unwrap(api.booking.bookings.$post({ json: input })),
    onSuccess: async ({ booking }) => {
      toast.success("已送出預約", "管理員審核後會更新狀態");
      await qc.invalidateQueries({ queryKey: bookingKeys.all });
      await navigate({ to: "/booking/$bookingId", params: { bookingId: booking.id } });
    },
    onError: async (err) => {
      if (err instanceof ApiError && err.code === "VALIDATION") {
        const fields = fieldErrors(err.details);
        setErrors(fields);
        const shown = Object.keys(fields).some((k) => FORM_FIELDS.has(k) || k.startsWith("items"));
        if (!shown) toast.error(err, "無法送出預約");
        // 送出按鈕在表單底部，把第一個有錯的欄位捲進畫面
        requestAnimationFrame(() =>
          formRef.current
            ?.querySelector('[aria-invalid="true"]')
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        );
        return;
      }
      toast.error(err, "無法送出預約");
      // 占用或物品數量變了：重新抓週曆與可借數量
      await qc.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });

  function goWeek(w: string) {
    void navigate({ search: { ...search, week: w } });
  }

  function setDate(date: string) {
    setDraft((d) => ({ ...d, date }));
    if (DateStrSchema.safeParse(date).success && weekStartOf(date) !== week) {
      goWeek(weekStartOf(date));
    }
  }

  function pickSlot(start: Date) {
    const p = taipeiParts(start);
    if (p.date < minDate) {
      toast.info(`請在使用日 ${BOOKING_LEAD_DAYS} 天前申請`, `最早可以預約 ${formatDate(minDate)}`);
      return;
    }
    const end = taipeiParts(addMinutes(start, 60));
    const endTime =
      end.date === p.date && end.time <= BOOKING_CLOSE_TIME ? end.time : BOOKING_CLOSE_TIME;
    setDraft((d) => ({ ...d, date: p.date, startTime: p.time, endTime }));
    setErrors({});
    // 週曆和表單上下排列時，帶入後捲到表單
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    submit.mutate({
      roomId,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      purpose: draft.purpose,
      ...(draft.attendeeCount ? { attendeeCount: Number(draft.attendeeCount) } : {}),
      items: Object.entries(draft.items)
        .filter(([, q]) => q > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity })),
    });
  }

  const step = BOOKING_STEP_MINUTES * 60;
  const itemsError = Object.entries(errors).find(([k]) => k.startsWith("items"))?.[1];

  return (
    <div className="space-y-6">
      <PageHeader
        title="新增預約"
        description="選教室，看這週的使用狀況，點空白時段或直接填時間。"
      />

      <div className="rounded-card border border-info/30 bg-info-soft px-4 py-3 text-sm">
        <p className="font-medium text-info">借用須知（管理學院場所管理要點）</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
          <li>請在使用日 {BOOKING_LEAD_DAYS} 天前申請，核准後才能借鑰匙與設備。</li>
          <li>
            開放時間 {BOOKING_OPEN_TIME}–{BOOKING_CLOSE_TIME}，單次最多 {BOOKING_MAX_MINUTES / 60}{" "}
            小時。
          </li>
          <li>學生社團需先經課外活動組核准；與教學使用衝突時以教學優先。</li>
          <li>
            收費、保證金與校外單位借用，請見
            <a
              href={BOOKING_RULES_URL}
              target="_blank"
              rel="noreferrer"
              className="mx-1 text-info underline underline-offset-2"
            >
              管院教室租借規範
            </a>
            。
          </li>
        </ul>
      </div>

      <Card className="flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-80">
          <Field label="教室" required>
            {(p) => (
              <Select
                {...p}
                value={roomId}
                onChange={(e) => {
                  // 鑰匙跟著教室，換教室時清掉已選的物品
                  setDraft((d) => ({ ...d, items: {} }));
                  void navigate({ search: { ...search, roomId: e.target.value || undefined } });
                }}
              >
                <option value="">請選擇教室</option>
                <RoomOptions rooms={rooms.data ?? []} showCapacity />
              </Select>
            )}
          </Field>
        </div>
        <WeekNav weekStart={week} onChange={goWeek} />
      </Card>

      {rooms.isError && <ErrorBlock error={rooms.error} />}
      {roomId === "" ? (
        <p className="text-sm text-ink-muted">先選擇教室，就會顯示這週的使用狀況。</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <Legend className="border-event-course bg-event-course/12" label="課程" />
              <Legend className="border-event-booking bg-event-booking/12" label="已核准的預約" />
              <Legend
                className="border-dashed border-event-pending bg-event-pending/10"
                label="我的待審核申請"
              />
              <Legend className="border-event-conflict bg-event-conflict/12" label="這次預約" />
            </div>
            {roomWeek.isPending ? (
              <LoadingBlock />
            ) : roomWeek.isError ? (
              <ErrorBlock error={roomWeek.error} />
            ) : (
              <WeekGrid
                weekStart={week}
                events={events}
                dayStart={BOOKING_OPEN_TIME}
                dayEnd={BOOKING_CLOSE_TIME}
                onSlotClick={pickSlot}
              />
            )}
          </div>

          <div ref={formRef} className="scroll-mt-4 lg:sticky lg:top-4">
            <Card>
              <form onSubmit={onSubmit} className="space-y-4">
                <h2 className="font-medium">{room ? `預約 ${room.code}` : "預約資料"}</h2>
                <Field label="日期" required error={errors.date}>
                  {(p) => (
                    <Input
                      {...p}
                      type="date"
                      min={minDate}
                      value={draft.date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="開始" required error={errors.startTime}>
                    {(p) => (
                      <Input
                        {...p}
                        type="time"
                        step={step}
                        min={BOOKING_OPEN_TIME}
                        max={BOOKING_CLOSE_TIME}
                        value={draft.startTime}
                        onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="結束" required error={errors.endTime}>
                    {(p) => (
                      <Input
                        {...p}
                        type="time"
                        step={step}
                        min={BOOKING_OPEN_TIME}
                        max={BOOKING_CLOSE_TIME}
                        value={draft.endTime}
                        onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                      />
                    )}
                  </Field>
                </div>
                {clash && (
                  <p className="text-sm text-danger">
                    這個時段和「{clash.label}」重疊，請換一個時段。
                  </p>
                )}
                <Field label="用途" required error={errors.purpose}>
                  {(p) => (
                    <Textarea
                      {...p}
                      className="min-h-20"
                      placeholder="例：專題討論、社團幹部會議"
                      value={draft.purpose}
                      onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                    />
                  )}
                </Field>
                <Field
                  label="人數"
                  {...(room ? { hint: `這間可容納 ${room.capacity} 人` } : {})}
                  error={errors.attendeeCount}
                >
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={draft.attendeeCount}
                      onChange={(e) => setDraft({ ...draft, attendeeCount: e.target.value })}
                    />
                  )}
                </Field>

                <div>
                  <p className="mb-2 text-sm font-medium">借用物品</p>
                  {!timeReady ? (
                    <p className="text-sm text-ink-muted">
                      填好日期與時間後，會列出這個時段還能借的物品。
                    </p>
                  ) : availability.isPending ? (
                    <LoadingBlock label="查詢可借數量" />
                  ) : availability.isError ? (
                    <ErrorBlock error={availability.error} />
                  ) : availability.data.length === 0 ? (
                    <p className="text-sm text-ink-muted">沒有可借的物品。</p>
                  ) : (
                    <ul className="space-y-2">
                      {availability.data.map((item) => {
                        const qty = draft.items[item.id] ?? 0;
                        const soldOut = item.available === 0;
                        const setQty = (n: number) =>
                          setDraft((d) => ({ ...d, items: { ...d.items, [item.id]: n } }));
                        return (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-1"
                          >
                            <Checkbox
                              className="min-w-0 flex-1 sm:min-h-10"
                              disabled={soldOut && qty === 0}
                              checked={qty > 0}
                              onChange={(e) => setQty(e.target.checked ? 1 : 0)}
                              label={
                                <span className="min-w-0">
                                  <span className="block truncate">{item.name}</span>
                                  <span
                                    className={
                                      qty > item.available
                                        ? "text-xs text-danger"
                                        : "text-xs text-ink-muted"
                                    }
                                  >
                                    {ITEM_CATEGORY_LABELS[item.category]}・
                                    {soldOut ? "已借完" : `可借 ${item.available}`}
                                  </span>
                                </span>
                              }
                            />
                            {qty > 0 && item.available > 1 && (
                              <div className="w-20 shrink-0">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  aria-label={`${item.name} 數量`}
                                  min={1}
                                  max={item.available}
                                  value={qty}
                                  onChange={(e) =>
                                    setQty(
                                      Math.min(Math.max(1, Number(e.target.value)), item.available),
                                    )
                                  }
                                />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {itemsError && <p className="mt-1 text-xs text-danger">{itemsError}</p>}
                </div>

                <Button type="submit" className="w-full" loading={submit.isPending}>
                  送出預約
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded-sm border-l-[3px] ${className}`} />
      {label}
    </span>
  );
}
