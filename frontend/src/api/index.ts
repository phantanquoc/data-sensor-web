import type { BatchListItem, BatchDocument, ThongKe } from '../types';

interface BatchListFilters {
  from?: string;
  to?: string;
}

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (res.status === 401) {
    // Phiên hết hạn / chưa đăng nhập → về trang login, không nuốt lỗi âm thầm.
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new Error('Chưa đăng nhập');
  }
  if (!res.ok) {
    const message = body && typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

// ===== Xác thực =====
export async function login(username: string, password: string): Promise<{ success: boolean; username: string }> {
  return readJson(await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }));
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' });
}

// Không dùng readJson (nó redirect khi 401) — ở đây 401 là câu trả lời hợp lệ.
export async function getMe(): Promise<{ authenticated: boolean; username?: string }> {
  const res = await fetch('/api/me');
  if (res.status === 401) return { authenticated: false };
  return res.json();
}

export async function getNoiChien(n: number, filters: BatchListFilters = {}): Promise<BatchListItem[]> {
  const params = new URLSearchParams({ so_noiChien: String(n) });
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return readJson<BatchListItem[]>(await fetch(`/get_noi_chien?${params.toString()}`));
}

export async function getThongKe(
  filters: BatchListFilters = {},
  may?: number,
): Promise<ThongKe> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (may != null) params.set('may', String(may));
  const qs = params.toString();
  return readJson<ThongKe>(await fetch(`/thong_ke${qs ? `?${qs}` : ''}`));
}

export async function getNoiChienDetail(id: string, n: number): Promise<BatchDocument> {
  return readJson<BatchDocument>(await fetch(`/get_noi_chien_detail?id=${encodeURIComponent(id)}&so_noiChien=${n}`));
}

export async function suaNoiChienDetail(
  id: string,
  n: number,
  data: { ma_me_chien: string; ghi_chu: string },
): Promise<BatchListItem> {
  return readJson<BatchListItem>(await fetch(`/sua_noi_chien_detail?id=${encodeURIComponent(id)}&so_noiChien=${n}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export async function xoaNoiChienDetail(id: string, n: number): Promise<{ success: boolean }> {
  return readJson<{ success: boolean }>(await fetch(`/xoa_noi_chien_detail?id=${encodeURIComponent(id)}&so_noiChien=${n}`, {
    method: 'DELETE',
  }));
}

/** Lightweight chart projection — only timestamps + temperature + pressure per stage */
export async function getNoiChienChart(id: string, n: number): Promise<{
  thoi_gian_start?: string;
  thoi_gian_start_at?: string;
  giai_doan_1?: { bien_du_lieu?: Array<{ thoi_gian?: string; nhiet_do?: number; ap_suat_chan_khong?: number }> };
  giai_doan_2?: { bien_du_lieu?: Array<{ thoi_gian?: string; nhiet_do?: number; ap_suat_chan_khong?: number }> };
  giai_doan_3?: { bien_du_lieu?: Array<{ thoi_gian?: string; nhiet_do?: number; ap_suat_chan_khong?: number }> };
  giai_doan_4?: { bien_du_lieu?: Array<{ thoi_gian?: string; nhiet_do?: number; ap_suat_chan_khong?: number }> };
}> {
  return readJson(await fetch(`/get_noi_chien_chart?id=${encodeURIComponent(id)}&so_noiChien=${n}`));
}
