/** 預約模組的 API 查詢。query key 一律以 "booking" 開頭，方便一次失效。 */
import { queryOptions } from "@tanstack/react-query";
import type { BookingStatus } from "@class/shared/booking";
import { api, unwrap } from "../../lib/api.ts";

export const bookingKeys = { all: ["booking"] as const };

export const bookableRoomsQuery = queryOptions({
  queryKey: ["booking", "rooms"],
  queryFn: async () => (await unwrap(api.rooms.$get({ query: { bookable: "1" } }))).rooms,
  staleTime: 5 * 60_000,
});

/** 所有啟用中的教室（含不開放預約的），用來顯示鑰匙屬於哪間 */
export const allRoomsQuery = queryOptions({
  queryKey: ["booking", "all-rooms"],
  queryFn: async () => (await unwrap(api.rooms.$get({ query: {} }))).rooms,
  staleTime: 5 * 60_000,
});

export const adminItemsQuery = queryOptions({
  queryKey: ["booking", "admin-items"],
  queryFn: async () => (await unwrap(api.booking.admin.items.$get())).items,
});

export const roomWeekQuery = (roomId: string, week: string) =>
  queryOptions({
    queryKey: ["booking", "room-week", roomId, week],
    queryFn: () =>
      unwrap(api.booking.rooms[":id"].week.$get({ param: { id: roomId }, query: { week } })),
  });

export const availabilityQuery = (q: {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
}) =>
  queryOptions({
    queryKey: ["booking", "availability", q],
    queryFn: async () => (await unwrap(api.booking.items.availability.$get({ query: q }))).items,
  });

/** 我的預約（全部狀態，頁籤在前端篩選） */
export const myBookingsQuery = queryOptions({
  queryKey: ["booking", "mine"],
  queryFn: async () => (await unwrap(api.booking.bookings.mine.$get({ query: {} }))).bookings,
});

export const bookingDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["booking", "detail", id],
    queryFn: async () =>
      (await unwrap(api.booking.bookings[":id"].$get({ param: { id } }))).booking,
  });

/** 管理員的預約列表；不給狀態就是全部 */
export const adminBookingsQuery = (status?: BookingStatus) =>
  queryOptions({
    queryKey: ["booking", "admin", status ?? "all"],
    queryFn: async () =>
      (await unwrap(api.booking.admin.bookings.$get({ query: status ? { status } : {} }))).bookings,
  });
