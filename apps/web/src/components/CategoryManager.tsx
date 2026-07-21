import { useState } from 'react'
import { createCategory, deleteCategory, updateCategory, type Channel } from '../api'

export default function CategoryManager({ channels, reload }: { channels: Channel[]; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [channelId, setChannelId] = useState('journal')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState('')

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
    if (!confirm(`删除分类“${label}”？\n分类下的内容不会删除，将归入“其他”。`)) return
    setBusy(String(id))
    try { const result = await deleteCategory(id); await reload(); alert(result.affected ? `${result.affected} 条内容已归入“其他”` : '分类已删除') }
    catch (reason: any) { alert(reason.message || '删除失败') } finally { setBusy('') }
  }

  return <section className="category-manager">
    <header><div><span>/ TAXONOMY</span><h2>栏目与分类</h2><p>分类可以随时调整；删除分类不会删除内容。</p></div><button onClick={() => setOpen((value) => !value)}>{open ? '收起' : '管理分类'}</button></header>
    {open && <div className="category-body">
      <div className="category-columns">{channels.map((channel) => <div key={channel.id} className="category-channel"><div className="category-channel-head"><strong>{channel.name}</strong><span>{channel.categories.length} 个分类</span></div>
        <div className="category-list">{channel.categories.map((category, index) => <div key={category.id}><span>{category.name}</span><small>{category.legacy_type ? '初始分类' : '自定义'}</small><div><button disabled={index === 0 || Boolean(busy)} onClick={() => move(channel, index, -1)}>↑</button><button disabled={index === channel.categories.length - 1 || Boolean(busy)} onClick={() => move(channel, index, 1)}>↓</button><button disabled={Boolean(busy)} onClick={() => rename(category.id, category.name)}>改名</button><button disabled={Boolean(busy)} className="danger" onClick={() => remove(category.id, category.name)}>删除</button></div></div>)}
          <div className="category-other"><span>其他</span><small>未分类内容 · 系统保留</small></div>
        </div>
      </div>)}</div>
      <div className="category-create"><select value={channelId} onChange={(event) => setChannelId(event.target.value)}>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</select><input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add() }} placeholder="新分类名称" /><button disabled={!name.trim() || Boolean(busy)} onClick={add}>新增分类</button></div>
    </div>}
  </section>
}
