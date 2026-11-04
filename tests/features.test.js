import test from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dailyStatus, SOCIAL_PROFILES, weeklyStatus, explorerBadges } from '../src/constants.js';
import { createXService } from '../server/x.js';

function withHost(url, options = {}) {
  return new Promise((resolve,reject)=>{
    const req=httpRequest(url,{method:options.method||'GET',headers:options.headers},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
    });req.on('error',reject);req.end(options.body);
  });
}
const now = new Date('2026-11-03T23:59:59Z');
test('streak continuation, missed days, best streak and seventh-day reward', () => {
  const days = ['2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02'];
  assert.equal(dailyStatus(days, now).current, 6);
  assert.equal(dailyStatus(days, now).reward, 145);
  const seventh = dailyStatus([...days, '2026-11-03', '2026-11-03'], now);
  assert.equal(seventh.reward, 145);assert.equal(seventh.current, 7); assert.equal(seventh.cycle, 7); assert.equal(seventh.checkedIn, true);
  const missed = dailyStatus(days, new Date('2026-11-04T00:00:00Z'));
  assert.equal(missed.current, 0); assert.equal(missed.best, 6); assert.equal(missed.reward, 45);
  assert.equal(dailyStatus([], now).current, 0);
  assert.equal(dailyStatus([...days, '2026-11-03'], new Date('2026-11-04T00:00:00Z')).reward, 45);
});

function mockX() {
  const calls = []; let following = true, rateLimit = false;
  const service = createXService({clientId:'client',clientSecret:'secret',redirectUri:'http://localhost/api/x/callback',
    fetchImpl: async (url, options) => {
      calls.push({url:String(url),options});
      if (rateLimit) return {ok:false,status:429};
      let body;
      if (String(url).endsWith('/token')) body={access_token:'private-token',expires_in:7200};
      else if (String(url).endsWith('/me')) body={data:{id:'123',username:'explorer'}};
      else if (String(url).includes('/by/username/')) body={data:{id:'456'}};
      else if (String(url).includes('pagination_token')) body={data:following?[{id:'456'}]:[],meta:{}};
      else body={data:[{id:'999'}],meta:{next_token:'next'}};
      return {ok:true,json:async()=>body};
    }});
  return {service,calls,unfollow:()=>following=false,limit:()=>rateLimit=true};
}
test('OAuth binds wallet session, validates PKCE and never requests following lists', async () => {
  const {service,calls,unfollow,limit}=mockX();
  const start=new URL(service.start('session','wallet'));
  assert.equal(start.searchParams.get('code_challenge_method'),'S256');
  assert.equal(start.searchParams.get('scope'),'tweet.read users.read');
  const state=start.searchParams.get('state');
  await assert.rejects(service.callback('attacker','wallet',state,'code'),/Invalid/);
  await service.callback('session','wallet',state,'code');
  const verifier=new URLSearchParams(calls[0].options.body).get('code_verifier');
  assert.equal(createHash('sha256').update(verifier).digest('base64url'),start.searchParams.get('code_challenge'));
  await assert.rejects(service.callback('session','wallet',state,'code'),/Invalid/);
  assert.deepEqual(service.status('session'),{id:'123',username:'explorer'});
  assert.equal(calls.some(call=>call.url.includes('/following')),false);
  service.forget('session');assert.equal(service.status('session'),null);
});
test('disabled X and denied authorization cannot produce a connection', async () => {
  assert.throws(()=>createXService({}).start('s','w'),/not configured/);
  const {service}=mockX();const state=new URL(service.start('s','w')).searchParams.get('state');
  await assert.rejects(service.callback('s','w',state,null),/cancelled/);
  assert.equal(service.status('s'),null);
});

test('HTTP rewards are server-controlled, persistent, and duplicate safe', async () => {
  const dir=await mkdtemp(path.join(tmpdir(),'odyssey-test-'));
  const db=path.join(dir,'db.json'), cookie='test-session', address='0x'+'a'.repeat(40);
  const today=new Date().toISOString().slice(0,10);
  const dates=Array.from({length:6},(_,i)=>new Date(Date.parse(today+'T00:00:00Z')-(6-i)*86400000).toISOString().slice(0,10));
  await writeFile(db,JSON.stringify({users:{[address]:{address,xp:0,completions:{},dailyDates:dates,joinDate:Date.now(),activity:[]}},sessions:{[createHash('sha256').update(cookie).digest('hex')]:{address,expires:Date.now()+60000}}}));
  const seeded=JSON.parse(await (await import('node:fs/promises')).readFile(db,'utf8'));
  const secondAddress='0x'+'b'.repeat(40);
  seeded.users[secondAddress]={address:secondAddress,xp:0,completions:{},dailyDates:[],joinDate:Date.now(),activity:[]};
  seeded.sessions[createHash('sha256').update('second-session').digest('hex')]={address:secondAddress,expires:Date.now()+60000};
  await writeFile(db,JSON.stringify(seeded));
  const child=spawn(process.execPath,['--import','./tests/mock-x.js','server/index.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',ODYSSEY_DATA_FILE:db,X_CLIENT_ID:'test-client',X_CLIENT_SECRET:'test-secret',X_REDIRECT_URI:'http://localhost/api/x/callback'},stdio:['ignore','pipe','pipe']});
  try {
    const [out]=await once(child.stdout,'data');const port=String(out).match(/localhost:(\d+)/)?.[1];
    assert.ok(port&&port!=='0','server reports selected port');
    const base=`http://localhost:${port}`;
    const rootRedirect=await fetch(base+'/',{redirect:'manual'});
    assert.equal(rootRedirect.status,302);
    assert.equal(rootRedirect.headers.get('location'),'http://localhost/');
    const canonicalRoot=await withHost(base+'/',{headers:{host:'localhost'}});
    assert.equal(canonicalRoot.status,200);
    const protectedMe=await fetch(base+'/api/me',{headers:{cookie:`odyssey_session=${cookie}`}});
    assert.match(protectedMe.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Path=\/api/);
    assert.equal((await fetch(base+'/api/me')).headers.get('set-cookie'),null);
    const claim=(id,auth=true)=>fetch(base+`/api/quests/${id}/claim`,{method:'POST',headers:{'content-type':'application/json',...(auth?{cookie:`odyssey_session=${cookie}`}:{})},body:JSON.stringify({xp:999999,confirmed:true})});
    assert.equal((await claim('daily',false)).status,401);
    const results=await Promise.all([claim('daily'),claim('daily')]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const success=await results.find(r=>r.status===200).json();
    assert.equal(success.user.xp,145);assert.equal(success.user.streak.current,7);
    assert.equal(success.user.activity[0].xp,145);
    assert.equal((await claim('x-follow',false)).status,401);
    const me=await (await fetch(base+'/api/me',{headers:{cookie:`odyssey_session=${cookie}`}})).json();assert.equal(me.user.xp,145);
    const headers={'content-type':'application/json',cookie:`odyssey_session=${cookie}`};
    const status=await (await fetch(base+'/api/x/status',{headers})).json();
    assert.equal(status.mode,'linked-click');assert.equal(status.enabled,true);assert.equal(status.account,null);
    assert.equal((await claim('x-follow')).status,403,'an unlinked wallet cannot claim');
    const board=await (await fetch(base+'/api/quests')).json();
    assert.equal(board.quests.length,16);
    assert.equal(SOCIAL_PROFILES.length,10);
    for(const profile of SOCIAL_PROFILES){
      const quest=board.quests.find(q=>q.id===profile.id);
      assert.equal(quest.targetUrl,'https://x.com/'+profile.handle);
      assert.equal(quest.xp,100);assert.equal(quest.kind,'social');
      assert.equal((await claim(profile.id)).status,403,'each partner quest requires X linking');
      const avatar=await fetch(base+quest.profileImage);
      assert.equal(avatar.status,200);assert.match(avatar.headers.get('content-type'),/^image\//);
      assert.ok((await avatar.arrayBuffer()).byteLength>100);
    }
    const connect=await (await withHost(base+'/api/x/connect',{method:'POST',headers:{...headers,host:'localhost'},body:'{}'})).json();
    const oauthState=new URL(connect.url).searchParams.get('state');
    const callback=await fetch(base+'/api/x/callback?state='+oauthState+'&code=test',{headers,redirect:'manual'});
    assert.equal(callback.headers.get('location'),'/?x=connected');
    const resultsX=await Promise.all([claim('x-follow'),claim('x-follow')]);
    assert.deepEqual(resultsX.map(r=>r.status).sort(),[200,409]);
    const social=await resultsX.find(r=>r.status===200).json();
    assert.equal(social.user.xp,245);assert.equal(social.user.xAccount.id,'123');
    assert.ok(social.user.completions['x-follow']);
    assert.equal((await claim('x-follow')).status,409);
    for(const profile of SOCIAL_PROFILES){
      const pair=await Promise.all([claim(profile.id),claim(profile.id)]);
      assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
      const awarded=await pair.find(r=>r.status===200).json();
      assert.ok(awarded.user.completions[profile.id]);
      assert.equal(awarded.user.activity[0].xp,100);
    }
    assert.equal((await claim('follow-unknown')).status,400);
    const headers2={'content-type':'application/json',cookie:'odyssey_session=second-session',host:'localhost'};
    const connect2=await (await withHost(base+'/api/x/connect',{method:'POST',headers:headers2,body:'{}'})).json();
    const state2=new URL(connect2.url).searchParams.get('state');
    const duplicate=await fetch(base+'/api/x/callback?state='+state2+'&code=test',{headers:{cookie:'odyssey_session=second-session'},redirect:'manual'});
    assert.match(decodeURIComponent(duplicate.headers.get('location')),/already linked to another wallet/);
    const denied=await fetch(base+'/api/quests/x-follow/claim',{method:'POST',headers:{'content-type':'application/json',cookie:'odyssey_session=second-session'},body:'{}'});
    assert.equal(denied.status,403);
    const meAfter=await (await fetch(base+'/api/me',{headers})).json();assert.equal(meAfter.user.xp,1245);
    const weeklyClaim=()=>fetch(base+'/api/weekly/claim',{method:'POST',headers,body:JSON.stringify({id:'weekly-explorer',xp:999999})});
    const weeklyPair=await Promise.all([weeklyClaim(),weeklyClaim()]);
    assert.deepEqual(weeklyPair.map(r=>r.status).sort(),[200,409]);
    const weeklyUser=(await weeklyPair.find(r=>r.status===200).json()).user;
    assert.equal(weeklyUser.xp,1365);
    assert.equal(Object.keys(weeklyUser.weeklyClaims).length,1);
    const disk=JSON.parse(await (await import('node:fs/promises')).readFile(db,'utf8'));
    assert.equal(disk.users[address].xp,1365);
    assert.deepEqual(disk.users[address].weeklyClaims,weeklyUser.weeklyClaims);
    const premature=await fetch(base+'/api/weekly/claim',{method:'POST',headers:headers2,body:JSON.stringify({id:'weekly-ritual'})});
    assert.equal(premature.status,400);
    const invalidOrigin=await fetch(base+'/api/x/connect',{method:'POST',headers:{...headers,origin:'https://other.example'},body:'{}'});
    assert.equal(invalidOrigin.status,403);
    assert.equal((await fetch(base+'/server/data/odyssey.json')).status,404);
  } finally { child.kill();await once(child,'exit');await rm(dir,{recursive:true,force:true}); }
});

test('weekly goals reset on Monday UTC and exclude previous weeks and weekly rewards',()=>{
  const user={dailyDates:['2026-11-01','2026-11-02','2026-11-03','2026-11-04'],completions:{explore:Date.parse('2026-11-02T12:00Z'),quiz:Date.parse('2026-11-01T12:00Z')},weeklyClaims:{'2026-11-02:weekly-ritual':1},activity:[{questId:'weekly-ritual',at:Date.parse('2026-11-04T12:00Z')}]};
  const week=weeklyStatus(user,new Date('2026-11-04T23:59:59Z'));
  assert.equal(week.key,'2026-11-02');assert.equal(week.quests[0].progress,3);assert.equal(week.quests[0].claimed,true);assert.equal(week.quests[1].progress,4);
  const next=weeklyStatus(user,new Date('2026-11-09T00:00:00Z'));
  assert.equal(next.quests[0].progress,0);assert.equal(next.quests[0].claimed,false);assert.equal(next.quests[1].progress,0);
  assert.equal(weeklyStatus({},new Date('2026-11-08T23:59:59Z')).key,'2026-11-02');
});
test('badges preserve historical streak achievements and require all project completions',()=>{
  const user={dailyDates:Array.from({length:7},(_,i)=>'2026-10-'+String(10+i)),completions:{transaction:1,...Object.fromEntries(SOCIAL_PROFILES.map(p=>[p.id,1]))}};
  assert.equal(explorerBadges(user).every(b=>b.earned),true);
  delete user.completions[SOCIAL_PROFILES[0].id];assert.equal(explorerBadges(user).find(b=>b.id==='ecosystem').earned,false);
  assert.equal(explorerBadges({}).some(b=>b.earned),false);
});
