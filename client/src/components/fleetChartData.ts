/**
 * Dựng dữ liệu cho FleetLineChart — tách khỏi component để test được không cần DOM.
 *
 * Vấn đề của cách cũ: grid X đều nhau dựng từ xMax dùng CHUNG cho cả 8 hệ.
 * Mỗi hệ vào mẻ lệch nhau vài phút, nên hệ vào muộn không có điểm ở các mốc
 * grid đầu và hệ kết thúc sớm không có điểm ở các mốc cuối → row nhận null,
 * connectNulls={false} nên tooltip tại mốc đó chỉ liệt kê một phần các hệ dù
 * legend vẫn hiện đủ 8.
 *
 * Cách mới: grid là HỢP các mốc phut thật của mọi hệ. Mốc nào cũng là mốc mà
 * ít nhất một hệ có điểm thật, và các hệ khác được nội suy tại đó nếu mốc nằm
 * trong khoảng dữ liệu của chúng. Nhờ vậy mọi hệ đang chạy đều có giá trị ở
 * vùng thời gian chúng thực sự chạy.
 */

export interface SeriesPoint {
  phut: number;
  value: number;
  stage: 1 | 2 | 3 | 4;
}

export interface SeriesInput {
  n: number;
  color: string;
  points: SeriesPoint[];
}

export type MergedRow = Record<string, number | null | undefined>;

/** Trần số row để chart không phải vẽ hàng nghìn điểm khi 8 hệ cùng chạy. */
export const MAX_GRID_ROWS = 400;

/**
 * Hợp các mốc phut của mọi hệ, sắp tăng dần, gộp mốc trùng nhau.
 * Nếu quá MAX_GRID_ROWS thì lấy mẫu đều — vẫn giữ mốc đầu và mốc cuối.
 */
export function buildGrid(series: SeriesInput[]): number[] {
  const set = new Set<number>();
  for (const s of series) {
    for (const p of s.points) {
      if (Number.isFinite(p.phut)) set.add(p.phut);
    }
  }
  const all = [...set].sort((a, b) => a - b);
  if (all.length <= MAX_GRID_ROWS) return all;

  const out: number[] = [];
  for (let i = 0; i < MAX_GRID_ROWS; i++) {
    out.push(all[Math.round((i * (all.length - 1)) / (MAX_GRID_ROWS - 1))]);
  }
  return [...new Set(out)];
}

/**
 * Giá trị nội suy của một hệ tại mốc t, hoặc null nếu t nằm ngoài khoảng dữ
 * liệu của hệ đó (hệ chưa vào mẻ, hoặc mẻ đã kết thúc trước mốc này).
 */
export function valueAt(points: SeriesPoint[], t: number): { value: number; stage: 1 | 2 | 3 | 4 } | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (t < first.phut || t > last.phut) return null;
  if (t === last.phut) return { value: last.value, stage: last.stage };

  // Tìm nhị phân cặp kẹp: points đã sắp tăng dần theo phut.
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].phut <= t) lo = mid;
    else hi = mid;
  }
  const left = points[lo];
  const right = points[hi];
  const denom = right.phut - left.phut;
  const value = denom === 0
    ? left.value
    : left.value + ((right.value - left.value) * (t - left.phut)) / denom;
  return { value, stage: left.stage };
}

export interface MergedResult {
  rows: MergedRow[];
  xMax: number;
  vMin: number;
  vMax: number;
  machines: Array<{ n: number; color: string }>;
}

/** Dựng toàn bộ dữ liệu chart từ các series đang hiển thị. */
export function buildMerged(series: SeriesInput[]): MergedResult {
  const machines = series.map((s) => ({ n: s.n, color: s.color }));
  const withPoints = series.filter((s) => s.points.length > 0);

  let xMax = 0;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const s of withPoints) {
    for (const p of s.points) {
      if (p.phut > xMax) xMax = p.phut;
      if (p.value < vMin) vMin = p.value;
      if (p.value > vMax) vMax = p.value;
    }
  }

  const grid = buildGrid(withPoints);
  const rows: MergedRow[] = grid.map((t) => {
    const row: MergedRow = { phut: t };
    for (const s of withPoints) {
      const hit = valueAt(s.points, t);
      row[`m${s.n}`] = hit ? hit.value : null;
      if (hit) row[`m${s.n}_stage`] = hit.stage;
    }
    return row;
  });

  return { rows, xMax, vMin, vMax, machines };
}
