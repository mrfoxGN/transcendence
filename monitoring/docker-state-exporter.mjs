import http from 'node:http';

// Only fixed GET requests are sent to Docker; HTTP callers cannot supply a target.
const endpoint = new URL(process.env.DOCKER_API_URL || 'http://docker-api-proxy:2375');
if (endpoint.protocol !== 'http:' || endpoint.username || endpoint.password || endpoint.pathname !== '/') throw new Error('Invalid Docker API endpoint');
const project = process.env.COMPOSE_PROJECT;
if (!project) throw new Error('COMPOSE_PROJECT is required');
const api = '/v1.45';
const encodeLabel = value => String(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');

function dockerGet(path) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: endpoint.hostname, port: endpoint.port || 80, path: api + path }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 4 * 1024 * 1024) request.destroy(new Error('Docker response too large'));
      });
      response.on('error', reject);
      response.on('end', () => {
        if (response.statusCode === 404) return resolve(null);
        if (response.statusCode !== 200) return reject(new Error('Docker request failed'));
        try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid Docker response')); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('Docker request timeout')), 3000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
  });
}

const upHeader = '# HELP docker_state_up Whether the Docker state collection succeeded.\n# TYPE docker_state_up gauge\n';
let pending;
async function collect() {
  const filters = encodeURIComponent(JSON.stringify({ label: [`com.docker.compose.project=${project}`] }));
  const containers = await dockerGet(`/containers/json?all=1&filters=${filters}`);
  if (!Array.isArray(containers)) throw new Error('Invalid container list');
  const lines = [upHeader + 'docker_state_up 1',
    '# HELP docker_container_restart_count Docker RestartCount for this container ID; may reset on recreation or restart-manager reset.',
    '# TYPE docker_container_restart_count gauge',
    '# HELP docker_container_running Whether Docker reports the container as running.',
    '# TYPE docker_container_running gauge'];
  // Bounded batches avoid opening one socket per container on large hosts.
  for (let offset = 0; offset < containers.length; offset += 4) {
    const details = await Promise.all(containers.slice(offset, offset + 4).map(container => {
      if (!/^[a-f0-9]{64}$/.test(container.Id)) throw new Error('Invalid container ID');
      return dockerGet(`/containers/${container.Id}/json`);
    }));
    for (const container of details) {
      if (!container) continue; // Removed between listing and inspection.
      if (container.Config?.Labels?.['com.docker.compose.project'] !== project) continue;
      if (!Number.isSafeInteger(container.RestartCount) || container.RestartCount < 0) throw new Error('Invalid restart count');
      const labels = Object.entries({
        project, name: container.Name.replace(/^\//, ''),
        service: container.Config.Labels['com.docker.compose.service'] || '',
        container_id: container.Id,
      }).map(([key, value]) => `${key}="${encodeLabel(value)}"`).join(',');
      lines.push(`docker_container_restart_count{${labels}} ${container.RestartCount}`);
      lines.push(`docker_container_running{${labels}} ${container.State.Running ? 1 : 0}`);
    }
  }
  return lines.join('\n') + '\n';
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
  if (request.url === '/healthz') { response.end('ok\n'); return; }
  if (request.url !== '/metrics') { response.writeHead(404); response.end(); return; }
  try {
    // Concurrent scrapes share work; failures never reuse previously healthy data.
    if (!pending) pending = collect().finally(() => { pending = undefined; });
    const metrics = await pending;
    response.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    response.end(metrics);
  } catch {
    // A reachable exporter with an unreachable daemon reports its own explicit 0.
    // No inspect response, container environment, or raw error is exposed.
    response.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    response.end(upHeader + 'docker_state_up 0\n');
    console.error('Docker state collection failed');
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(9105, '0.0.0.0');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
