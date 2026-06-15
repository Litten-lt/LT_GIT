// 前端 API 客户端

import { getToken, setAuth, clearAuth, type Role } from './auth'

const API_BASE = '/api'  // Nginx 反代到后端

// 重新导出 auth.ts 的工具,保持旧 import 不破坏
export { getToken, clearAuth as clearToken } from './auth'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
  }
  if (!(init.body instanceof FormData) && init.body) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(API_BASE + path, { ...init, headers })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  return data as T
}

// ---------- 认证 ----------
export type LoginResult = { token: string; role: Role; username: string }

export function login(username: string, password: string) {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function guestLogin() {
  return request<LoginResult>('/auth/guest', { method: 'POST' })
}

export function logout() {
  clearAuth()
}

export function me() {
  return request<{ username: string; role: 'admin' | 'guest' }>('/auth/me')
}

// ---------- 手办 ----------
export type Figure = {
  id: number
  name: string
  brand?: string
  description: string
  date: string
  images: string[]  // 完整 URL
}

export function listFigures() {
  return request<{ figures: Figure[] }>('/figures')
}

export function createFigure(payload: {
  name: string
  brand?: string
  description: string
  images: string[]  // 文件名数组 (相对路径,不含 /data/figures/)
  date?: string
}) {
  return request<{ id: number }>('/figures', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteFigure(id: number) {
  return request<{ ok: true }>(`/figures/${id}`, { method: 'DELETE' })
}

export function updateFigure(
  id: number,
  payload: {
    name?: string
    brand?: string
    description?: string
    images?: string[]  // 文件名数组(不含 /data/figures/)
  },
) {
  return request<{ ok: true; deletedFiles: number }>(`/figures/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// 上传单张图片
export function uploadImage(file: File): Promise<{ url: string; filename: string }> {
  const fd = new FormData()
  fd.append('file', file)
  return request<{ url: string; filename: string }>('/upload', {
    method: 'POST',
    body: fd,
  })
}

// 从完整 URL 提取文件名 (用于删除时)
export function filenameFromUrl(url: string): string {
  return url.split('/').pop() || ''
}