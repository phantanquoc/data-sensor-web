import type { BatchListItem, BatchDocument } from '../types';

interface BatchListFilters {
  from?: string;
  to?: string;
}

async function readJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export async function getNoiChien(n: number, filters: BatchListFilters = {}): Promise<BatchListItem[]> {
  const params = new URLSearchParams({ so_noiChien: String(n) });
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return readJson<BatchListItem[]>(await fetch(`/get_noi_chien?${params.toString()}`));
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
