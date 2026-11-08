import http from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const html = readFileSync(new URL('./index.html', import.meta.url));
const maxAge = 60;
const components = [
  { name: 'Backend', metric: 'probe_success{job="backend-https"}', scrape: 'up{job="backend-https"}' },
  { name: 'Database', metric: 'mysql_up{job="mysql"}', scrape: 'up{job="mysql"}' },
];

// Use timestamp(metric): an instant query's result timestamp is its evaluation
// time, which alone cannot prove that the underlying scrape is fresh.
function query(base, expression) {
  const url = new URL('/api/v1/query', base);
  url.searchParams.set('query', `${expression} or label_replace(timestamp(${expression}), "sample_timestamp", "true", "", "")`);
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      let body = ''; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 65536) { response.destroy(); reject(new Error('Response too large')); }
        else body += chunk;
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (response.statusCode !== 200 || data.status !== 'success' || data.data.resultType !== 'vector') throw new Error('Unavailable');
          resolve(data.data.result);
        } catch (error) { reject(error); }
      });
    });
    request.setTimeout(3000, () => request.destroy(new Error('Timeout')));
    request.on('error', reject);
  });
}

export function sample(rows, now) {
  const values = rows.filter(r => r.metric?.sample_timestamp !== 'true');
  const times = rows.filter(r => r.metric?.sample_timestamp === 'true');
  if (values.length !== 1 || times.length !== 1) return null;
  const value = Number(values[0].value?.[1]);
  const time = Number(times[0].value?.[1]);
  if (![0, 1].includes(value) || !Number.isFinite(time) || now - time > maxAge || time - now > 5) return null;
  return { value, time };
}

export function createStatusServer(base = 'http://prometheus:9090') {
  let pending;
  // Only fixed queries are issued. Request parameters cannot select PromQL or URLs.
  async function snapshot() {
    if (pending) return pending;
    pending = Promise.all(components.map(async component => {
      try {
        const [values, scrapes] = await Promise.all([query(base, component.metric), query(base, component.scrape)]);
        const now = Date.now() / 1000;
        const metric = sample(values, now); const scrape = sample(scrapes, now);
        if (!metric || !scrape || scrape.value !== 1) throw new Error('Unknown');
        return { name: component.name, state: metric.value === 1 ? 'operational' : 'down', checkedAt: new Date(Math.min(metric.time, scrape.time) * 1000).toISOString() };
      } catch {
        return { name: component.name, state: 'unknown', checkedAt: null };
      }
    })).then(services => ({
      overall: services.some(s => s.state === 'down') ? 'down' : services.some(s => s.state === 'unknown') ? 'unknown' : 'operational',
      generatedAt: new Date().toISOString(), maxAgeSeconds: maxAge, services,
    })).finally(() => { pending = undefined; });
    return pending;
  }
  return http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/healthz') { response.end('ok'); return; }
    if (path === '/status' || path === '/status/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
      response.end(request.method === 'HEAD' ? undefined : html); return;
    }
    if (path === '/status/api') {
      response.setHeader('Content-Type', 'application/json');
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(await snapshot())); return;
    }
    response.writeHead(404); response.end();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createStatusServer().listen(8080, '0.0.0.0', () => console.log('Status page listening on 8080'));
}
