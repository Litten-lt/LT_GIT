import React from 'react'
import ReactDOM from 'react-dom/client'
import LifeHub from './pages/LifeHub'
import { ensurePublicSession } from './publicSession'
import './index.css'

ensurePublicSession().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><LifeHub /></React.StrictMode>,
  )
})
