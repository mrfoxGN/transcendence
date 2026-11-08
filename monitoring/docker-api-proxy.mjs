import http from 'node:http';
import { pathToFileURL } from 'node:url';

const labels = input => Object.fromEntries(Object.entries(input || {}).filter(([k]) => ['com.docker.compose.project', 'com.docker.compose.service'].includes(k)));
export function allowed(method, raw) {
  if (!['GET', 'HEAD'].includes(method) || typeof raw !== 'string') return false;
  const [path, query] = raw.split('?');
  if (!/^\/(?:v\d+\.\d+\/)?(?:_ping|version|info|containers\/json|containers\/[a-f0-9]{64}\/json)$/.test(path)) return false;
  if (method === 'HEAD' && !path.endsWith('/_ping')) return false;
  if (raw.split('?').length > 2) return false;
  if (query !== undefined && !path.endsWith('/containers/json')) return false;
  if (query !== undefined) {
    const params = new URLSearchParams(query);
    if ([...params.keys()].some(k => !['all', 'filters'].includes(k)) || params.getAll('all').length > 1 || params.getAll('filters').length > 1) return false;
    if (params.has('all') && !['1', '0', 'true', 'false'].includes(params.get('all'))) return false;
    if (params.has('filters')) {
      try { const f = JSON.parse(params.get('filters')); if (!f || Array.isArray(f) || typeof f !== 'object' || Object.keys(f).some(k => k !== 'label') || (f.label && (!Array.isArray(f.label) || f.label.some(v => typeof v !== 'string')))) return false; } catch { return false; }
    }
  }
  return true;
}
export function sanitize(path, data) {
  if (/\/containers\/[a-f0-9]{64}\/json$/.test(path)) {
    return { Id:data.Id, Name:data.Name, Created:data.Created, RestartCount:data.RestartCount,
      State:{Running:data.State?.Running, Pid:data.State?.Pid, StartedAt:data.State?.StartedAt, FinishedAt:data.State?.FinishedAt, Status:data.State?.Status},
      Config:{Image:data.Config?.Image, Labels:labels(data.Config?.Labels)},
      HostConfig:{NetworkMode:data.HostConfig?.NetworkMode}, NetworkSettings:data.NetworkSettings };
  }
  if (path.endsWith('/containers/json')) return data.map(c => ({Id:c.Id,Names:c.Names,Image:c.Image,State:c.State,Status:c.Status,Labels:labels(c.Labels)}));
  return data;
}
export function createProxy(socketPath = '/var/run/docker.sock') {
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control','no-store');
    if (request.method === 'GET' && request.url === '/healthz') { response.end('ok'); return; }
    if (!allowed(request.method, request.url) || request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
      response.writeHead(403);response.end('Forbidden');return;
    }
    // Never forward client headers, credentials, request bodies or arbitrary hosts.
    const upstream = http.request({socketPath,method:request.method,path:request.url}, incoming => {
      const chunks=[];let bytes=0;
      incoming.on('data',chunk=>{bytes+=chunk.length;if(bytes>8*1024*1024)upstream.destroy(new Error('Too large'));else chunks.push(chunk);});
      incoming.on('error',()=>upstream.destroy(new Error('Upstream failure')));
      incoming.on('end',()=>{
        if(response.destroyed || response.writableEnded)return;
        try {
          const path=request.url.split('?')[0];
          if(incoming.statusCode!==200){response.writeHead(incoming.statusCode===404?404:502);response.end('Unavailable');return;}
          for(const name of ['api-version','ostype','docker-experimental'])if(incoming.headers[name])response.setHeader(name,incoming.headers[name]);
          if(path.endsWith('/_ping')){response.end(request.method==='HEAD'?undefined:'OK');return;}
          const data=sanitize(path,JSON.parse(Buffer.concat(chunks).toString('utf8')));
          response.setHeader('Content-Type','application/json');response.end(JSON.stringify(data));
        }catch{response.writeHead(502);response.end('Unavailable');}
      });
    });
    const timer=setTimeout(()=>upstream.destroy(new Error('Timeout')),5000);
    upstream.on('close',()=>clearTimeout(timer));
    upstream.on('error',()=>{if(!response.writableEnded&&!response.destroyed){response.writeHead(502);response.end('Unavailable');}});
    response.on('close',()=>upstream.destroy());upstream.end();
  });
  server.requestTimeout=10000;server.headersTimeout=10000;
  server.on('upgrade',(_r,s)=>s.destroy());server.on('connect',(_r,s)=>s.destroy());
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createProxy().listen(2375,'0.0.0.0');
