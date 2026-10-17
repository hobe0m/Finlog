// Test the built files below the same repository path used by GitHub Pages.
// There is deliberately no API or SPA fallback: only real static files are served.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('dist');
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/Finlog/')){res.writeHead(404);res.end();return;}
  const relative=decodeURIComponent(url.pathname.slice('/Finlog/'.length))||'index.html';
  const target=resolve(root,relative);
  if(!target.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{const content=await readFile(target);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(target)]||'application/octet-stream');res.end(content);}
  catch{res.writeHead(404);res.end();}
}).listen(3012,'127.0.0.1',()=>console.log('Static Pages preview: http://localhost:3012/Finlog/'));
