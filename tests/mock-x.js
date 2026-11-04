// Only identity requests are allowed; following lookups must never happen.
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.x.com/'))return nativeFetch(url,options);
  let body;
  if(String(url).endsWith('/oauth2/token'))body={access_token:'test-token',expires_in:7200};
  else if(String(url).endsWith('/users/me'))body={data:{id:'123',username:'test_explorer'}};
  else throw new Error('Unexpected X API request: only OAuth identity is allowed');
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
};
