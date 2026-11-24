/**
 * 清掉 SPZ（高斯噴濺）裡過大的點。
 *
 *   node scripts/clean-spz.ts 輸入.spz 輸出.spz [--max-scale 0.2]
 *
 * 手機掃描常留下少數非常大的高斯點（天空、遠景、反光），在檢視器裡會變成蓋住畫面的大色塊。
 * 這支程式把任一軸尺寸超過 --max-scale（模型單位，預設 0.2）的點移除，其他資料原封不動。
 * 只支援 SPZ 第 2、3 版（Scaniverse、splat-transform 的輸出）。
 */
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";

const [input, output] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flag = process.argv.indexOf("--max-scale");
const maxScale = flag === -1 ? 0.2 : Number(process.argv[flag + 1]);
if (!input || !output || !(maxScale > 0)) {
  console.error("用法：node scripts/clean-spz.ts 輸入.spz 輸出.spz [--max-scale 0.2]");
  process.exit(1);
}

const data = gunzipSync(await readFile(input));
const magic = data.readUInt32LE(0);
const version = data.readUInt32LE(4);
const count = data.readUInt32LE(8);
const shDegree = data.readUInt8(12);
if (magic !== 0x5053474e) throw new Error("不是 SPZ 檔（magic 不符）");
if (version !== 2 && version !== 3) throw new Error(`不支援 SPZ 第 ${version} 版`);

const shBytes = ({ 0: 0, 1: 9, 2: 24, 3: 45 } as Record<number, number>)[shDegree];
if (shBytes === undefined) throw new Error(`不支援的球諧階數 ${shDegree}`);
// 第 3 版的旋轉是 4 bytes（smallest-three），第 2 版是 3 bytes
const sections: [name: string, bytesPerPoint: number][] = [
  ["position", 9],
  ["alpha", 1],
  ["color", 3],
  ["scale", 3],
  ["rotation", version === 3 ? 4 : 3],
  ["sh", shBytes],
];

let offset = 16;
const slices = sections.map(([name, size]) => {
  const buf = data.subarray(offset, offset + count * size);
  offset += count * size;
  return { name, size, buf };
});
if (offset !== data.length) throw new Error("檔案長度和標頭不符，可能已損毀");

// 尺寸以 8 bits 儲存：log(scale) = byte / 16 - 10
const limit = Math.round((Math.log(maxScale) + 10) * 16);
const scale = slices.find((s) => s.name === "scale")!.buf;
const keep: number[] = [];
for (let i = 0; i < count; i++) {
  if (Math.max(scale[3 * i], scale[3 * i + 1], scale[3 * i + 2]) <= limit) keep.push(i);
}

const header = Buffer.from(data.subarray(0, 16));
header.writeUInt32LE(keep.length, 8);
const parts = [header];
for (const { size, buf } of slices) {
  const out = Buffer.alloc(keep.length * size);
  keep.forEach((src, dst) => buf.copy(out, dst * size, src * size, (src + 1) * size));
  parts.push(out);
}
await writeFile(output, gzipSync(Buffer.concat(parts), { level: 9 }));
console.log(
  `保留 ${keep.length} / ${count} 點，移除 ${count - keep.length} 個大於 ${maxScale} 的點 -> ${output}`,
);
