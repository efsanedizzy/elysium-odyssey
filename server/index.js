import http from 'node:http';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createXService } from './x.js';
import { recoverPersonalSign, isAddress } from './crypto.js';
import { CHAIN, QUESTS, QUIZ, levelFromXP, dailyStatus, weeklyStatus } from '../src/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Load local OAuth settings before reading configuration. Existing environment values take priority.
const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) {
  if (typeof process.loadEnvFile !== 'function') throw new Error('Node.js 20.12 or newer is required to load .env settings.');
  process.loadEnvFile(envFile);
}

const DB = process.env.ODYSSEY_DATA_FILE || path.join(ROOT, 'server', 'data', 'odyssey.json');
const PORT = Number(process.env.PORT || 3000);
const RPC_URL = process.env.ELYSIUM_RPC_URL || CHAIN.rpcUrls[0];
const SESSION_AGE = 7 * 86400000;
const CHALLENGE_AGE = 5 * 60000;
const CHAIN_HEX = '0x185d9';
const PRIVATE_QUIZ_KEY = [2, 1, 0]; // The live answer key stays server-side.
let store = { users: {}, challenges: {}, sessions: {}, claimedTransactions: {} };
const xService = createXService({clientId:process.env.X_CLIENT_ID,clientSecret:process.env.X_CLIENT_SECRET,redirectUri:process.env.X_REDIRECT_URI});
const sessionKey = req => sha256(cookieValue(req,'odyssey_session')||'');
// Keep the wallet and OAuth callback on one origin.
const configuredOrigin = process.env.APP_ORIGIN || process.env.X_REDIRECT_URI;
const appOrigin = configuredOrigin ? new URL(configuredOrigin).origin : null;
let writing = Promise.resolve();
try { if (existsSync(DB)) store = { ...store, ...JSON.parse(await readFile(DB,'utf8')) }; }
catch(err) { console.error('Unable to read the database:',err); process.exit(1); }

function save() {
  writing = writing.catch(()=>{}).then(async()=>{
    await mkdir(path.dirname(DB),{recursive:true});
    const temp = `${DB}.tmp`;
    await writeFile(temp, JSON.stringify(store,null,2), {mode:0o600});
    await rename(temp,DB);
  });
  return writing;
}
const utcDay = () => new Date().toISOString().slice(0,10);
const token = () => randomBytes(32).toString('hex');
const sha256 = s => createHash('sha256').update(s).digest('hex');
const cookieValue = (req,key) => (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1);
const sessionUser = req => {
  const sessionCookie=cookieValue(req,'odyssey_session');
  const sess=sessionCookie&&store.sessions[sha256(sessionCookie)];
  return sess && sess.expires>Date.now() ? store.users[sess.address]||null : null;
};
function refreshSessionCookie(req) {
  const value=cookieValue(req,'odyssey_session');
  const session=value&&store.sessions[sha256(value)];
  if(!session || session.expires<=Date.now())return {};
  const secure=process.env.NODE_ENV==='production'?'; Secure':'';
  const seconds=Math.floor((session.expires-Date.now())/1000);
  return {'set-cookie':`odyssey_session=${value}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${seconds}${secure}`};
}
function publicUser(u) {return {address:u.address,xp:u.xp,weeklyClaims:u.weeklyClaims||{},level:levelFromXP(u.xp),completions:u.completions,dailyDates:u.dailyDates,streak:dailyStatus(u.dailyDates),xAccount:u.xAccount||null,joinDate:u.joinDate,activity:u.activity.slice(-10).reverse()};}
function viewQuests(u) {return QUESTS.map(q=>({...q,completed:q.kind==='daily'?!!u?.dailyDates.includes(utcDay()):!!u?.completions[q.id]}));}
function rankUsers() {return Object.values(store.users).sort((a,b)=>b.xp-a.xp||a.joinDate-b.joinDate).slice(0,30).map((u,i)=>({rank:i+1,address:u.address,xp:u.xp,level:levelFromXP(u.xp),completed:Object.keys(u.completions).length}));}
function award(u,id,xp,title,daily=false) {
  u.xp+=xp;
  if(daily) u.dailyDates.push(utcDay()); else u.completions[id]=Date.now();
  u.activity.push({questId:id,xp,title,at:Date.now()});
  u.activity=u.activity.slice(-60);
}
function json(res,code,body,headers={}) {res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(JSON.stringify(body));}
const rateMap = new Map();
function throttled(key,max,windowMs) {
  let r=rateMap.get(key);
  if(!r||r.until<Date.now())r={count:0,until:Date.now()+windowMs};
  r.count++;rateMap.set(key,r);
  if(rateMap.size>20000)rateMap.clear();
  return r.count>max;
}
async function readJSON(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new Error('Expected application/json');
  let data='';
  for await(const c of req) {data+=c; if(data.length>12000)throw new Error('Request is too large');}
  try{return JSON.parse(data||'{}');}catch{throw new Error('Invalid JSON body');}
}
async function rpc(method,params) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8500);
  try {
    const response=await fetch(RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal});
    if(!response.ok) throw new Error('RPC HTTP '+response.status);
    const body=await response.json();
    if(body.error)throw new Error('RPC '+body.error.message);
    return body.result;
  } finally {clearTimeout(timeout);}
}
async function verifyOnchain(user,hash) {
  const chain=await rpc('eth_chainId',[]);
  if(chain?.toLowerCase()!==CHAIN_HEX)throw new Error('RPC chain ID mismatch');
  const [tx,receipt]=await Promise.all([rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])]);
  if(!tx||!receipt||parseInt(receipt.status,16)!==1) return 'Transaction not found or not successful on Elysium Testnet.';
  if(tx.from?.toLowerCase()!==user.address.toLowerCase())return 'Transaction sender must match your connected wallet.';
  const block=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
  if(!block||Number(BigInt(block.timestamp))*1000<user.joinDate-5*60000)return 'Transaction must have been sent after you joined Odyssey.';
  if(Number(BigInt(block.timestamp))*1000>Date.now()+60000)return 'Invalid transaction time.';
  return null;
}

async function api(req,res,url) {
  const pathname=url.pathname;
  if(req.method==='GET') {
    if(pathname==='/api/config')return json(res,200,{chain:CHAIN,version:'0.1.0',network:'testnet',xEnabled:xService.enabled,socialMode:'linked-click'});
    if(pathname==='/api/x/status') return json(res,200,{enabled:xService.enabled,mode:'linked-click',account:sessionUser(req)?.xAccount||null,appOrigin});
    if(pathname==='/api/x/callback') {
      const u=sessionUser(req);let result='connected';
      try {
        if(!u)throw new Error('Connect your wallet at '+appOrigin+' and start X authorization again.');
        const account=await xService.callback(sessionKey(req),u.address,url.searchParams.get('state'),url.searchParams.get('code'));
        if(u.xAccount && u.xAccount.id!==account.id)throw new Error('This wallet is already linked to a different X account.');
        if(Object.values(store.users).some(other=>other.address!==u.address&&other.xAccount?.id===account.id))throw new Error('This X account is already linked to another wallet.');
        u.xAccount=account;await save();
      }catch(err){xService.forget(sessionKey(req));result=err.message;}
      res.writeHead(303,{location:'/?x='+encodeURIComponent(result),'cache-control':'no-store','referrer-policy':'no-referrer'});res.end();return;
    }
    if(pathname==='/api/me')return json(res,200,{user:sessionUser(req)?publicUser(sessionUser(req)):null},refreshSessionCookie(req));
    if(pathname==='/api/quests')return json(res,200,{quests:viewQuests(sessionUser(req))});
    if(pathname==='/api/leaderboard')return json(res,200,{users:rankUsers(),totalAdventurers:Object.keys(store.users).length});
    if(pathname==='/api/quiz')return json(res,200,{questions:QUIZ.map(({prompt,answers})=>({prompt,answers}))});
    return json(res,404,{error:'Unknown API route'});
  }
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const origin=req.headers.origin;
  if(origin) {
    try {if(new URL(origin).host!==req.headers.host) return json(res,403,{error:'Origin mismatch'});}
    catch{return json(res,403,{error:'Invalid origin'});}
  }
  const data=await readJSON(req);
  const ip=req.socket.remoteAddress||'unknown';
  if(pathname==='/api/auth/challenge') {
    if(throttled('auth:'+ip,20,10*60000))return json(res,429,{error:'Too many sign-in attempts. Try again later.'});
    if(!isAddress(data.address))return json(res,400,{error:'Enter a valid EVM wallet address.'});
    for (const [k,v] of Object.entries(store.challenges)) { if(v.expires<Date.now()) delete store.challenges[k]; }
    for (const [k,v] of Object.entries(store.sessions)) { if(v.expires<Date.now()) delete store.sessions[k]; }
    const address=data.address.toLowerCase();
    const challengeId=token();
    const message=`Elysium Odyssey login\n\nWallet: ${address}\nChain: 99801 (Kinetiq Elysium Testnet)\nNonce: ${challengeId}\nIssued at: ${new Date().toISOString()}\n\nThis is a free login signature, not a transaction or token approval.`;
    store.challenges[challengeId]={address,message,expires:Date.now()+CHALLENGE_AGE};
    await save();
    return json(res,200,{challengeId,message});
  }
  if(pathname==='/api/auth/verify') {
    if(throttled('verify:'+ip,30,10*60000))return json(res,429,{error:'Too many verification attempts.'});
    const challenge=typeof data.challengeId==='string'&&store.challenges[data.challengeId];
    if(!challenge||challenge.expires<Date.now())return json(res,400,{error:'Challenge expired. Please sign in again.'});
    delete store.challenges[data.challengeId];
    let recovered='';
    try{recovered=recoverPersonalSign(challenge.message,data.signature).toLowerCase();}catch(e){console.warn('Invalid login signature:',e.message);}
    if(recovered!==challenge.address){await save();return json(res,401,{error:'The signature does not match your wallet.'});}
    let u=store.users[challenge.address];
    if(!u){u={address:challenge.address,xp:0,completions:{},dailyDates:[],joinDate:Date.now(),activity:[]};store.users[challenge.address]=u;award(u,'welcome',120,'The First Spark');}
    const sessionId=token();store.sessions[sha256(sessionId)]={address:challenge.address,expires:Date.now()+SESSION_AGE};
    await save();
    const secure=process.env.NODE_ENV==='production'?'; Secure':'';
    return json(res,200,{user:publicUser(u)},{'set-cookie':`odyssey_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${SESSION_AGE/1000}${secure}`});
  }
  if(pathname==='/api/auth/logout'){
    xService.forget(sessionKey(req));const value=cookieValue(req,'odyssey_session');if(value)delete store.sessions[sha256(value)];await save();
    return json(res,200,{ok:true},{'set-cookie':'odyssey_session=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0'});
  }
  const u=sessionUser(req);
  if(!u)return json(res,401,{error:'Connect your wallet to save XP.'});
  if(throttled('claim:'+u.address,75,60000))return json(res,429,{error:'Too many requests. Try again shortly.'});
  if(pathname==='/api/weekly/claim') {
    const week=weeklyStatus(u), q=week.quests.find(q=>q.id===data.id);
    if(!q)return json(res,400,{error:'Unknown weekly quest.'});
    if(q.claimed)return json(res,409,{error:'Weekly reward already claimed.'});
    if(q.progress<q.target)return json(res,400,{error:'Complete the weekly objectives first.'});
    u.weeklyClaims ||= {};
    u.weeklyClaims[week.key+':'+q.id]=Date.now();
    u.xp+=q.xp;
    u.activity.push({questId:q.id,xp:q.xp,title:q.name,at:Date.now()});u.activity=u.activity.slice(-60);
    await save();return json(res,200,{user:publicUser(u)});
  }
  if(pathname==='/api/x/connect') {
    if(appOrigin && req.headers.host?.toLowerCase()!==new URL(appOrigin).host.toLowerCase())return json(res,200,{url:appOrigin+'/?x='+encodeURIComponent('Connect your wallet at this address before linking X.')});
    if(throttled('xconnect:'+u.address,5,60000))return json(res,429,{error:'Too many X connection attempts. Try again in a minute.'});
    try{return json(res,200,{url:xService.start(sessionKey(req),u.address)},refreshSessionCookie(req));}
    catch(err){return json(res,503,{error:err.message});}
  }
  const socialMatch=pathname.match(/^\/api\/quests\/([a-z-]+)\/claim$/);
  const socialQuest=socialMatch&&QUESTS.find(q=>q.id===socialMatch[1]&&q.kind==='social');
  if(socialQuest) {
    if(u.completions[socialQuest.id])return json(res,409,{error:'This social quest reward was already claimed.'});
    if(!u.xAccount?.id)return json(res,403,{error:'Connect your X account before claiming this quest.'});
    if(Object.values(store.users).some(other=>other.address!==u.address&&other.xAccount?.id===u.xAccount.id))return json(res,409,{error:'This X account is already linked to another wallet.'});
    award(u,socialQuest.id,socialQuest.xp,socialQuest.name);
    await save();return json(res,200,{user:publicUser(u),quests:viewQuests(u)});
  }
  if(pathname==='/api/quests/transaction/verify') {
    if(u.completions.transaction)return json(res,409,{error:'Onchain quest already completed.'});
    if(throttled('onchain:'+u.address,8,60000))return json(res,429,{error:'Too many transaction lookups.'});
    const txHash=data.txHash;
    if(typeof txHash!=='string'||!/^0x[a-fA-F0-9]{64}$/.test(txHash))return json(res,400,{error:'Enter a valid 0x-prefixed transaction hash.'});
    if(store.claimedTransactions[txHash.toLowerCase()])return json(res,409,{error:'This transaction has already been used.'});
    let error;
    try{error=await verifyOnchain(u,txHash);}catch(e){console.error('RPC issue',e.message);return json(res,503,{error:'Elysium RPC is temporarily unavailable; please retry later.'});}
    if(error)return json(res,400,{error});
    // Recheck after the RPC await so parallel requests cannot award the same transaction twice.
    if(u.completions.transaction || store.claimedTransactions[txHash.toLowerCase()])return json(res,409,{error:'Transaction or quest already claimed.'});
    const q=QUESTS.find(q=>q.id==='transaction');award(u,q.id,q.xp,q.name);
    store.claimedTransactions[txHash.toLowerCase()]=u.address;
    await save();return json(res,200,{user:publicUser(u),quests:viewQuests(u)});
  }
  const m=pathname.match(/^\/api\/quests\/([a-z-]+)\/claim$/);
  if(!m)return json(res,404,{error:'Unknown API route'});
  const q=QUESTS.find(x=>x.id===m[1]);
  if(!q||!['daily','self','quiz'].includes(q.kind))return json(res,400,{error:'This quest cannot be manually claimed.'});
  if(q.kind==='daily') {
    if(u.dailyDates.includes(utcDay()))return json(res,409,{error:'You already checked in today. Return tomorrow (UTC).'});
    award(u,q.id,dailyStatus(u.dailyDates).reward,q.name,true);
  } else {
    if(u.completions[q.id])return json(res,409,{error:'Quest already completed.'});
    if(q.kind==='quiz') {
      if(!Array.isArray(data.answers)||data.answers.length!==QUIZ.length||!data.answers.every((ans,i)=>ans===PRIVATE_QUIZ_KEY[i]))return json(res,400,{error:'Some answers are incorrect. Try again.'});
    }
    if(q.kind==='self'&&data.confirmed!==true)return json(res,400,{error:'Confirm that you explored the testnet explorer.'});
    award(u,q.id,q.xp,q.name);
  }
  await save();return json(res,200,{user:publicUser(u),quests:viewQuests(u)});
}

const mime={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','svg':'image/svg+xml','png':'image/png','jpg':'image/jpeg','ico':'image/x-icon'};
async function serve(req,res,url) {
  const pathname=decodeURIComponent(url.pathname);
  const entry=pathname==='/'?'/index.html':pathname;
  // Explicit allowlist: never expose database, server code, git or env files.
  if(!/^\/(index\.html|src\/(main\.js|constants\.js|wallet\.js|styles\.css)|public\/[\w.-]+\.(svg|png|jpg|ico))$/.test(entry)) {
    res.writeHead(404);res.end('Not found');return;
  }
  const file=path.join(ROOT,entry);
  try{
    const content=await readFile(file);const ext=entry.split('.').at(-1);
    res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','x-content-type-options':'nosniff','cache-control':'no-cache','x-frame-options':'DENY'});
    res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    // Use one origin before wallet sign-in, so OAuth returns to the cookie's host.
    if(appOrigin && req.method==='GET' && ['/', '/index.html'].includes(url.pathname) && req.headers.host?.toLowerCase()!==new URL(appOrigin).host.toLowerCase()) {
      res.writeHead(302,{location:appOrigin+url.pathname+url.search,'cache-control':'no-store','referrer-policy':'no-referrer'});res.end();return;
    }
    if(url.pathname.startsWith('/api/'))await api(req,res,url);
    else if(req.method==='GET' || req.method==='HEAD')await serve(req,res,url);
    else {res.writeHead(405);res.end('Method not allowed');}
  }catch(e){console.error('Request error:',e);if(!res.headersSent)json(res,e.message?.startsWith('Invalid')||e.message?.startsWith('Expected')||e.message?.includes('too large')?400:500,{error:e.message?.startsWith('Invalid')||e.message?.startsWith('Expected')||e.message?.includes('too large')?e.message:'Server error.'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Elysium Odyssey ready at http://localhost:${server.address().port} — chain ${CHAIN.chainId}`));
