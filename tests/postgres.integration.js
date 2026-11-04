import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { createStorage } from '../server/storage.js';

test('Postgres: cross-instance rewards, OAuth, rollback and cold-start persistence', {timeout:120000}, async()=>{
  let embedded, directory, admin, storage;
  const children=[], schema='odyssey_test_'+randomBytes(6).toString('hex');
  try{
    let connectionString=process.env.TEST_DATABASE_URL;
    if(!connectionString){
      const {default:EmbeddedPostgres}=await import('embedded-postgres');
      directory=await mkdtemp(path.join(tmpdir(),'odyssey-postgres-'));
      // Allocate an unused TCP port before starting the disposable cluster.
      const {createServer}=await import('node:net');const portServer=createServer();
      portServer.listen(0,'127.0.0.1');await once(portServer,'listening');
      const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
      const password=randomBytes(16).toString('hex');
      embedded=new EmbeddedPostgres({databaseDir:path.join(directory,'db'),user:'postgres',password,port,persistent:true,initdbFlags:['--locale=C','--encoding=UTF8'],onLog(){},onError(){}});
      await embedded.initialise();await embedded.start();
      connectionString=`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
    }
    admin=new pg.Client({connectionString});await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url=new URL(connectionString);url.searchParams.set('options',`-c search_path=${schema}`);
    connectionString=url.href;
    storage=createStorage({connectionString});
    const address='0x'+'a'.repeat(40), cookie='postgres-test-session';
    await storage.transaction(data=>{
      data.users[address]={address,xp:0,dailyDates:[],completions:{},activity:[],joinDate:Date.now()};
      data.sessions[createHash('sha256').update(cookie).digest('hex')]={address,expires:Date.now()+120000};
    });
    const start=async()=>{
      const child=spawn(process.execPath,['--import','./tests/mock-x.js','tests/vercel-server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,VERCEL:'1',DATABASE_URL:connectionString,APP_ORIGIN:'',X_CLIENT_ID:'test',X_CLIENT_SECRET:'test',X_REDIRECT_URI:'http://localhost/api/x/callback'},stdio:['ignore','pipe','pipe']});
      children.push(child);let errors='';child.stderr.on('data',c=>errors+=c);
      const output=await Promise.race([once(child.stdout,'data').then(([out])=>String(out)),once(child,'exit').then(()=>{throw Error(errors||'Test server exited');})]);
      return output.trim();
    };
    const [one,two]=await Promise.all([start(),start()]);
    const headers={host:'localhost','content-type':'application/json',cookie:'odyssey_session='+cookie};
    const post=(base,route,body={})=>fetch(base+route,{method:'POST',headers,body:JSON.stringify(body)});
    const daily=await Promise.all([post(one,'/api/quests/daily/claim'),post(two,'/api/quests/daily/claim')]);
    assert.deepEqual(daily.map(r=>r.status).sort(),[200,409]);
    const challenge=await (await post(one,'/api/auth/challenge',{address})).json();
    assert.equal((await post(two,'/api/auth/verify',{challengeId:challenge.challengeId,signature:'invalid'})).status,401);
    assert.equal((await post(one,'/api/auth/verify',{challengeId:challenge.challengeId,signature:'invalid'})).status,400);
    const connect=await (await post(one,'/api/x/connect')).json();
    assert.equal(new URL(connect.url).hostname,'x.com',JSON.stringify(connect));
    const state=new URL(connect.url).searchParams.get('state');
    await storage.transaction(data=>assert.ok(data.oauthPending[state],'OAuth pending state is persisted')); 
    const callback=await fetch(two+'/api/x/callback?state='+state+'&code=test',{headers,redirect:'manual'});
    assert.equal(callback.headers.get('location'),'/?x=connected');
    const social=await Promise.all([post(one,'/api/quests/follow-hexisnetwork/claim'),post(two,'/api/quests/follow-hexisnetwork/claim')]);
    assert.deepEqual(social.map(r=>r.status).sort(),[200,409]);
    await storage.transaction(data=>{data.users[address].completions={...data.users[address].completions,quiz:Date.now(),explore:Date.now()};});
    const weekly=await Promise.all([post(one,'/api/weekly/claim',{id:'weekly-explorer',xp:99999}),post(two,'/api/weekly/claim',{id:'weekly-explorer'})]);
    assert.deepEqual(weekly.map(r=>r.status).sort(),[200,409]);
    await assert.rejects(storage.transaction(data=>{data.users[address].xp=99999;throw Error('rollback test');}),/rollback test/);
    await storage.close();storage=createStorage({connectionString});
    await storage.transaction(data=>{assert.equal(data.users[address].xp,265);assert.equal(data.users[address].xAccount.id,'123');assert.equal(Object.keys(data.users[address].weeklyClaims).length,1);});
    const three=await start();
    const me=await (await fetch(three+'/api/me',{headers})).json();
    assert.equal(me.user.xp,265);assert.equal(me.user.streak.current,1);
    assert.equal((await post(three,'/api/quests/daily/claim')).status,409);
    assert.equal((await fetch(three+'/api/health').then(r=>r.json())).storage,'postgres');
  }catch(error){console.error(error);throw error;}finally{
    await Promise.all(children.map(async child=>{if(child.exitCode===null){child.kill();await once(child,'exit');child.stdout.destroy();child.stderr.destroy();}}));
    await storage?.close();
    if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}
    const embeddedProcess=embedded?.process;
    await embedded?.stop();
    embeddedProcess?.stdout?.destroy();embeddedProcess?.stderr?.destroy();
    if(directory)await rm(directory,{recursive:true,force:true});
  }
});
