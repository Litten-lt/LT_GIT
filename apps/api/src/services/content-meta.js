const contentTables = Object.freeze({
  work: 'works',
  study: 'studies',
  figure: 'figures',
  travel: 'travels',
  note: 'notes',
})

const fallbackChannels = Object.freeze({
  work: 'journal', study: 'journal', figure: 'life', travel: 'life', note: 'life',
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
      .map((row) => ({ ...row, ...contentMeta(type, row.id), ...contentTaxonomy(type, row.id) }))
      .filter((row) => role === 'admin' || row.status === 'published')
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.created_at || 0) - Number(a.created_at || 0))
  }

  function contentExists(type, id) {
    const table = contentTables[type]
    return table ? Boolean(db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id)) : false
  }

  function contentTaxonomy(type, id) {
    return db.prepare(`
      SELECT
        t.channel_id,
        ch.slug AS channel_slug,
        ch.name AS channel_name,
        t.category_id,
        c.slug AS category_slug,
        c.name AS category_name
      FROM content_taxonomy t
      JOIN channels ch ON ch.id = t.channel_id
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.content_type = ? AND t.content_id = ?
    `).get(type, id) || {
      channel_id: fallbackChannels[type] || null,
      channel_slug: fallbackChannels[type] || null,
      channel_name: null,
      category_id: null,
      category_slug: null,
      category_name: null,
    }
  }

  return { contentMeta, decorateContent, contentExists, contentTaxonomy }
}
