const contentTables = Object.freeze({
  work: 'works',
  study: 'studies',
  figure: 'figures',
  travel: 'travels',
  note: 'notes',
})

export const CONTENT_TYPES = new Set(Object.keys(contentTables))

export function createContentMetaService(db) {
  function contentMeta(type, id) {
    return db.prepare(`
      SELECT status, featured, pinned, updated_at AS state_updated_at
      FROM content_meta WHERE content_type = ? AND content_id = ?
    `).get(type, id) || { status: 'published', featured: 0, pinned: 0, state_updated_at: 0 }
  }

  function decorateContent(rows, type, role) {
    return rows
      .map((row) => ({ ...row, ...contentMeta(type, row.id) }))
      .filter((row) => role === 'admin' || row.status === 'published')
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.created_at || 0) - Number(a.created_at || 0))
  }

  function contentExists(type, id) {
    const table = contentTables[type]
    return table ? Boolean(db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id)) : false
  }

  return { contentMeta, decorateContent, contentExists }
}
