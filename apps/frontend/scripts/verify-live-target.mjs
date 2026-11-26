import { chromium, request } from '@playwright/test';
import { io } from 'socket.io-client';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';

// Only use an isolated migration stack. Creates synthetic test records; never deletes
// or edits existing users/workspaces. No email, GitHub authorization or chat sends.
const base = process.env.DEVUP_LIVE_URL || 'https://localhost:8447';
assert.ok(
  base === 'https://localhost:8447',
  'This check is restricted to the isolated local stack',
);
let api = await request.newContext({ baseURL: base, ignoreHTTPSErrors: true });
const stamp = Date.now().toString(36),
  password = randomBytes(20).toString('base64url') + 'aA1!';
const email = `migration.${stamp}@example.test`;
const checks = [];
async function call(method, path, data, status) {
  const response = await api.fetch('/api/' + path, {
    method,
    ...(data !== undefined ? { data } : {}),
  });
  if (status)
    assert.equal(response.status(), status, method + ' ' + path + ' ' + (await response.text()));
  else
    assert.ok(
      response.ok(),
      method + ' ' + path + ' ' + response.status() + ' ' + (await response.text()),
    );
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}
let browser;
try {
  const user = await call(
    'POST',
    'auth/register',
    { username: 'migration_' + stamp, email, password },
    201,
  );
  const login = await call('POST', 'auth/login', { email, password }, 200);
  assert.ok(login.accessToken);
  await api.dispose();
  api = await request.newContext({
    baseURL: base,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: 'Bearer ' + login.accessToken },
  });
  const profile = await call('GET', 'auth/profile');
  assert.equal(profile.id, user.id);
  checks.push('register/login/profile');
  await call('PATCH', 'users/' + user.id, { theme: 'dark', notificationBadge: false });
  const saved = await call('GET', 'auth/profile');
  assert.equal(saved.theme, 'dark');
  assert.equal(saved.notificationBadge, false);
  checks.push('persisted personal preferences');
  const workspace = await call(
    'POST',
    'workspaces',
    {
      name: 'Migration verification ' + stamp,
      description: 'Synthetic isolated API/UI verification',
    },
    201,
  );
  const prefix = 'workspaces/' + workspace.id;
  const project = await call(
    'POST',
    prefix + '/projects',
    { name: 'Migration sample project', status: 'active', ownerId: user.id },
    201,
  );
  const milestone = await call(
    'POST',
    prefix + '/projects/' + project.id + '/milestones',
    { name: 'Verified release' },
    201,
  );
  const tasks = [];
  for (const [i, title] of ['Prepare catalog', 'Review checkout', 'Validate release'].entries()) {
    const task = await call(
      'POST',
      prefix + '/tasks',
      {
        title,
        description: 'Synthetic migration check',
        priority: ['MEDIUM', 'HIGH', 'LOW'][i],
        assigneeId: user.id,
      },
      201,
    );
    await call(
      'PUT',
      prefix + '/projects/task-links/' + task.id,
      { projectId: project.id, milestoneId: milestone.id },
      204,
    );
    for (const toStatus of i === 0
      ? ['TODO', 'READY', 'IN_PROGRESS', 'REVIEW', 'DONE']
      : i === 1
        ? ['TODO', 'READY', 'IN_PROGRESS']
        : ['TODO', 'READY'])
      await call('POST', 'tasks/' + task.id + '/transition', { toStatus });
    tasks.push(task);
  }
  const board = await call('GET', prefix + '/board');
  assert.equal(board.activeCount, 1);
  assert.equal(board.columns.find((c) => c.status === 'DONE').tasks.length, 1);
  const projects = await call('GET', prefix + '/projects');
  assert.equal(projects[0].progress.done, 1);
  assert.equal(projects[0].progress.total, 3);
  checks.push('task workflow/assignment, projects, milestones and progress');
  await call('POST', 'tasks/' + tasks[1].id + '/block', { reason: 'Synthetic blocker' }, 200);
  await call('DELETE', 'tasks/' + tasks[1].id + '/block', undefined, 200);
  await call('PUT', 'tasks/' + tasks[0].id + '/watch');
  assert.equal((await call('GET', 'tasks/' + tasks[0].id + '/watch')).watching, true);
  await call('DELETE', 'tasks/' + tasks[0].id + '/watch');
  const note = await call(
    'POST',
    prefix + '/notes',
    {
      title: 'Migration verification note',
      content: 'Catalog decisions and next steps for ' + tasks[0].taskKey,
    },
    201,
  );
  await call('PATCH', prefix + '/notes/' + note.id, { pinned: true });
  const notes = await call('GET', prefix + '/notes?page=1&limit=100');
  assert.ok(notes[0].pinnedAt);
  await call('GET', prefix + '/notes?page=1&limit=100&search=not-supported', undefined, 400);
  checks.push('Notes CRUD/pin and strict query contract');
  const uploaded = await api.post('/api/' + prefix + '/files', {
    multipart: {
      file: {
        name: 'migration-checklist.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Synthetic migration verification checklist'),
      },
      displayName: 'migration-checklist.txt',
    },
  });
  assert.equal(uploaded.status(), 201);
  const file = await uploaded.json();
  const files = await call('GET', prefix + '/files?page=1&limit=100');
  assert.equal(files.length, 1);
  await call('GET', prefix + '/files?page=1&limit=100&lookahead=1', undefined, 400);
  await call('PATCH', prefix + '/files/' + file.id, { displayName: 'migration-verified.txt' });
  const download = await api.get('/api/' + prefix + '/files/' + file.id + '/download');
  assert.equal(await download.text(), 'Synthetic migration verification checklist');
  checks.push('authenticated multipart upload, rename, download, strict file queries');
  const analytics = await call('GET', prefix + '/analytics?days=7');
  assert.equal(analytics.rows.length, 7);
  assert.ok(analytics.completions.length > 0);
  assert.ok((await call('GET', prefix + '/activities?limit=100')).length > 0);
  await call('GET', 'notifications/preferences');
  await call('GET', prefix + '/messages?limit=20');
  await call('GET', 'direct-conversations?limit=20');
  await call('GET', prefix + '/github/repository', undefined, 204);
  checks.push('analytics, activity, notifications, chat reads, disconnected GitHub');
  await call('PATCH', prefix + '/archive');
  await call('POST', prefix + '/tasks', { title: 'Must not be created' }, 409);
  await call('PATCH', prefix + '/unarchive');
  checks.push('archive/read-only rejection');
  await new Promise((resolve, reject) => {
    const socket = io(base, {
      auth: { token: login.accessToken },
      rejectUnauthorized: false,
      transports: ['websocket'],
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket readiness timed out'));
    }, 15000);
    socket.on('workspace-chat.ready', () =>
      socket.emit('workspace-chat.join', workspace.id, (joined) => {
        clearTimeout(timer);
        socket.disconnect();
        joined ? resolve() : reject(new Error('Workspace socket join denied'));
      }),
    );
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
  checks.push('real authenticated Socket.IO readiness/join');
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 950 },
  });
  await context.addInitScript(
    (token) => sessionStorage.setItem('devup.access-token', token),
    login.accessToken,
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const home = base + '/workspaces/' + workspace.id + '?page=';
  await fs.mkdir('/tmp/mrfoxgn-migration-artifacts', { recursive: true });
  for (const name of [
    'home',
    'projects',
    'board',
    'backlog',
    'notes',
    'files',
    'team',
    'github',
    'analytics',
    'activity',
    'chat',
    'settings',
  ]) {
    await page.goto(home + name);
    await page.locator('.wu-page-heading').waitFor();
    await page.waitForTimeout(200);
    assert.ok(
      !/Could not load files|Could not load notes/.test(await page.locator('body').innerText()),
      name + ' loads',
    );
    if (['home', 'notes', 'files', 'settings'].includes(name))
      await page.screenshot({
        path: `/tmp/mrfoxgn-migration-artifacts/live-${name}-dark.png`,
        fullPage: true,
      });
  }
  await page.goto(home + 'settings#profile');
  await page.getByRole('button', { name: 'Change avatar', exact: true }).click();
  await page.getByRole('button', { name: 'Use your own image' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles('public/illustrations/empty-states/geometric/light/tasks.webp');
  await page.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('.wu-avatar-large')
      ?.getAttribute('src')
      ?.startsWith('data:image/jpeg;base64,'),
  );
  assert.ok((await call('GET', 'auth/profile')).avatarUrl.startsWith('data:image/jpeg;base64,'));
  checks.push('real browser custom avatar compression/save');
  await page.goto(home + 'files');
  await page.locator('.wu-files-table tbody tr').first().waitFor();
  assert.match(await page.locator('.wu-files-table').innerText(), /migration-verified.txt/);
  await page.goto(home + 'notes');
  await page.getByRole('button', { name: 'Migration verification note', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  checks.push('12 real-backed workspace pages without JavaScript errors');
  console.log(
    JSON.stringify(
      {
        base,
        workspaceId: workspace.id,
        checks,
        notExercised: [
          'real email delivery / 2FA email confirmation',
          'external GitHub authorization and sync',
          'multi-user chat delivery',
        ],
        note: 'Synthetic records retained only in isolated migration database; no credentials logged.',
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await api.dispose();
}
