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
export type ContentState = { status: 'draft' | 'published'; featured: number; pinned: number; updated_at?: number }

export type Figure = ContentState & {
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

// ---------- 旅行 ----------
export type Travel = ContentState & {
  id: number
  title: string
  location?: string
  description: string
  date: string
  images: string[]  // 完整 URL
}

export function listTravels() {
  return request<{ travels: Travel[] }>('/travels')
}

export function createTravel(payload: {
  title: string
  location?: string
  description: string
  images: string[]
  date?: string
}) {
  return request<{ id: number }>('/travels', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteTravel(id: number) {
  return request<{ ok: true }>(`/travels/${id}`, { method: 'DELETE' })
}

export function updateTravel(
  id: number,
  payload: {
    title?: string
    location?: string
    description?: string
    images?: string[]
  },
) {
  return request<{ ok: true; deletedFiles: number }>(`/travels/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ---------- 生活笔记 ----------
export type Note = ContentState & {
  id: number
  title: string
  scene?: string
  description: string
  date: string
  images: string[]  // 完整 URL
}

export function listNotes() {
  return request<{ notes: Note[] }>('/notes')
}

export function createNote(payload: {
  title: string
  scene?: string
  description: string
  images: string[]
  date?: string
}) {
  return request<{ id: number }>('/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteNote(id: number) {
  return request<{ ok: true }>(`/notes/${id}`, { method: 'DELETE' })
}

export function updateNote(
  id: number,
  payload: {
    title?: string
    scene?: string
    description?: string
    images?: string[]
  },
) {
  return request<{ ok: true; deletedFiles: number }>(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ---------- 工作(调试记录) ----------
export type Work = ContentState & {
  id: number
  title: string
  description?: string
  date: string
  created_at: number
  updated_at: number
  note_count: number
  // 仅详情
  notes?: WorkNote[]
}

export type WorkNote = {
  id: number
  work_id: number
  content?: string
  images: string[]  // 完整 URL
  created_at: number
}

export function listWorks() {
  return request<{ works: Work[] }>('/works')
}

export function getWork(id: number) {
  return request<{ work: Work }>(`/works/${id}`)
}

export function createWork(payload: {
  title: string
  description?: string
}) {
  return request<{ id: number }>('/works', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteWork(id: number) {
  return request<{ ok: true }>(`/works/${id}`, { method: 'DELETE' })
}

export function updateWork(
  id: number,
  payload: {
    title?: string
    description?: string
  },
) {
  return request<{ ok: true }>(`/works/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ---------- work_notes (说明/调查流) ----------
export function addWorkNote(
  workId: number,
  payload: { content: string; files: File[] },
) {
  const fd = new FormData()
  fd.append('content', payload.content)
  for (const f of payload.files) fd.append('images', f)
  return request<{ id: number; images: string[] }>(`/works/${workId}/notes`, {
    method: 'POST',
    body: fd,
  })
}

export function updateWorkNote(
  workId: number,
  noteId: number,
  payload: { content: string; files: File[] },
) {
  const fd = new FormData()
  fd.append('content', payload.content)
  for (const f of payload.files) fd.append('images', f)
  return request<{ ok: true; images: string[] }>(
    `/works/${workId}/notes/${noteId}`,
    { method: 'PUT', body: fd },
  )
}

export function deleteWorkNote(workId: number, noteId: number) {
  return request<{ ok: true }>(`/works/${workId}/notes/${noteId}`, {
    method: 'DELETE',
  })
}

// ---------- 学习笔记 (studies / study_notes) ----------
export type Study = ContentState & {
  id: number
  title: string
  description?: string
  date: string
  created_at: number
  updated_at: number
  note_count: number
  notes?: StudyNote[]
}

export type StudyNote = {
  id: number
  study_id: number
  content?: string
  images: string[]  // 完整 URL
  created_at: number
}

export function listStudies() {
  return request<{ studies: Study[] }>('/studies')
}

export function getStudy(id: number) {
  return request<{ study: Study }>(`/studies/${id}`)
}

export function createStudy(payload: {
  title: string
  description?: string
}) {
  return request<{ id: number }>('/studies', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteStudy(id: number) {
  return request<{ ok: true }>(`/studies/${id}`, { method: 'DELETE' })
}

export function updateStudy(
  id: number,
  payload: {
    title?: string
    description?: string
  },
) {
  return request<{ ok: true }>(`/studies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ---------- study_notes ----------
// 学习笔记 notes 不带图片(用户 2026-07-10 拍板),只存 markdown content
export function addStudyNote(
  studyId: number,
  payload: { content: string },
) {
  const fd = new FormData()
  fd.append('content', payload.content)
  return request<{ id: number; images: string[] }>(`/studies/${studyId}/notes`, {
    method: 'POST',
    body: fd,
  })
}

export function updateStudyNote(
  studyId: number,
  noteId: number,
  payload: { content: string },
) {
  const fd = new FormData()
  fd.append('content', payload.content)
  return request<{ ok: true; images: string[] }>(
    `/studies/${studyId}/notes/${noteId}`,
    { method: 'PUT', body: fd },
  )
}

export function deleteStudyNote(studyId: number, noteId: number) {
  return request<{ ok: true }>(`/studies/${studyId}/notes/${noteId}`, {
    method: 'DELETE',
  })
}
// ---------- 统一内容管理 ----------
export type ContentType = 'work' | 'study' | 'figure' | 'travel' | 'note'
export type AdminContentItem = ContentState & {
  type: ContentType
  id: number
  title: string
  date: string
  created_at: number
}

export function listAdminContent() {
  return request<{ items: AdminContentItem[] }>('/admin/content')
}

export function updateContentState(
  type: ContentType,
  id: number,
  patch: Partial<Pick<ContentState, 'status' | 'featured' | 'pinned'>>,
) {
  return request<{ ok: true; status: 'draft' | 'published'; featured: number; pinned: number }>(`/admin/content/${type}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
