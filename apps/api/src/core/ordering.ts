/** 共用排序：管理學院排在其他建築（例如教學大樓A）前面，其餘依名稱 */
import { sql, type AnyColumn } from "drizzle-orm";

export const MAIN_BUILDING = "管理學院";

export const mainBuildingFirst = (building: AnyColumn) =>
  sql`case when ${building} = ${MAIN_BUILDING} then 0 else 1 end`;
