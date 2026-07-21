import React from 'react'
import ReactDOM from 'react-dom/client'
import SearchHub from './pages/SearchHub'
import { ensurePublicSession } from './publicSession'
import './index.css'

ensurePublicSession().finally(() => ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><SearchHub /></React.StrictMode>))
