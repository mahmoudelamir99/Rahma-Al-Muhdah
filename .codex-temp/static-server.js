const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2'};
http.createServer((req,res)=>{
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//,''));
  if (!filePath.startsWith(root)) { res.statusCode=403; return res.end('Forbidden'); }
  fs.stat(filePath,(err,stat)=>{
    if (err) { res.statusCode=404; return res.end('Not found'); }
    if (stat.isDirectory()) filePath = path.join(filePath,'index.html');
    fs.readFile(filePath,(readErr,data)=>{
      if (readErr) { res.statusCode=404; return res.end('Not found'); }
      res.setHeader('Content-Type', mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
      res.end(data);
    });
  });
}).listen(8012,'127.0.0.1');
