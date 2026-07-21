import { useState } from 'react'
import { createCategory, deleteCategory, updateCategory, type Channel } from '../api'

export default function CategoryManager({ channels, reload }: { channels: Channel[]; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [channelId, setChannelId] = useState('journal')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [moveTo, setMoveTo] = useState('')

  async function add() {
    if (!name.trim()) return
    setBusy('new')
    try { await createCategory({ channel_id: channelId, name: name.trim() }); setName(''); await reload() }
    catch (reason: any) { alert(reason.message || '新增分类失败') } finally { setBusy('') }
  }
  async function rename(id: number, current: string) {
    const next = prompt('修改分类名称', current)?.trim()
    if (!next || next === current) return
    setBusy(String(id)); try { await updateCategory(id, { name: next }); await reload() } catch (reason: any) { alert(reason.message || '修改失败') } finally { setBusy('') }
  }
  async function move(channel: Channel, index: number, delta: number) {
    const target = channel.categories[index + delta]
    const current = channel.categories[index]
    if (!target) return
    setBusy(String(current.id))
    try { await Promise.all([updateCategory(current.id, { sort_order: target.sort_order }), updateCategory(target.id, { sort_order: current.sort_order })]); await reload() }
    catch (reason: any) { alert(reason.message || '排序失败') } finally { setBusy('') }
  }
  async function remove(id: number, label: string) {
    const targetId = moveTo ? Number(moveTo) : null
    const targetName = channels.flatMap((item) => item.categories).find((item) => item.id === targetId)?.name || '其他'
    if (!confirm(`删除分类“${label}”？\n该分类下的内容将转移到“${targetName}”。`)) return
    setBusy(String(id))
    try { const result = await deleteCategory(id, targetId); await reload(); setDeleting(null); setMoveTo(''); alert(result.affected ? `${result.affected} 条内容已转移到“${targetName}”` : '分类已删除') }
    catch (reason: any) { alert(reason.message || '删除失败') } finally { setBusy('') }
  }

  return <section className="category-manager">
    <header><div><span>/ TAXONOMY</span><h2>栏目与分类</h2><p>分类可以随时调整；删除分类不会删除内容。</p></div><button onClick={() => setOpen((value) => !value)}>{open ? '收起' : '管理分类'}</button></header>
    {open && <div className="category-body">
      <div className="category-columns">{channels.map((channel) => <div key={channel.id} className="category-channel"><div className="category-channel-head"><strong>{channel.name}</strong><span>{channel.categories.length} 个分类</span></div>
        <div className="category-list">{channel.categories.map((category, index) => <div key={category.id}><span>{category.name}</span><small>{category.content_count || 0} 条内容 · {category.legacy_type ? '初始分类' : '自定义'}</small>{deleting === category.id ? <div className="category-delete-choice"><select value={moveTo} onChange={(event) => setMoveTo(event.target.value)}><option value="">转移到：其他（未分类）</option>{channel.categories.filter((item) => item.id !== category.id).map((item) => <option key={item.id} value={item.id}>转移到：{item.name}</option>)}</select><button disabled={Boolean(busy)} className="danger" onClick={() => remove(category.id, category.name)}>确认删除</button><button onClick={() => { setDeleting(null); setMoveTo('') }}>取消</button></div> : <div><button disabled={index === 0 || Boolean(busy)} onClick={() => move(channel, index, -1)}>↑</button><button disabled={index === channel.categories.length - 1 || Boolean(busy)} onClick={() => move(channel, index, 1)}>↓</button><button disabled={Boolean(busy)} onClick={() => rename(category.id, category.name)}>改名</button><button disabled={Boolean(busy)} className="danger" onClick={() => { setDeleting(category.id); setMoveTo('') }}>删除</button></div>}</div>)}
          <div className="category-other"><span>其他</span><small>未分类内容 · 系统保留</small></div>
        </div>
      </div>)}</div>
      <div className="category-create"><select value={channelId} onChange={(event) => setChannelId(event.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select><input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add() }} placeholder="新分类名称" /><button disabled={!name.trim() || Boolean(busy)} onClick={add}>新增分类</button></div>
    </div>}
  </section>
}
