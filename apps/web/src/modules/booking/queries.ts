/** 預約模組的 API 查詢。query key 一律以 "booking" 開頭，方便一次失效。 */
import { queryOptions } from "@tanstack/react-query";
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
