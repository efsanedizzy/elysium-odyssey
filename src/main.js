import { CHAIN, QUESTS, QUIZ, levelFromXP, levelFloor, formatAddress, EXPLORER_URL, DOCS_URL, ECOSYSTEM_URL, X_PROFILE_URL, dailyStatus, SOCIAL_PROFILES, weeklyStatus, explorerBadges } from './constants.js';

import { ensureElysiumNetwork } from './wallet.js';

const $ = sel => document.querySelector(sel);
const app = $('#app');
const state = {
  tab: 'dashboard', filter: 'all', modal: null, user: null, demo: false,
  quests: QUESTS.map(q=>({...q, completed:false})),
  leaderboard: [], totalAdventurers: 0, busy: false,
  xEnabled: false, xAccount: null, networkOk: null, selectedQuest: null, quizAnswers: {}, txHash: '',
};
const demoKey = 'odyssey-demo-v1';
function freshDemo() { return {xp:0,completions:{},dailyDates:[],activity:[],joinDate:Date.now()}; }
function demoUser() {
  let d;try {d=JSON.parse(localStorage.getItem(demoKey)||'null')||freshDemo();}catch{d=freshDemo();}
  return {...d,address:'DEMO',level:levelFromXP(d.xp)};
}
function saveDemo() {localStorage.setItem(demoKey,JSON.stringify(state.user));}
function todayUTC() {return new Date().toISOString().slice(0,10);}
function cleanHTML(s) {return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function icon(name,size=20) {
  const paths={
    compass:'<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.8 5.6-5.6 2.8 2.8-5.6 5.6-2.8z"/>',
    sparkles:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z"/>',
    'book-open':'<path d="M12 7v14m0-14C9 4.5 5 4 2 5v14c3-1 7-.5 10 2m0-14c3-2.5 7-3 10-2v14c-3-1-7-.5-10 2"/>',
    sunrise:'<path d="M12 2v2M4.9 4.9l1.4 1.4M19.1 4.9l-1.4 1.4M2 17h20M4 21h16M7 17a5 5 0 0 1 10 0"/>',
    zap:'<path d="m13 2-9 12h7l-1 8 10-12h-7l0-8z"/>',
    trophy:'<path d="M8 21h8m-4-4v4M7 3h10v7a5 5 0 0 1-10 0V3ZM7 5H4v4a4 4 0 0 0 4 4m9-8h3v4a4 4 0 0 1-4 4"/>',
    home:'<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
    arrowUp:'<path d="M7 17 17 7M8 7h9v9"/>',
    wallet:'<rect x="2" y="5" width="20" height="16" rx="3"/><path d="M2 9V5a3 3 0 0 1 3-3h13v3m4 6h-6a2 2 0 0 0 0 4h6"/>',
    check:'<path d="m5 12 5 5 9-10"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>',
    link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.7 1.7m2.7 6.3a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    x:'<path d="M18 6 6 18M6 6l12 12"/>',
    flame:'<path d="M12 22c-4.5 0-7-3-7-7 0-2.9 1.9-5.5 5-8 .2 2.4 1.4 4 2 4 1-1 3-4 2-9 4 3 5 7 5 11 0 5-3 9-7 9z"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    star:'<path d="m12 2 3 6.4 7 1-5 5 1.2 7L12 18l-6.2 3.4 1.2-7-5-5 7-1L12 2Z"/>',
    gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>',
    coins:'<circle cx="12" cy="12" r="9"/><path d="M12 6v12m-3-3c1 1 5 1 6-.4 2-2-1-3-3-3s-5-1-3-3c1-1.2 5-1.2 6 0"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.star}</svg>`;
}
function brandMark(size=40){return `<svg width="${size}" height="${size}" viewBox="0 0 459 464" fill="none" aria-hidden="true"><g fill="#FFFFFF"><path d="M 73 240 L 55 256 L 35 276 L 25 288 L 15 303 L 6 324 L 4 336 L 3 337 L 3 343 L 2 344 L 2 462 L 4 462 L 8 458 L 36 439 L 69 421 L 72 418 L 75 412 L 75 242 Z"/><path d="M 386 239 L 384 243 L 384 409 L 385 410 L 385 413 L 390 420 L 428 441 L 457 461 L 457 338 L 456 337 L 454 323 L 445 302 L 434 286 L 391 242 Z"/><path d="M 230 191 L 229 198 L 224 213 L 217 228 L 208 241 L 197 252 L 186 260 L 170 268 L 157 272 L 154 274 L 151 274 L 142 277 L 138 277 L 161 284 L 178 292 L 193 302 L 207 316 L 213 325 L 223 348 L 223 351 L 227 364 L 227 369 L 228 370 L 230 391 L 232 374 L 233 373 L 233 369 L 234 368 L 234 364 L 235 363 L 237 352 L 243 335 L 248 325 L 255 315 L 269 301 L 286 290 L 299 284 L 314 279 L 321 278 L 321 277 L 313 276 L 290 268 L 278 262 L 259 248 L 252 241 L 243 228 L 236 213 Z"/><path d="M 285 82 L 272 96 L 271 101 L 273 103 L 285 107 L 307 118 L 321 127 L 341 143 L 364 168 L 376 186 L 386 204 L 401 224 L 456 279 L 457 277 L 457 233 L 456 232 L 456 223 L 455 222 L 453 207 L 446 185 L 435 162 L 426 148 L 415 134 L 398 117 L 384 106 L 367 95 L 346 85 L 325 78 L 321 78 L 315 76 L 309 76 L 308 75 L 296 76 Z"/><path d="M 174 82 L 162 76 L 150 75 L 149 76 L 144 76 L 143 77 L 138 77 L 137 78 L 130 79 L 115 84 L 101 91 L 99 91 L 97 93 L 80 102 L 65 113 L 46 131 L 34 146 L 25 160 L 14 182 L 13 187 L 8 199 L 8 202 L 5 211 L 5 215 L 4 216 L 3 228 L 2 229 L 2 281 L 62 220 L 76 200 L 94 170 L 113 148 L 125 137 L 144 123 L 154 117 L 170 109 L 182 105 L 188 101 L 188 98 L 185 93 Z"/><path d="M 230 2 L 223 17 L 214 30 L 198 46 L 185 55 L 193 60 L 204 69 L 214 80 L 222 92 L 230 110 L 232 103 L 238 91 L 247 78 L 261 64 L 271 57 L 274 56 L 273 54 L 259 44 L 247 32 L 237 18 Z"/></g></svg>`;}
function worldArtwork() {return `<svg class="hero-art" viewBox="0 0 430 385" fill="none" aria-hidden="true">
 <defs><linearGradient id="a" x1="74" y1="78" x2="350" y2="345"><stop stop-color="#E5C5FF"/><stop offset=".5" stop-color="#8D6DDF"/><stop offset="1" stop-color="#44357E"/></linearGradient><linearGradient id="b" x1="190" y1="30" x2="260" y2="330"><stop stop-color="#A5B1FF"/><stop offset="1" stop-color="#453D8C"/></linearGradient><radialGradient id="c"><stop stop-color="#A88AFF" stop-opacity=".35"/><stop offset="1" stop-color="#A88AFF" stop-opacity="0"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="16"/></filter></defs>
 <circle cx="214" cy="200" r="164" fill="url(#c)"/>
 <g stroke="#786BBE" stroke-opacity=".28"><circle cx="216" cy="188" r="126"/><circle cx="216" cy="188" r="162"/><circle cx="216" cy="188" r="96"/><path d="M32 188h368M216 8v359" stroke-dasharray="3 9"/></g>
 <ellipse cx="215" cy="197" rx="172" ry="53" transform="rotate(-31 215 197)" stroke="#B89CFA" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="5 8"/>
 <g class="art-float"><path d="M215 53 295 174 215 319 135 174 215 53Z" fill="url(#a)" opacity=".14" stroke="#D4BDFF" stroke-width="2"/><path d="m215 74 64 103-64 117-64-117L215 74Z" fill="url(#b)" opacity=".46"/><path d="m215 79 52 96-52 102-51-102 51-96Z" fill="#14162E" stroke="#C8A8FF" stroke-width="2"/><path d="m215 94 33 82-33 78-34-78 34-82Z" fill="url(#a)"/><path d="m215 100 0 151-33-74Z" fill="#E1D3FF" opacity=".58"/><path d="M215 93v164M181 176h68" stroke="#FFFAFF" stroke-opacity=".7" stroke-width="1.3"/><path d="m215 135 15 40-15 37-15-37 15-40Z" fill="#E6DBFF"/><path d="m215 151 7 23-7 22-7-22Z" fill="#FFF"/></g>
 <path d="m96 99 5 10 10 5-10 4-5 10-4-10-10-4 10-5 4-10Z" fill="#DCCBFF"/><path d="m328 95 3 6 7 3-7 3-3 7-3-7-7-3 7-3 3-6Z" fill="#C0B0FF"/><circle cx="345" cy="276" r="3" fill="#B4A5FB"/><circle cx="85" cy="259" r="2" fill="#DED2FF"/>
 <g><rect x="27" y="221" width="114" height="42" rx="12" fill="#17182F" stroke="#5B4F88"/><circle cx="47" cy="242" r="9" fill="#AB92F6" fill-opacity=".2" stroke="#AC92FF"/><path d="m43 242 3 3 6-6" stroke="#DACDFF" stroke-width="1.5"/><text x="65" y="246" font-family="Arial" font-size="11" font-weight="bold" fill="#D9CFFF">+160 XP</text></g>
 <g><rect x="305" y="129" width="112" height="43" rx="12" fill="#17182F" stroke="#5B4F88"/><circle cx="326" cy="150" r="10" fill="#AB92F6" fill-opacity=".2"/><path d="m326 141 3 6 7 2-6 4 1 6-5-3-5 3 1-6-6-4 7-2 3-6Z" stroke="#CDBAFF" stroke-width="1.5"/><text x="344" y="154" font-family="Arial" font-size="10" font-weight="bold" fill="#D9CFFF">LEVEL UP</text></g>
 </svg>`;}
async function request(path,method='GET',data) {
  const options={method,headers:data?{'content-type':'application/json'}:{},credentials:'same-origin'};
  if(data)options.body=JSON.stringify(data);
  let response;try{response=await fetch(path,options);}catch{throw new Error('Cannot reach Odyssey server. Make sure it is running.');}
  let payload;try{payload=await response.json();}catch{throw new Error('Unexpected server response.');}
  if(!response.ok)throw new Error(payload.error||'Request failed.');
  return payload;
}
function toast(message,type='success') {
  const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=`${icon(type==='success'?'check':'info',18)}<span>${cleanHTML(message)}</span>`;
  $('#toast-layer').append(el);setTimeout(()=>el.remove(),4200);
}
async function refresh() {
  try{
    const [me,quests,leaderboard,x]=await Promise.all([request('/api/me'),request('/api/quests'),request('/api/leaderboard'),request('/api/x/status')]);
    state.xEnabled=x.enabled;state.xAccount=x.account;
    if(!state.demo)state.user=me.user;
    state.quests=state.demo?viewDemoQuests():quests.quests;
    state.leaderboard=leaderboard.users;state.totalAdventurers=leaderboard.totalAdventurers;
  }catch(e){toast(e.message,'error');}
  render();
}
function viewDemoQuests() {
  const u=state.user;
  return QUESTS.map(q=>({...q,xp:q.kind==='daily'?dailyStatus(u.dailyDates).reward:q.xp,completed:q.kind==='daily'?u.dailyDates.includes(todayUTC()):!!u.completions[q.id]}));
}
function doDemoAward(q) {
  const u=state.user;
  if(q.kind==='daily') {if(u.dailyDates.includes(todayUTC()))throw new Error('You checked in today already.');u.dailyDates.push(todayUTC());}
  else {if(u.completions[q.id])throw new Error('Quest already completed.');u.completions[q.id]=Date.now();}
  const reward=q.kind==='daily'?dailyStatus(u.dailyDates.filter(d=>d!==todayUTC())).reward:q.xp;
  u.xp+=reward;u.level=levelFromXP(u.xp);
  u.activity=[{questId:q.id,xp:reward,title:q.name,at:Date.now()},...(u.activity||[])].slice(0,60);
  saveDemo();state.quests=viewDemoQuests();
}
function currentLevel(){return levelFromXP(state.user?.xp||0);}
function xpProgress(){const xp=state.user?.xp||0,lvl=currentLevel();return Math.round((xp-levelFloor(lvl))/(levelFloor(lvl+1)-levelFloor(lvl))*100)||0;}
function rank(){const address=state.user?.address?.toLowerCase();if(!address||state.demo)return null;return state.leaderboard.find(x=>x.address.toLowerCase()===address)?.rank||null;}
function completeCount(){return state.quests.filter(q=>q.completed).length;}
function caption(){return state.demo?'Demo explorer':state.user?formatAddress(state.user.address):'Unconnected explorer';}
function sidebar() {return `<aside class="sidebar">
  <div class="side-brand"><div class="brand-symbol">${brandMark(44)}</div><div><b>ELYSIUM</b><span>ODYSSEY</span></div></div>
  <div class="side-section-label">EXPLORE</div>
  <nav class="side-nav" aria-label="Main navigation">
    ${nav('dashboard','home','Overview')}${nav('quests','compass','Quest board')}${nav('leaderboard','trophy','Leaderboard')}${nav('profile','users','My profile')}${nav('ecosystem','globe','Ecosystem')}${nav('weekly','gift','Weekly quests')}${nav('guide','book-open','Getting started')}
  </nav>
  <div class="side-divider"></div>
  <div class="side-section-label">YOUR EXPEDITION</div>
  <div class="side-level"><div class="side-level-symbol">${icon('sparkles',21)}</div><div class="side-level-details"><b>${state.user?'Level '+currentLevel():'A new adventure'}</b><span>${state.user?`${state.user.xp.toLocaleString()} explorer XP`:'Every legend starts somewhere'}</span></div></div>
  <div class="side-space"></div>
  <div class="side-bottom-card"><div class="side-bottom-stars">✦ &nbsp; SEASON ZERO</div><b>The realm awaits.</b><p>Explore a new world of onchain possibilities.</p><button class="side-card-btn" data-action="guide">Explore guide ${icon('arrow',15)}</button></div>
  <div class="sidebar-foot"><span class="status-dot"></span> KINETIQ ELYSIUM TESTNET <span class="sidebar-version">v0.1</span></div>
</aside>`;}
function nav(tab,i,label){return `<button class="nav-item ${state.tab===tab?'active':''}" data-tab="${tab}">${icon(i,19)}<span>${label}</span>${state.tab===tab?'<span class="nav-active-dot"></span>':''}</button>`;}
function topbar() {return `<header class="topbar"><div class="top-left"><button class="mobile-menu" data-action="menu" aria-label="Open menu">${icon('menu',21)}</button><div class="crumb"><span>THE ODYSSEY</span>${icon('chevron',13)}<b>${({dashboard:'Overview',quests:'Quests',leaderboard:'Leaderboard',guide:'Getting Started',profile:'My Profile',ecosystem:'Ecosystem',weekly:'Weekly Quests'})[state.tab]}</b></div></div>
<div class="top-actions"><button class="chain-pill" data-action="network"><span class="status-dot"></span><span>ELYSIUM TESTNET</span>${icon('chevron',13)}</button>${state.demo?'<span class="demo-pill">DEMO MODE</span>':''}<button class="wallet-button" data-action="wallet">${icon('wallet',18)} <span>${state.user?(state.demo?'Demo Explorer':formatAddress(state.user.address)):'Connect wallet'}</span></button></div></header>`;}
function hero(){return `<section class="hero"><div class="hero-shimmer"></div><div class="hero-copy"><div class="eyebrow"><span class="eyebrow-star">✦</span> SEASON ZERO <span class="eyebrow-div">/</span> THE GENESIS JOURNEY</div><h1>Every legend<br/>starts with a <em>quest.</em></h1><p>Explore the Elysium universe, complete meaningful quests, and forge your legacy — one adventure at a time.</p><div class="hero-actions"><button class="button-primary" data-tab="quests">Discover quests ${icon('arrow',17)}</button><button class="button-text" data-tab="guide">How it works ${icon('arrowUp',16)}</button></div><div class="hero-hint"><span class="tiny-diamond">◆</span> FREE TO START <span class="hero-separator">|</span> BUILT FOR EXPLORERS</div></div><div class="hero-visual">${worldArtwork()}</div></section>`;}
function statCards(){return `<section class="stats-grid" aria-label="Your stats">
${stat('sparkles','YOUR TOTAL XP',state.user?state.user.xp.toLocaleString():'—','Experience earned','violet')}
${stat('shield','CURRENT LEVEL',state.user?String(currentLevel()).padStart(2,'0'):'—','Explorer rank','blue')}
${stat('check','QUESTS COMPLETED',state.user?String(completeCount()).padStart(2,'0'):'—',`${QUESTS.length} active quests`,'green')}
${stat('trophy','LEADERBOARD',state.user?(rank()?'#'+rank():state.demo?'DEMO':'—'):'—',state.demo?'Sandbox progress':'Global position','amber')}
</section>`;}
function stat(i,label,num,sub,color){return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${icon(i,18)}</span></div><div class="stat-value">${num}</div><div class="stat-sub">${sub}</div></article>`;}
function questArtwork(q,modal=false){return q.profileImage?`<div class="${modal?'modal-quest-icon':'quest-icon'} social-profile"><img src="${cleanHTML(q.profileImage)}" alt="${cleanHTML(q.projectName)} profile photo" width="64" height="64" ${modal?'':'loading="lazy"'} decoding="async" /></div>`:`<div class="${modal?'modal-quest-icon':'quest-icon'} ${q.color}">${icon(q.icon,modal?30:26)}</div>`;}
function questCard(q,compact=false){if(q.kind==='daily')q={...q,xp:streak().reward};return `<article class="quest-card ${q.completed?'quest-done':''}" data-quest-card="${q.id}">${questArtwork(q)}<div class="quest-top"><span class="quest-category">${q.category.toUpperCase()}</span><span class="quest-duration">${icon('clock',13)} ${q.time}</span></div><h3>${q.name}</h3>${q.handle?`<div class="social-handle">@${cleanHTML(q.handle)}</div>`:''}<p>${q.short}</p><div class="quest-bottom"><span class="xp-badge">${icon('sparkles',15)} +${q.xp} XP</span><button aria-label="${q.completed?'View completed quest':'Open quest'}: ${cleanHTML(q.name)}" class="quest-open ${q.completed?'complete':''}" data-action="openquest" data-id="${q.id}">${q.completed?`${icon('check',16)} Done`:icon('arrow',18)}</button></div></article>`;}
function dashboard(){const upcoming=state.quests.filter(q=>!q.completed).sort((a,b)=>a.kind==='daily'?-1:b.kind==='daily'?1:0).slice(0,3);return `${hero()}${statCards()}${streakPanel()}
<div class="main-grid"><div class="main-column"><div class="section-heading"><div><div class="section-kicker">YOUR NEXT ADVENTURE</div><h2>Featured quests <span class="heading-spark">✦</span></h2><p>Small steps. Epic progress. Your journey starts here.</p></div><button class="subtle-link" data-tab="quests">All quests ${icon('arrow',16)}</button></div>
<div class="quest-grid">${(upcoming.length?upcoming:state.quests.slice(0,3)).map(q=>questCard(q,true)).join('')}</div>
<section class="discover-panel"><div class="discover-icon">${icon('globe',24)}</div><div><div class="discover-eyebrow">BEYOND THE ODYSSEY</div><h3>Discover the Elysium ecosystem</h3><p>The future of onchain exploration is just a click away.</p></div><a href="${ECOSYSTEM_URL}" target="_blank" rel="noopener noreferrer" class="circle-out" title="Open ecosystem">${icon('arrowUp',20)}</a></section>
</div><aside class="right-column">${progressPanel()}${activityPanel()}</aside></div>`;}
function streak(){return dailyStatus(state.user?.dailyDates||[]);}
function streakPanel(){const d=streak();return `<section class="streak-panel"><div class="streak-copy"><div class="section-kicker">THE DAILY RITUAL</div><h2>${icon('flame',25)} ${d.current} day${d.current===1?'':'s'} streak</h2><p>Best: ${d.best} day${d.best===1?'':'s'} · 45 XP daily + 100 bonus XP every 7 days.</p><p>Check in before 00:00 UTC (03:00 Türkiye). A missed day resets your streak.</p></div><div class="streak-days" aria-label="Seven day streak progress">${Array.from({length:7},(_,i)=>`<div class="streak-day ${i<d.cycle?'earned':''}"><span>${i<d.cycle?icon('check',16):i===6?icon('gift',16):icon('flame',16)}</span><small>DAY ${i+1}</small><b>${i===6?145:45} XP</b></div>`).join('')}</div><button class="button-primary" data-action="${state.user?'daily':'wallet'}">${d.checkedIn?'Checked in today':`Check in +${d.reward} XP`} ${icon(d.checkedIn?'check':'arrow',17)}</button></section>`;}
function progressPanel() {const pct=xpProgress(),l=currentLevel();return `<section class="side-panel progress-panel"><div class="panel-header"><span>EXPLORER'S PATH</span>${icon('sparkles',18)}</div><div class="progress-circle" style="--pct:${pct}"><div><div class="progress-level">${state.user?String(l).padStart(2,'0'):'00'}</div><span>LEVEL</span></div></div><h3>${state.user?'Keep rising, explorer!':'Your story awaits'}</h3><p>${state.user?`${state.user.xp-levelFloor(l)} / ${levelFloor(l+1)-levelFloor(l)} XP until Level ${l+1}`:'Connect your wallet or try a demo to begin.'}</p><div class="progress-track"><span style="width:${state.user?pct:0}%"></span></div><div class="progress-labels"><span>${state.user?levelFloor(l)+' XP':'0 XP'}</span><span>${state.user?levelFloor(l+1)+' XP':'NEXT LEVEL'}</span></div><button class="panel-action" data-action="${state.user?'daily':'wallet'}">${icon('flame',18)} ${state.user?(streak().checkedIn?'Checked in today':`Daily check-in +${streak().reward} XP`):'Start your adventure'} ${icon('arrow',16)}</button></section>`;}
function activityPanel(){const activities=state.user?.activity||[];return `<section class="side-panel activity-panel"><div class="panel-header">RECENT ACTIVITY <span>${icon('clock',16)}</span></div>${activities.length?activities.slice(0,4).map(a=>`<div class="activity-row"><span class="activity-marker">${icon('check',15)}</span><div><b>${cleanHTML(a.title)}</b><span>${new Date(a.at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div><strong>+${a.xp}</strong></div>`).join(''):`<div class="empty-activity">${icon('compass',24)}<p>Your adventure log is empty. Complete your first quest to start writing your story.</p></div>`}</section>`;}
function questPage(){const labels=[['all','All quests'],['Getting Started','Getting Started'],['Learn','Learn'],['Explore','Explore'],['Daily','Daily'],['Onchain','Onchain'],['Social','Social'],['completed','Completed']];const selected=state.quests.filter(q=>state.filter==='all'||(state.filter==='completed'?q.completed:q.category===state.filter));return `<div class="page-head"><div class="section-kicker">THE QUEST BOARD</div><h1>Choose your <em>adventure.</em></h1><p>Every expedition brings you closer to the next level. Select your path and begin.</p></div><div class="quest-summary"><span>${icon('compass',20)} <b>${QUESTS.length} expeditions</b> available</span><span>${icon('sparkles',20)} <b>${QUESTS.reduce((x,q)=>x+(q.kind==='daily'?0:q.xp),0).toLocaleString()} XP</b> one-time potential + dailies</span></div><div class="filter-row">${labels.map(([id,label])=>`<button class="filter-chip ${state.filter===id?'selected':''}" data-filter="${id}">${label}</button>`).join('')}</div><div class="quest-page-grid">${selected.map(q=>questCard(q)).join('')||'<div class="empty-filter">No quests in this category yet. Try another filter.</div>'}</div><div class="note-card">${icon('info',19)} <span>XP is an offchain progression score, not a transferable token or a promise of an airdrop. The transaction quest uses testnet only.</span></div>`;}
function leaders(){const leaders=state.leaderboard;return `<div class="page-head"><div class="section-kicker">THE HALL OF EXPLORERS</div><h1>Legends are <em>earned.</em></h1><p>See who's blazing the trail. Every point on this board comes from saved wallet accounts.</p></div><div class="leader-hero"><span class="leader-crown">${icon('trophy',28)}</span><div><div class="leader-hero-title">THE GENESIS LEADERBOARD</div><p>${state.totalAdventurers} explorer${state.totalAdventurers===1?'':'s'} have started their journey</p></div><span class="leader-star">✦</span></div><div class="leader-table"><div class="leader-head"><span>RANK</span><span>EXPLORER</span><span>LEVEL</span><span>EXPERIENCE</span></div>${leaders.length?leaders.map(u=>`<div class="leader-row ${u.address.toLowerCase()===state.user?.address?.toLowerCase()&&!state.demo?'is-you':''}"><span class="leader-rank rank-${u.rank}">${u.rank===1?icon('trophy',20):'#'+String(u.rank).padStart(2,'0')}</span><span class="leader-person"><span class="avatar avatar-${u.rank%5}">${u.address.slice(2,4).toUpperCase()}</span><span><b>${formatAddress(u.address)} ${u.address.toLowerCase()===state.user?.address?.toLowerCase()&&!state.demo?'<small>YOU</small>':''}</b><span>Explorer</span></span></span><span class="leader-level">Lvl ${u.level}</span><span class="leader-xp">${u.xp.toLocaleString()} <small>XP</small></span></div>`).join(''):'<div class="empty-leader">'+icon('trophy',40)+'<h3>The hall is still quiet</h3><p>No signed-in adventurers yet. Be the first to claim your place.</p><button class="button-primary" data-action="wallet">Join the Odyssey '+icon('arrow',16)+'</button></div>'}</div>${state.demo?'<div class="note-card">'+icon('info',19)+' Your demo XP is local to your browser and never appears on this public ranking.</div>':''}`;}
function guide(){return `<div class="page-head"><div class="section-kicker">YOUR FIELD GUIDE</div><h1>Enter the <em>unknown.</em></h1><p>Everything you need to begin a legendary adventure in the Elysium ecosystem.</p></div><div class="guide-intro"><div class="guide-intro-icon">${brandMark(86)}</div><div><span>WELCOME TO SEASON ZERO</span><h2>Exploration should be rewarding.</h2><p>Elysium Odyssey is a community quest platform. Discover Elysium, verify useful activities, build experience, and rise through the ranks. This MVP runs on Kinetiq Elysium Testnet (chain 99801).</p></div></div><div class="guide-steps">${[
['01','Connect your wallet','Use an EVM wallet like MetaMask. A free signature proves wallet ownership; we never request your seed phrase or token approval.','wallet'],
['02','Pick your quests','Start with the knowledge quiz, explore the chain or check in daily. One-time quests can only reward you once.','compass'],
['03','Gain XP and level up','Every verified or honestly self-attested quest adds XP to your server-backed profile. XP is not a token.','sparkles'],
['04','Climb the leaderboard','Compare your saved score with real connected explorers. Demo progress stays in your own browser.','trophy'],
].map(([n,title,desc,i])=>`<div class="guide-step"><div class="guide-num">${n}</div><div class="guide-step-icon">${icon(i,25)}</div><div><h3>${title}</h3><p>${desc}</p></div></div>`).join('')}</div><section class="resources"><div class="section-kicker">OFFICIAL RESOURCES</div><h2>Keep exploring</h2><a href="${DOCS_URL}" target="_blank" rel="noopener noreferrer">${icon('book-open',21)} Elysium developer docs ${icon('arrowUp',19)}</a><a href="${EXPLORER_URL}" target="_blank" rel="noopener noreferrer">${icon('globe',21)} Elysium testnet explorer ${icon('arrowUp',19)}</a><a href="${ECOSYSTEM_URL}" target="_blank" rel="noopener noreferrer">${icon('compass',21)} Elysium ecosystem ${icon('arrowUp',19)}</a></section>`;}
function backdrop(contents,cls=''){return `<div class="modal-backdrop" data-action="close-backdrop"><section class="modal ${cls}" role="dialog" aria-modal="true"><button class="modal-close" data-action="close" aria-label="Close dialog">${icon('x',20)}</button>${contents}</section></div>`;}
function walletModal(){return backdrop(`<div class="modal-icon">${icon('wallet',27)}</div><div class="modal-label">THE GATEWAY</div><h2>${state.user?'Your explorer profile':'Begin your Odyssey'}</h2><p>${state.user?'Your journey is underway. Manage your session below.':'Connect your wallet to save real XP, or explore the entire experience in demo mode.'}</p>${state.user?`<div class="connected-wallet">${icon(state.demo?'sparkles':'wallet',22)}<span>${state.demo?'Demo explorer (local only)':cleanHTML(formatAddress(state.user.address))}<small>${state.user.xp.toLocaleString()} XP · Level ${currentLevel()}</small></span></div>${!state.demo?`<button class="modal-action secondary" data-action="copyaddr">${icon('copy',18)} Copy wallet address</button>`:''}<button class="modal-action secondary" data-action="logout">${icon('logout',18)} ${state.demo?'Exit demo':'Disconnect session'}</button>`:`<button class="modal-action" data-action="connect">${icon('wallet',19)} Connect EVM wallet ${icon('arrow',18)}</button><button class="modal-action secondary" data-action="demo">${icon('sparkles',19)} Try interactive demo ${icon('arrow',18)}</button>`}<div class="modal-fine">${icon('shield',15)} We never ask for private keys, seed phrases or token approvals.</div>`,'wallet-modal');}
function networkModal(){return backdrop(`<div class="modal-icon">${icon('globe',27)}</div><div class="modal-label">NETWORK DETAILS</div><h2>Elysium Testnet</h2><p>Odyssey uses Kinetiq's Elysium Testnet. Do not confuse this network with Vulcan Forged Elysium.</p><div class="network-details"><div><span>Chain ID</span><b>99801</b></div><div><span>Gas token</span><b>HYPE</b></div><div><span>Network</span><b>Kinetiq Elysium Testnet</b></div><div><span>RPC</span><b class="rpc-label">testnet-rpc.elysium.kinetiq.xyz</b></div></div><button class="modal-action" data-action="switch">${icon('globe',19)} Add / switch network ${icon('arrow',18)}</button><a class="external-modal-link" href="${EXPLORER_URL}" target="_blank" rel="noopener noreferrer">Open testnet explorer ${icon('arrowUp',16)}</a>`,'network-modal');}
function questModal(){let q=state.quests.find(q=>q.id===state.selectedQuest);if(!q)return '';if(q.kind==='daily')q={...q,xp:streak().reward};const done=q.completed;return backdrop(`${questArtwork(q,true)}<div class="modal-label">${q.tag} QUEST <span>·</span> ${q.time}</div><h2>${q.name}</h2><p>${q.description}</p><div class="modal-reward"><div>${icon('sparkles',22)} <b>+${q.xp} XP</b><span>QUEST REWARD</span></div><div>${icon('shield',22)} <b>${q.kind==='daily'?'Daily':q.kind==='transaction'?'Onchain':'One-time'}</b><span>QUEST TYPE</span></div></div><div class="modal-step-title">YOUR OBJECTIVES</div><div class="modal-step-list">${q.steps.map((s,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span>${s}</div>`).join('')}</div>${questActions(q,done)}`,'quest-modal');}
function questActions(q,done){if(done)return `<div class="quest-modal-complete">${icon('check',20)} ${q.kind==='daily'?'Checked in today! Return tomorrow (UTC).':'Quest completed. XP added to your account.'}</div>`;
if(!state.user)return `<button class="modal-action" data-action="wallet">${icon('wallet',18)} Connect or try demo to start ${icon('arrow',18)}</button>`;
if(q.kind==='automatic')return '<div class="quest-modal-complete">Connect a wallet to earn this first quest automatically. In demo mode, use the start button below.</div>'+(state.demo?`<button class="modal-action" data-action="claim" data-id="welcome">Start Odyssey +${q.xp} XP ${icon('arrow',18)}</button>`:'');
if(q.kind==='social')return socialActions(q);
if(q.kind==='daily')return `<div class="modal-fine">Current streak: ${streak().current} days · Best: ${streak().best} days · +100 XP every 7 days.</div><button class="modal-action" data-action="claim" data-id="${q.id}">${icon('flame',19)} Check in & claim +${q.xp} XP ${icon('arrow',18)}</button><div class="modal-fine">Resets daily at 00:00 UTC.</div>`;
if(q.kind==='self')return `<a href="${EXPLORER_URL}" target="_blank" rel="noopener noreferrer" class="modal-action secondary">${icon('globe',18)} Open official explorer ${icon('arrowUp',17)}</a><label class="confirm-line"><input type="checkbox" id="explore-confirm" /> <span>I opened and explored the Elysium testnet explorer.</span></label><button class="modal-action" data-action="claim" data-id="explore">Claim +${q.xp} XP ${icon('arrow',18)}</button><div class="modal-fine">Self-attested exploration, not automatic onchain verification.</div>`;
if(q.kind==='quiz')return `<div class="quiz-questions">${QUIZ.map((entry,i)=>`<div class="quiz-question"><div class="quiz-prompt"><span>0${i+1}</span>${entry.prompt}</div><div class="quiz-options">${entry.answers.map((a,j)=>`<button class="quiz-option ${state.quizAnswers[i]===j?'picked':''}" data-action="answer" data-question="${i}" data-answer="${j}"><span class="radio-dot"></span>${a}</button>`).join('')}</div></div>`).join('')}</div><button class="modal-action" data-action="claim" data-id="quiz">Submit answers & claim +${q.xp} XP ${icon('arrow',18)}</button>`;
if(q.kind==='transaction')return `<div class="transaction-help">${icon('info',19)} Only successful testnet transactions sent from your connected wallet after joining count. Gas fees may apply; do not send funds to Odyssey.</div><label for="tx-field" class="field-label">TRANSACTION HASH</label><input class="text-field" id="tx-field" type="text" autocomplete="off" value="${cleanHTML(state.txHash)}" placeholder="0x... (66 characters)" /><button class="modal-action" data-action="claim" data-id="transaction">${icon('zap',18)} Verify transaction & claim ${icon('arrow',18)}</button><a class="external-modal-link" href="${EXPLORER_URL}" target="_blank" rel="noopener noreferrer">View Elysium explorer ${icon('arrowUp',16)}</a>`;
return '';
}
function socialActions(q){
  if(state.demo)return `<div class="note-card">A real wallet and connected X account are required for this reward. Demo mode cannot claim it.</div><button class="modal-action" data-action="wallet">Connect a real wallet ${icon('wallet',18)}</button>`;
  if(!state.xAccount)return `${state.xEnabled?`<button class="modal-action" data-action="connect-x">Connect X account ${icon('link',18)}</button>`:'<div class="note-card">X account connection is awaiting site configuration.</div>'}<div class="modal-fine">Connect your X account to unlock this quest. Each X account can be linked to one wallet.</div>`;
  return `<div class="connected-wallet">${icon('check',20)}<span>X connected: @${cleanHTML(state.xAccount.username)}</span></div><a class="modal-action" href="${q.targetUrl||X_PROFILE_URL}" target="_blank" rel="noopener noreferrer" data-action="claim" data-id="${q.id}">Follow on X & claim +${q.xp} XP ${icon('arrowUp',18)}</a><div class="modal-fine">Reward for visiting, once per wallet and linked X account. Following is not verified.</div>`;
}
function badgesPanel(){return `<section class="profile-card"><div class="profile-heading"><h2>Explorer badges</h2><span>${explorerBadges(state.user||{}).filter(b=>b.earned).length} / 4 unlocked</span></div><div class="badge-grid">${explorerBadges(state.user||{}).map(b=>`<div class="explorer-badge ${b.earned?'unlocked':''}"><span>${icon(b.icon,28)}</span><h3>${b.name}</h3><p>${b.description}</p><small>${b.earned?'UNLOCKED':'LOCKED'}</small></div>`).join('')}</div><p>Badges celebrate your milestones and do not award extra XP.</p></section>`;}
function ecosystem(){return `<div class="page-head"><div class="section-kicker">COMMUNITY SPOTLIGHT</div><h1>Growing <em>together.</em></h1><p>Discover the projects featured in our community quests. Explore their pages and support the ones you believe in.</p></div><div class="ecosystem-grid">${SOCIAL_PROFILES.map(p=>`<section class="profile-card ecosystem-project"><img src="${p.profileImage}" alt="${cleanHTML(p.projectName)}" width="64" height="64" loading="lazy"><span class="ecosystem-tag">ECOSYSTEM · COMMUNITY</span><h2>${cleanHTML(p.projectName)}</h2><p>@${cleanHTML(p.handle)}</p><p>Discover ${cleanHTML(p.projectName)} through its X page and complete its Odyssey community quest.</p><a class="ecosystem-link" href="${p.targetUrl}" target="_blank" rel="noopener noreferrer">Explore on X ${icon('arrowUp',15)}</a><button class="button-primary" data-action="openquest" data-id="${p.id}">${state.user?.completions?.[p.id]?'Quest completed':'View quest · 100 XP'} ${icon('arrow',16)}</button></section>`).join('')}</div><div class="note-card">${icon('info',19)} Community features express support and discovery; they do not imply an official partnership. Social quests reward a linked-account visit; following is not verified.</div>`;}
function weekly(){const w=weeklyStatus(state.user||{});return `<div class="page-head"><div class="section-kicker">A LITTLE PROGRESS EACH WEEK</div><h1>Your weekly <em>expedition.</em></h1><p>Monday to Monday, 00:00 UTC. New goals, extra XP, and more reasons to explore.</p></div><section class="profile-card"><div class="profile-heading"><h2>This week's goals</h2><span>Ends ${new Date(w.endsAt).toLocaleString('en-GB')} (local time)</span></div><p>Progress is saved to your wallet. Unclaimed rewards expire at the end of the week.</p></section><div class="weekly-grid">${w.quests.map(q=>`<section class="profile-card"><span class="ecosystem-tag">WEEKLY · +${q.xp} XP</span><h2>${q.name}</h2><p>${q.description}</p><progress class="profile-progress" value="${q.progress}" max="${q.target}" aria-label="${q.name} progress"></progress><div class="profile-heading"><b>${q.progress} / ${q.target}</b><span>${q.claimed?'Reward claimed':q.progress>=q.target?'Ready to claim':'In progress'}</span></div><button class="button-primary" data-action="${!state.user?'wallet':q.claimed||q.progress<q.target?'weekly-go':'weekly-claim'}" data-id="${q.id}" ${q.claimed?'disabled':''}>${!state.user?'Connect wallet':q.claimed?'Claimed':q.progress>=q.target?'Claim +'+q.xp+' XP':'Continue questing'}</button></section>`).join('')}</div>`;}
async function claimWeekly(id){
  if(!state.user)throw Error('Connect your wallet first.');
  if(state.demo){const w=weeklyStatus(state.user),q=w.quests.find(q=>q.id===id);if(!q||q.claimed||q.progress<q.target)throw Error('Weekly reward is not available.');state.user.weeklyClaims||={};state.user.weeklyClaims[w.key+':'+id]=Date.now();state.user.xp+=q.xp;state.user.activity=[{questId:id,xp:q.xp,title:q.name,at:Date.now()},...(state.user.activity||[])].slice(0,60);saveDemo();}
  else{const result=await request('/api/weekly/claim','POST',{id});state.user=result.user;}
  await refresh();toast('Weekly reward claimed!');
}

function profile(){
  const u=state.user;
  if(!u)return `<div class="page-head"><div class="section-kicker">YOUR EXPEDITION</div><h1>Your explorer <em>profile.</em></h1><p>Connect your wallet to see saved XP, streaks and quest history.</p></div><section class="profile-card"><h2>Begin your story</h2><p>Your progress is tied to your wallet. Return with the same wallet to continue.</p><button class="button-primary" data-action="wallet">Connect wallet ${icon('arrow',17)}</button></section>`;
  const d=streak(), level=currentLevel(), next=levelFloor(level+1), dates=new Set(u.dailyDates||[]);
  const dailyXP=dates.size*45+(()=>{let run=0,previous,bonus=0;for(const day of [...dates].sort()){const time=Date.parse(day+'T00:00:00Z');run=previous!==undefined&&time-previous===86400000?run+1:1;if(run%7===0)bonus+=100;previous=time;}return bonus;})();
  const calendar=Array.from({length:28},(_,i)=>{const date=new Date(todayUTC()+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-27+i);const key=date.toISOString().slice(0,10);return `<div class="profile-day ${dates.has(key)?'earned':''}" title="${key}: ${dates.has(key)?'Checked in':'No check-in'}"><small>${date.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})}</small><b>${date.getUTCDate()}</b><span>${dates.has(key)?icon('check',14):'·'}</span></div>`;}).join('');
  return `<div class="page-head"><div class="section-kicker">YOUR EXPEDITION</div><h1>Your explorer <em>profile.</em></h1><p>Every quest, every daily ritual, every step forward.</p></div>
  <section class="profile-card profile-identity"><span class="profile-avatar">${icon('users',32)}</span><div><h2>${cleanHTML(caption())}</h2><p class="profile-address">${cleanHTML(u.address)}</p><p>Joined ${new Date(u.joinDate).toLocaleDateString('en-US')} · ${state.demo?'Demo progress saved in this browser':'Progress saved to your wallet'}</p><p>${u.xAccount?'X connected: @'+cleanHTML(u.xAccount.username):'X account not connected'}</p></div><button class="button-primary" data-action="wallet">Manage account</button></section>
  <div class="profile-stats">${[['Total experience',u.xp.toLocaleString()+' XP'],['Explorer level',level],['Current streak',d.current+' days'],['Best streak',d.best+' days']].map(([label,value])=>`<div class="profile-card"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
  <section class="profile-card"><div class="profile-heading"><h2>Level ${level} progress</h2><span>${next-u.xp} XP to level ${level+1}</span></div><progress class="profile-progress" max="100" value="${xpProgress()}" aria-label="Progress to next level"></progress><p>${u.xp.toLocaleString()} / ${next.toLocaleString()} XP · Level thresholds grow with your experience.</p></section>
  ${badgesPanel()}
  ${streakPanel()}
  <div class="profile-columns"><section class="profile-card"><div class="profile-heading"><h2>Daily check-ins</h2><span>Last 28 UTC days</span></div><div class="profile-calendar">${calendar}</div><p>${dates.size} total check-ins · Next reset: ${new Date(d.nextReset).toLocaleString('en-GB')} (your local time).</p><p>45 XP per day, plus 100 XP on every seventh consecutive day. Missing a day resets the current streak; your best streak and earned XP remain.</p></section>
  <section class="profile-card"><h2>Your points</h2><div class="profile-ledger"><div><span>Daily rituals + streak bonuses</span><b>${dailyXP.toLocaleString()} XP</b></div><div><span>Quests + weekly rewards</span><b>${Math.max(0,u.xp-dailyXP).toLocaleString()} XP</b></div><div><span>Completed one-time quests</span><b>${Object.keys(u.completions).length}</b></div></div><p>XP is an offchain score. Each one-time quest pays once; daily rewards can be claimed once per UTC day.</p><div class="profile-rewards">${QUESTS.map(q=>`<div><span>${cleanHTML(q.name)}</span><b>${q.xp} XP${q.kind==='daily'?' + bonus':''}</b></div>`).join('')}</div></section></div>
  <section class="profile-card"><h2>Recent XP activity</h2>${u.activity?.length?u.activity.slice(0,10).map(a=>`<div class="profile-activity"><div><b>${cleanHTML(a.title)}</b><p>${new Date(a.at).toLocaleString('en-GB')}</p></div><strong>+${a.xp} XP</strong></div>`).join(''):'<p>Complete a quest to start your activity history.</p>'}</section>`;
}

function render(){
  app.innerHTML=`<div class="shell">${sidebar()}<main class="workspace">${topbar()}<div class="content">${({dashboard,quests:questPage,leaderboard:leaders,guide,profile,ecosystem,weekly})[state.tab]()}</div><footer class="footer"><span>✦ ELYSIUM ODYSSEY <span>·</span> EXPLORE THE UNKNOWN</span><span>INDEPENDENT COMMUNITY MVP <span>·</span> TESTNET ONLY</span></footer></main></div><div class="modal-root">${state.modal==='wallet'?walletModal():state.modal==='network'?networkModal():state.modal==='quest'?questModal():''}</div>`;
  document.body.classList.toggle('modal-open',!!state.modal);
}
function modal(type,id){state.modal=type;if(id)state.selectedQuest=id;if(type==='quest'&&id!=='quiz')state.quizAnswers={};render();}
function close(){state.modal=null;state.selectedQuest=null;render();}
async function connectWallet(){
  if(!window.ethereum?.request)throw new Error('No EVM wallet found. Install MetaMask or another compatible browser wallet, or try demo mode.');
  const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
  if(!accounts?.[0])throw new Error('Select a wallet account.');
  // Social quests and XP use a free signature; they do not need a chain switch.
  try {state.networkOk=parseInt(await window.ethereum.request({method:'eth_chainId'}),16)===CHAIN.chainId;} catch {state.networkOk=null;}
  const challenge=await request('/api/auth/challenge','POST',{address:accounts[0]});
  const signature=await window.ethereum.request({method:'personal_sign',params:[challenge.message,accounts[0]]});
  const logged=await request('/api/auth/verify','POST',{challengeId:challenge.challengeId,signature});
  state.demo=false;localStorage.removeItem('odyssey-demo-enabled');state.user=logged.user;state.modal=null;await refresh();toast('Wallet connected. Your Odyssey has begun!');
}
async function switchNetwork(){
  await ensureElysiumNetwork(window.ethereum);
  state.networkOk=true;
}
async function claimQuest(id){
  let q=QUESTS.find(q=>q.id===id);if(q?.kind==='daily')q={...q,xp:streak().reward};if(!q||!state.user)throw new Error('Connect your wallet or try demo first.');
  const beforeXP=state.user.xp;
  if(q.kind==='social'&&(state.demo||!state.xAccount))throw new Error('Connect your X account with a real wallet before claiming this quest.');
  if(state.demo){
    if(id==='quiz'&&!QUIZ.every((x,i)=>state.quizAnswers[i]===[2,1,0][i]))throw new Error('Some answers are incorrect. Try again.');
    if(id==='explore'&&!$('#explore-confirm')?.checked)throw new Error('Confirm that you visited the explorer first.');
    if(id==='transaction'){
      const hash=$('#tx-field')?.value.trim();
      if(!/^0x[0-9a-fA-F]{64}$/.test(hash||''))throw new Error('Enter a valid transaction hash to try the demo.');
    }
    doDemoAward(q);
  }else{
    let route=`/api/quests/${id}/claim`;let payload={};
    if(id==='welcome')throw new Error('This quest is automatically earned on wallet sign-in.');
    if(id==='quiz')payload.answers=QUIZ.map((_,i)=>state.quizAnswers[i]);
    if(id==='explore')payload.confirmed=!!$('#explore-confirm')?.checked;
    if(id==='transaction'){route='/api/quests/transaction/verify';payload.txHash=$('#tx-field')?.value.trim();}
    const result=await request(route,'POST',payload);
    state.user=result.user;state.quests=result.quests;
    const ranks=await request('/api/leaderboard');state.leaderboard=ranks.users;state.totalAdventurers=ranks.totalAdventurers;
  }
  state.modal=null;render();toast(`Quest complete! +${state.user.xp-beforeXP} XP earned ${state.demo?'(demo)':''}`);
}
async function logout(){if(!state.demo)await request('/api/auth/logout','POST',{});localStorage.removeItem('odyssey-demo-enabled');state.user=null;state.demo=false;state.modal=null;await refresh();toast('Session ended. See you on your next adventure!');}
function enterDemo(){localStorage.setItem('odyssey-demo-enabled','1');state.demo=true;state.user=demoUser();state.quests=viewDemoQuests();state.modal=null;render();toast('Demo explorer activated. Your XP stays on this browser.');}

app.addEventListener('click',async(event)=>{
  const el=event.target.closest('[data-action],[data-tab],[data-filter]');
  if(!el)return;
  if(el.dataset.action==='close-backdrop'&&event.target!==el)return;
  const act=el.dataset.action;
  if(state.busy&&['connect','connect-x','claim','weekly-claim','logout','switch'].includes(act)){event.preventDefault();return;}
  try{
    if(el.dataset.tab){state.tab=el.dataset.tab;state.modal=null;document.body.classList.remove('menu-open');render();window.scrollTo({top:0,behavior:'smooth'});return;}
    if(el.dataset.filter){state.filter=el.dataset.filter;render();return;}
    if(act==='openquest'||act==='daily'){modal('quest',el.dataset.id||'daily');return;}
    if(act==='wallet'){modal('wallet');return;}
    if(act==='network'){modal('network');return;}
    if(act==='close'||act==='close-backdrop'){close();return;}
    if(act==='weekly-go'){state.tab='quests';render();return;}
    if(act==='guide'){state.tab='guide';render();return;}
    if(act==='menu'){document.body.classList.toggle('menu-open');return;}
    if(act==='answer'){state.quizAnswers[Number(el.dataset.question)]=Number(el.dataset.answer);render();return;}
    if(act==='copyaddr'){await navigator.clipboard.writeText(state.user?.address||'');toast('Address copied.');return;}
    if(act==='demo'){enterDemo();return;}
    if(['connect','connect-x','claim','weekly-claim','logout','switch'].includes(act)){
      state.busy=true;el.disabled=true;el.classList.add('is-loading');
      if(act==='connect')await connectWallet();
      if(act==='connect-x'){const result=await request('/api/x/connect','POST',{});window.location.assign(result.url);}
      if(act==='claim')await claimQuest(el.dataset.id);
      if(act==='weekly-claim')await claimWeekly(el.dataset.id);
      if(act==='logout')await logout();
      if(act==='switch'){await switchNetwork();state.modal=null;render();toast('Connected to Elysium Testnet.');}
    }
  }catch(err){toast(err?.message||'Something went wrong.','error');}
  finally{state.busy=false;el.disabled=false;el.classList.remove('is-loading');}
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal)close();});
window.ethereum?.on?.('accountsChanged',async accounts=>{
  if(state.user&&!state.demo&&accounts?.[0]?.toLowerCase()!==state.user.address?.toLowerCase()){
    await logout();toast('Wallet changed. Reconnect to use the new account.','error');
  }
});
let displayedDay=todayUTC();
setInterval(()=>{if(todayUTC()!==displayedDay&&!state.busy){displayedDay=todayUTC();refresh();}},15000);
window.addEventListener('focus',()=>{if(!state.busy)refresh();});
(async()=>{const callback=new URLSearchParams(location.search).get('x');if(callback){state.selectedQuest='x-follow';state.modal='quest';history.replaceState(null,'',location.pathname);}
if(localStorage.getItem('odyssey-demo-enabled')==='1'){state.demo=true;state.user=demoUser();}render();await refresh();if(callback)toast(callback==='connected'?'X account connected. Visit @elysiumodyssey to claim your XP.':callback,callback==='connected'?'success':'error');})();
