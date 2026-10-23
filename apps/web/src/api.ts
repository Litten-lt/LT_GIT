// 前端 API 客户端

const API_BASE = '/api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
  }
  if (!(init.body instanceof FormData) && init.body) {
    headers['Content-Type'] = 'application/json'
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

// ---------- 内容与分类 ----------
export type ContentTaxonomy = {
  channel_id?: string | null
  channel_slug?: string | null
  channel_name?: string | null
  category_id?: number | null
  category_slug?: string | null
  category_name?: string | null
}

export type ContentState = ContentTaxonomy & { status: 'draft' | 'published'; featured: number; pinned: number; updated_at?: number }

export type Category = {
  id: number
  channel_id: string
  slug: string
  name: string
  description?: string
  sort_order: number
  legacy_type?: ContentType | null
  content_count?: number
}

export type Channel = {
  id: string
  slug: string
  name: string
  description?: string
  sort_order: number
  categories: Category[]
}

export function listTaxonomy() {
  return request<{ channels: Channel[] }>('/taxonomy')
}

export type UnifiedNote = { id: number; body: string; images: string[]; created_at: number; updated_at: number }
export type UnifiedContent = {
  tags?: string[]
  problem_status?: 'record' | 'investigating' | 'resolved' | 'pending'
  id: number
  channel_id: 'journal'
  channel_name: string
  category_id: number | null
  category_slug?: string | null
  category_name?: string | null
  format: 'article' | 'gallery'
  title: string
  subtitle?: string | null
  body: string
  images: string[]
  date: string
  status: 'draft' | 'published'
  featured: number
  pinned: number
  publish_at?: number | null
  deleted_at?: number | null
  note_count: number
  created_at: number
  updated_at: number
  legacy_type?: ContentType | null
  legacy_id?: number | null
  notes?: UnifiedNote[]
}

export function listContents(channel?: 'journal', includeDeleted = false, summary = false, query = '') {
  const params = new URLSearchParams(); if (summary) params.set('summary', '1'); if (query.trim()) params.set('q', query.trim()); if (channel) params.set('channel', channel); if (includeDeleted) params.set('include_deleted', '1')
  return request<{ contents: UnifiedContent[] }>(`/contents${params.size ? `?${params}` : ''}`)
}
export function getContent(id: number) { return request<{ content: UnifiedContent }>(`/contents/${id}`) }
export function createContent(payload: Partial<UnifiedContent> & Pick<UnifiedContent, 'channel_id' | 'format' | 'title' | 'body' | 'images'>) {
  return request<{ id: number }>('/contents', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateContent(id: number, payload: Partial<UnifiedContent>) { return request<{ ok: true }>(`/contents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteContent(id: number) { return request<{ ok: true }>(`/contents/${id}`, { method: 'DELETE' }) }
export function restoreContent(id: number) { return request<{ ok: true }>(`/contents/${id}/restore`, { method: 'POST' }) }
export function deleteContentPermanently(id: number) { return request<{ ok: true }>(`/contents/${id}/permanent`, { method: 'DELETE' }) }
export type ContentRevision = { id: number; created_at: number; title: string; subtitle?: string | null; body: string }
export function listContentRevisions(id: number) { return request<{ revisions: ContentRevision[] }>(`/contents/${id}/revisions`) }
export function restoreContentRevision(id: number, revisionId: number) { return request<{ ok: true }>(`/contents/${id}/revisions/${revisionId}/restore`, { method: 'POST' }) }
export function addContentNote(contentId: number, body: string, files: File[] = []) { const fd = new FormData(); fd.append('body', body); files.forEach((file) => fd.append('images', file)); return request<{ id: number }>(`/contents/${contentId}/notes`, { method: 'POST', body: fd }) }
export function updateContentNote(contentId: number, noteId: number, body: string) { return request<{ ok: true }>(`/contents/${contentId}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ body }) }) }
export function deleteContentNote(contentId: number, noteId: number) { return request<{ ok: true }>(`/contents/${contentId}/notes/${noteId}`, { method: 'DELETE' }) }
export type ContentNoteDraft = { body: string; updated_at: number }
export function getContentNoteDraft(contentId: number) { return request<{ draft: ContentNoteDraft | null }>(`/contents/${contentId}/note-draft`) }
export function saveContentNoteDraft(contentId: number, body: string) { return request<{ draft: ContentNoteDraft }>(`/contents/${contentId}/note-draft`, { method: 'PUT', body: JSON.stringify({ body }) }) }
export function deleteContentNoteDraft(contentId: number) { return request<{ ok: true }>(`/contents/${contentId}/note-draft`, { method: 'DELETE' }) }

export function createCategory(payload: { channel_id: string; name: string; description?: string }) {
  return request<{ category: Category }>('/admin/categories', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateCategory(id: number, patch: { name?: string; description?: string; sort_order?: number }) {
  return request<{ category: Category }>(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteCategory(id: number, moveTo: number | null = null) {
  return request<{ ok: true; affected: number; moved_to: number | null }>(`/admin/categories/${id}`, { method: 'DELETE', body: JSON.stringify({ move_to: moveTo }) })
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

export type ContentType = 'work' | 'study' | 'figure' | 'travel' | 'note'
