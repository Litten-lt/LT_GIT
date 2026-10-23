import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<App current="about"><main className="hub-page about-page"><header className="hub-hero"><p>/ ABOUT THIS NOTEBOOK</p><h1>关于这本笔记<span>。</span></h1><p>我是 LongTeng，这里记录我在职业生涯中遇到的工作问题，以及处理它们的过程。</p></header><section className="reading-body"><h2>记录什么</h2><p>问题现象、排查依据、尝试过的办法、验证结果，以及后来补充的认识。也会记录与实际工作有关的学习和项目复盘。</p><h2>如何使用</h2><p>从首页按分类浏览，或搜索具体报错、工具和关键词。笔记会随着新的实践持续更新；复用其中的方法时，请结合文中环境和版本判断。</p><a href="/">浏览工作笔记 →</a></section></main></App>)
