import handler from '../server/index.js';

export default async function vercelHandler(req,res) {
  const url=new URL(req.url,'http://localhost');
  const route=url.searchParams.get('__route');
  if(route!==null){
    url.searchParams.delete('__route');
    url.pathname='/api/'+route;
    req.url=url.pathname+url.search;
  }
  return handler(req,res);
}
