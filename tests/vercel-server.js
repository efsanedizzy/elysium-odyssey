// Simulate Vercel's rewrite and pre-parsed JSON request body.
import http from 'node:http';
import handler from '../api/index.js';
const server=http.createServer(async(req,res)=>{
  if(req.method==='POST'){
    let body='';for await(const chunk of req)body+=chunk;
    try{req.body=JSON.parse(body||'{}');}catch{req.body=body;}
  }
  req.headers.host='localhost'; // Shared canonical domain, as on Vercel.
  const url=new URL(req.url,'http://localhost');
  const route=url.pathname.replace(/^\/api\//,'');
  url.pathname='/api/index';url.searchParams.set('__route',route);req.url=url.pathname+url.search;
  await handler(req,res);
});
server.listen(0,'127.0.0.1',()=>console.log(`http://127.0.0.1:${server.address().port}`));
