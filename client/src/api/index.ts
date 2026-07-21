import type { BatchListItem, BatchDocument } from '../types';

export async function getNoiChien(n: number): Promise<BatchListItem[]> {
  const res = await fetch(`/get_noi_chien?so_noiChien=${n}`);
  return res.json();
}

export async function getNoiChienDetail(id: string, n: number): Promise<BatchDocument> {
  const res = await fetch(`/get_noi_chien_detail?id=${id}&so_noiChien=${n}`);
  return res.json();
}

export async function xoaNoiChienDetail(id: string, n: number): Promise<{ success: boolean }> {
  const res = await fetch(`/xoa_noi_chien_detail?id=${id}&so_noiChien=${n}`, {
    method: 'DELETE',
  });
  return res.json();
}
