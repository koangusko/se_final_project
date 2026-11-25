/** 教室下拉選單的選項，依建築與樓層用 <optgroup> 分組。放在 <Select> 裡面用。 */
import type { RoomOptionDto } from "@class/shared/core";

export function RoomOptions({
  rooms,
  showCapacity = false,
}: {
  rooms: RoomOptionDto[];
  /** 選項後面加「（50 人）」 */
  showCapacity?: boolean;
}) {
  const groups = Map.groupBy(rooms, (r) => `${r.building ?? "其他"} ${r.floorName ?? ""}`.trim());
  return [...groups].map(([group, list]) => (
    <optgroup key={group} label={group}>
      {list.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name.startsWith(r.code) ? r.name : `${r.code} ${r.name}`}
          {showCapacity && `（${r.capacity} 人）`}
        </option>
      ))}
    </optgroup>
  ));
}
