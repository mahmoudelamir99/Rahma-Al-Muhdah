const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
};

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveFilePath(requestPath) {
  const normalizedPath = path.normalize(requestPath).replace(/^(\.\.(\\|\/|$))+/, '').replace(/^[/\\]+/, '');
  const joinedPath = path.join(rootDir, normalizedPath);
  return joinedPath;
}

const server = http.createServer((req, res) => {
  const rawPath = (req.url || '/').split('?')[0];
  let requestPath = decodeURIComponent(rawPath || '/');
  if (!requestPath || requestPath === '/') requestPath = '/index.html';

  const filePath = resolveFilePath(requestPath);
  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('not found');
      return;
    }

    const finalPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    fs.readFile(finalPath, (readError, data) => {
      if (readError) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('not found');
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', getContentType(finalPath));
      res.end(data);
    });
  });
});

server.listen(port, host, () => {
  process.stdout.write(`READY ${host}:${port}\n`);
});

