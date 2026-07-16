import React from 'react'
import ReactDOM from 'react-dom/client'
import Life from './pages/Life'
import { ensurePublicSession } from './publicSession'
import { redirectLegacyVisitor } from './legacyRedirect'
import './index.css'

ensurePublicSession().finally(() => {
  if (redirectLegacyVisitor('note')) return
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Life />
    </React.StrictMode>,
  )
})
