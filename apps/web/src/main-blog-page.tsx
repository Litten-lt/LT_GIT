import React from 'react'
import ReactDOM from 'react-dom/client'
import Blog from './pages/BlogPage'
import { ensurePublicSession } from './publicSession'
import './index.css'

ensurePublicSession().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Blog />
    </React.StrictMode>,
  )
})
