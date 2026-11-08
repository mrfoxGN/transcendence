import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createStatusServer } from './server.mjs';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => server.close(resolve));

test('status HTTP API: health, failure, freshness and private fixed queries', async () => {
  let mode = 'healthy'; let calls = 0;
  const prometheus = http.createServer((request, response) => {
    calls++;
    const url = new URL(request.url, 'http://localhost');
    const q = url.searchParams.get('query');
    assert.equal(url.pathname, '/api/v1/query');
    assert.match(q, /^(probe_success|mysql_up|up)\{job="(backend-https|mysql)"\}/);
    assert.ok(q.includes('timestamp('));
    if (mode === 'unreachable') { response.writeHead(503); response.end(); return; }
    if (mode === 'timeout') return;
    if (mode === 'oversized') { response.end('x'.repeat(70000)); return; }
    if (mode === 'malformed') { response.end('not JSON'); return; }
    const now = Date.now()/1000;
    const value = (mode === 'backend-down' && q.startsWith('probe_success')) || (mode === 'mysql-down' && q.startsWith('mysql_up')) || (mode === 'scrape-failed' && q.startsWith('up')) ? '0' : '1';
    const timestamp = mode === 'stale' ? now-120 : mode === 'future' ? now+120 : now;
    let result = [{metric:{instance:'private-host:1234'},value:[now,value]},{metric:{instance:'private-host:1234',sample_timestamp:'true'},value:[now,String(timestamp)]}];
    if(mode === 'missing') result=[];
    if(mode === 'ambiguous') result.push(result[0]);
    response.setHeader('Content-Type','application/json');
    response.end(JSON.stringify({status:'success',data:{resultType:'vector',result}}));
  });
  const base=await listen(prometheus);const server=createStatusServer(base);const publicBase=await listen(server);
  try {
    for(const [scenario,overall,backend,database] of [
      ['healthy','operational','operational','operational'],
      ['backend-down','down','down','operational'],
      ['mysql-down','down','operational','down'],
      ...['stale','future','missing','ambiguous','scrape-failed','unreachable','malformed','timeout','oversized'].map(s=>[s,'unknown','unknown','unknown']),
    ]) {
      mode=scenario;
      const response=await fetch(publicBase+'/status/api?query=secret&url=http://arbitrary');
      const text=await response.text();const data=JSON.parse(text);
      assert.equal(response.headers.get('cache-control'),'no-store');
      assert.equal(data.overall,overall,scenario);
      assert.deepEqual(data.services.map(s=>s.state),[backend,database],scenario);
      assert.ok(!text.includes('private-host')&&!text.includes('secret'));
    }
    const n=calls;
    assert.equal((await fetch(publicBase+'/status/api',{method:'POST'})).status,405);
    assert.equal((await fetch(publicBase+'/api/v1/query')).status,404);
    assert.equal(calls,n);
    assert.equal((await fetch(publicBase+'/healthz')).status,200);
    assert.match(await (await fetch(publicBase+'/status')).text(),/Service status/);
    await close(prometheus);
    assert.equal((await (await fetch(publicBase+'/status/api')).json()).overall,'unknown');
  } finally { await close(server);if(prometheus.listening)await close(prometheus); }
});
