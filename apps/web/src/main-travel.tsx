import { ensurePublicSession } from './publicSession'
import { redirectLegacyVisitor } from './legacyRedirect'
import './index.css'

ensurePublicSession().finally(() => redirectLegacyVisitor('travel'))
