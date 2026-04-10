const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.mp4':'video/mp4'};
const root = process.cwd();
const server = http.createServer((req,res)=>{
  const reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(root, reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, ''));
  if (!filePath.startsWith(root)) { res.statusCode = 403; res.end('Forbidden'); return; }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) { res.statusCode = 404; res.end('Not Found'); return; }
      res.setHeader('Content-Type', mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
      res.end(data);
    });
  });
});
server.listen(4180, '127.0.0.1', ()=>console.log('STATIC_SERVER_READY:http://127.0.0.1:4180'));
