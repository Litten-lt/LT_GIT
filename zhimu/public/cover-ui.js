import {escapeHtml as e} from './tree.js'
export function coverAccount(admin){
  return '<nav class="cover-account" aria-label="封面账户">'+(admin?'<a href="?view=account&return=cover" title="账号设置"><span class="account-dot" aria-hidden="true"></span>'+e(admin.username)+'</a><button type="button" id="cover-logout">退出</button>':'<a class="cover-login" href="?view=login&return=cover">登录 <span aria-hidden="true">↗</span></a>')+'</nav>'
}
