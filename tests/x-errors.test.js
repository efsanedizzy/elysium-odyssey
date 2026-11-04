import test from 'node:test';
import assert from 'node:assert/strict';
import { createXService } from '../server/x.js';

for (const [status, problem, expected] of [
  [402, {title:'CreditsDepleted'}, /credits are depleted/],
  [403, {type:'https://api.x.com/2/problems/credits-depleted'}, /credits are depleted/],
  [403, {title:'Forbidden'}, /endpoint access and users.read/],
  [401, {}, /authorization expired/],
  [429, {}, /rate limit/],
  [400, {}, /request parameters/],
  [503, {detail:'private-secret-token'}, /could not complete/],
]) {
  test(`X HTTP ${status} is classified without leaking raw response data`, async () => {
    const service=createXService({clientId:'test',redirectUri:'http://localhost/api/x/callback',fetchImpl:async url=>{
      if(String(url).endsWith('/token'))return {ok:true,json:async()=>({access_token:'test-secret',expires_in:7200})};
      return {ok:false,status,json:async()=>({...problem,detail:'private-secret-token'})};
    }});
    const state=new URL(service.start('s','w')).searchParams.get('state');
    await assert.rejects(service.callback('s','w',state,'code'),error=>{
      assert.match(error.message,expected);
      assert.match(error.message,new RegExp('X API '+status));
      assert.equal(error.message.includes('private-secret-token'),false);
      assert.equal(service.status('s'),null,'failed identity lookup cannot link an account');
      return true;
    });
  });
}
