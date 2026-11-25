import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// Test-only HTTP fixtures model this branch's API; production imports none of them.
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:950}});
const wid='11111111-1111-4111-8111-111111111111', uid='22222222-2222-4222-8222-222222222222';
const stamp='2026-11-22T12:00:00Z';
const profile={id:uid,username:'Alex Morgan',email:'alex@example.test',theme:'light',isTwoFactorEnabled:false,emailVerified:true,avatarUrl:null,notificationBadge:true};
const workspace={id:wid,ownerId:uid,name:'DevUP workspace',description:'Team workspace',archivedAt:null,reportingTimeZone:'Africa/Casablanca'};
const members=[{userId:uid,username:'Alex Morgan',isOwner:true,avatarUrl:null,joinedAt:stamp},{userId:'u2',username:'Sarah Kim',isOwner:false,avatarUrl:null,joinedAt:stamp}];
const statuses=['BACKLOG','TODO','READY','IN_PROGRESS','REVIEW','DONE','CANCELLED'];
const tasks=statuses.slice(0,6).map((status,i)=>({id:'t'+i,taskKey:'TASK-'+(i+1),title:['Backlog idea','Polish mobile layout','Review release','Build login page','Check accessibility','Write release notes'][i],description:'Task description',acceptanceCriteria:'Reviewed and tested',status,boardColumnId:status,position:i,priority:'MEDIUM',dueDate:'2026-11-25',dueAt:'2026-11-25T12:00:00Z',isBlocked:false,blockedReason:null,completedAt:status==='DONE'?stamp:null}));
const columns=statuses.map((status,i)=>({id:status,label:['Backlog','To do','Ready','In progress','Review','Done','Cancelled'][i],status}));
let files=[{id:'f1',displayName:'Design.pdf',mimeType:'application/pdf',sizeBytes:'2048',uploaderId:uid,createdAt:stamp,taskId:null},{id:'f2',displayName:'Release.txt',mimeType:'text/plain',sizeBytes:'100',uploaderId:'u2',createdAt:stamp,taskId:null}];
let notes=[{id:'n1',title:'Planning notes',content:'Decisions and next steps for TASK-1.',creatorId:uid,updatedAt:stamp,pinnedAt:null,revision:1}];
const projects=[{id:'p1',name:'Workspace experience',ownerId:uid,targetDate:'2026-12-01',status:'active',progress:{total:5,done:1},milestones:[],tasks:tasks.map(t=>({...t,taskNumber:Number(t.taskKey.slice(5)),milestoneId:null}))}];
const commits=tasks.map((t,i)=>({id:'co'+i,sha:String(i+1).repeat(40),message:t.title,authorName:'Alex Morgan',committedAt:stamp,githubUrl:'https://github.com/example/devup/commit/'+String(i+1).repeat(40)}));
const activity=tasks.map((t,i)=>({id:'a'+i,actorUserId:uid,actorName:'Alex Morgan',actionType:'TASK_CREATED',resourceType:'task',resourceId:t.id,resourceState:'available',subjectName:t.title,metadata:{title:t.title,taskTitle:t.title},createdAt:stamp}));
const kanban={activeWipLimit:5,definitionOfReady:'Clear scope',definitionOfDone:'Reviewed'};
const chatMessages=Array.from({length:18},(_,i)=>({id:'message-'+i,senderId:i%4<2?'u2':uid,content:i===4?'Review https://example.test/design/review?project=devup and https://[invalid':i===17?'Latest update: the chat layout is ready for review.':i===15?'Long message '+('Readable content with clear spacing. '.repeat(30)):'Project update '+i,createdAt:new Date(Date.parse(stamp)+i*60000).toISOString()}));
const errors=[],unknown=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>sessionStorage.setItem('devup.access-token','test-contract-token'));
const socketEvents=[];let joinedWorkspace=false;
await page.route('**/socket.io/**',async route=>{
 if(!process.env.TOAST_ONLY)return route.fulfill({body:route.request().method()==='POST'?'ok':'0'+JSON.stringify({sid:'test',upgrades:[],pingInterval:25000,pingTimeout:20000}),contentType:'text/plain'});
 const req=route.request(),url=new URL(req.url());
 if(req.method()==='POST'){
  for(const packet of (req.postData()??'').split('\x1e')){
   if(packet.startsWith('40'))socketEvents.push('40'+JSON.stringify({sid:'test'}),'42'+JSON.stringify(['workspace-chat.ready']));
   const join=packet.match(/^42(\d+)\["workspace-chat.join"/);
   if(join){joinedWorkspace=true;socketEvents.push('43'+join[1]+'[true]');}
  }
  return route.fulfill({body:'ok',contentType:'text/plain'});
 }
 if(!url.searchParams.has('sid'))return route.fulfill({body:'0'+JSON.stringify({sid:'test',upgrades:[],pingInterval:25000,pingTimeout:20000}),contentType:'text/plain'});
 await new Promise(resolve=>setTimeout(resolve,100));
 return route.fulfill({body:socketEvents.splice(0).join('\x1e')||'2',contentType:'text/plain'});
});
await page.route('**/api/**',async route=>{
 const request=route.request(),url=new URL(request.url()),path=url.pathname.slice(5),method=request.method();
 const multipart=request.headers()['content-type']?.includes('multipart/form-data');
 const body=method==='GET'||multipart?{}:request.postDataJSON?.() ?? {};
 const json=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 if(method!=='GET')writes.push({path,method,body});
 if(path==='auth/profile')return json(profile);
 if(path==='workspaces')return json([workspace]);
 if(path===`workspaces/${wid}`){if(method==='PATCH')Object.assign(workspace,body);return json(workspace);}
 if(path===`users/${uid}`&&method==='PATCH'){
  const unknownKeys=Object.keys(body).filter(key=>!['username','email','theme','notificationBadge','avatarUrl','avatarImage'].includes(key));
  assert.deepEqual(unknownKeys,[],'Profile follows target DTO');
  if(body.avatarImage){assert.ok(!('avatarUrl' in body));const jpeg=Buffer.from(body.avatarImage.split(',')[1],'base64');assert.ok(jpeg.length<=24*1024);assert.equal(jpeg[0],255);assert.equal(jpeg[1],216);assert.equal(jpeg.at(-1),217);profile.avatarUrl=body.avatarImage;}
  Object.assign(profile,Object.fromEntries(Object.entries(body).filter(([key])=>key!=='avatarImage')));return json(profile);
 }
 if(path==='auth/2fa/request-enable')return route.fulfill({status:204});
 if(path==='auth/2fa/confirm-enable'){assert.equal(body.code,'123456');profile.isTwoFactorEnabled=true;return json(profile);}
 if(path==='auth/2fa/disable'){profile.isTwoFactorEnabled=false;return json(profile);}
 if(path.endsWith('/board'))return json({columns:statuses.map(status=>({status,tasks:tasks.filter(t=>t.status===status)})),boardColumns:columns,activeCount:2,activeWipLimit:5,reportingTimeZone:'Africa/Casablanca',assigneesByTaskId:Object.fromEntries(tasks.map(t=>[t.id,uid]))});
 if(path.endsWith('/members'))return json(members);
 if(path.endsWith('/kanban-settings')){if(method==='PATCH')Object.assign(kanban,body);return json(kanban);}
 if(path.includes('/analytics'))return json({timeZone:'Africa/Casablanca',asOf:stamp,rows:[{day:'2026-11-22',completed:1,counts:Object.fromEntries(statuses.map(s=>[s,1]))}],completions:[],durations:[],flowTasks:tasks});
 if(path.includes('/activities')||path.includes('/audit'))return json(url.searchParams.has('limit')?activity:{items:activity,total:activity.length,page:1,limit:20});
 if(path.endsWith('/unread-count'))return json({count:0});
 if(path.startsWith('notifications'))return json([]);
 if(path.endsWith('/invitations'))return json([]);
 if(path==='direct-conversations')return json(process.env.CHAT_ONLY?[{id:'dm1',otherUserId:'u2',otherUsername:'Sarah Kim',lastMessageAt:stamp,unreadCount:2}]:[]);
 if(path.endsWith('/messages')){
  if(!process.env.CHAT_ONLY)return json([]);
  if(method==='POST'){assert.deepEqual(Object.keys(body).sort(),['content','replyToId','requestId'].sort());const sent={id:'sent-message',senderId:uid,content:body.content,createdAt:new Date().toISOString()};chatMessages.push(sent);return json(sent);}
  return json(path.startsWith('direct-')?[]:chatMessages);
 }
 if((process.env.CHAT_ONLY||process.env.TOAST_ONLY) && path.endsWith('/read'))return json({});
 if(path.endsWith('/github/statistics/commits'))return json({days:30,timezone:'UTC',total:12,items:[{date:'2026-11-21',commits:4},{date:'2026-11-22',commits:8}]});
 if(path.endsWith('/github/contributors')||path.endsWith('/github/collaborators'))return json([{login:'alex-morgan',avatarUrl:'/devup.svg',profileUrl:'https://github.com/example',role:'admin',isOwner:true,contributions:12}]);
 if(path.endsWith('/github/repository'))return json({fullName:'example/devup',defaultBranch:'main',repositoryUrl:'https://github.com/example/devup',lastSyncedAt:stamp,githubRepositoryId:'1'});
 if(path.endsWith('/github/branches'))return json([{name:'main',sha:'1'.repeat(40),protected:true},{name:'feature/design',sha:'2'.repeat(40),protected:false}]);
 if(path.endsWith('/github/commits'))return json({items:commits,total:5,page:Number(url.searchParams.get('page')??1),limit:20});
 if(path.endsWith('/github/sync'))return json({synced:5});
 if(path.endsWith('/projects'))return json(projects);
 if(path.includes('/files')){
  const id=path.split('/files/')[1]?.split('/')[0];
  if(path.endsWith('/download'))return route.fulfill({body:'File contents',contentType:'text/plain'});
  if(method==='POST'){assert.equal(request.headers().authorization,'Bearer test-contract-token');assert.ok(multipart,'Uploads retain multipart encoding');const uploaded={id:'f3',displayName:'Upload check.txt',mimeType:'text/plain',sizeBytes:'18',uploaderId:uid,createdAt:stamp,taskId:null};files.push(uploaded);return json(uploaded);}
  if(method==='PATCH'){files=files.map(f=>f.id===id?{...f,...body}:f);return json(files.find(f=>f.id===id));}
  if(id)return json(files.find(f=>f.id===id));
  const unsupported=[...url.searchParams.keys()].filter(key=>!['page','limit'].includes(key));
  if(unsupported.length)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:unsupported.map(key=>'property '+key+' should not exist')})});
  const start=(Number(url.searchParams.get('page')??1)-1)*Number(url.searchParams.get('limit')??20);
  return json(files.slice(start,start+Number(url.searchParams.get('limit')??20)));
 }
 if(path.includes('/notes')){
  const id=path.split('/notes/')[1]?.split('/')[0];
  if(path.endsWith('/revisions'))return json([]);
  if(method==='POST'){const note={id:'n'+(notes.length+1),...body,creatorId:uid,pinnedAt:null,revision:1,updatedAt:stamp};notes.push(note);return json(note);}
  if(method==='PATCH'){const n=notes.find(n=>n.id===id);assert.ok(!('revision' in body),'Notes use the current update DTO');Object.assign(n,body,{updatedAt:stamp},'pinned' in body?{pinnedAt:body.pinned?stamp:null}:{});return json(n);}
  if(id)return json(notes.find(n=>n.id===id));
  const unsupported=[...url.searchParams.keys()].filter(key=>!['page','limit'].includes(key));
  if(unsupported.length)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Unsupported Notes query'})});
  const start=(Number(url.searchParams.get('page')??1)-1)*Number(url.searchParams.get('limit')??20);
  return json(notes.slice(start,start+Number(url.searchParams.get('limit')??20)));
 }
 if(path.endsWith('/assignment'))return json({userId:uid});
 if(path.endsWith('/comments')||path.endsWith('/dependencies'))return json([]);
 if(path.endsWith('/saved-views')||path.endsWith('/backlog-views'))return json([]);
 if(path.includes('/transition')){assert.ok(!('boardColumnId' in body),'Current transition DTO is status-only');return json({});}
 if(path.startsWith('tasks/')&&method==='PATCH')return json({...tasks.find(t=>t.id===path.split('/')[1]),...body});
 if(path.startsWith('tasks/')&&method==='GET')return json(tasks.find(t=>t.id===path.split('/')[1]));
 unknown.push({path,method});return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'No test fixture: '+path})});
});
const root=(process.env.DEVUP_APP_URL || 'http://localhost:5182')+'/workspaces/'+wid+'?page=';
await fs.mkdir('/tmp/devup-migration-artifacts',{recursive:true});
try{
 if(process.env.INPUTS_ONLY==='1'){
  const check=async locator=>{await locator.focus();const styles=await locator.evaluate(e=>{const s=getComputedStyle(e);return {outline:s.outlineStyle,shadow:s.boxShadow,border:s.borderColor};});assert.equal(styles.outline,'none','No stacked outline');assert.notEqual(styles.shadow,'none','Field has one soft focus ring');return styles;};
  for(const theme of ['light','dark'])for(const width of [1440,390]){
   profile.theme=theme;await page.setViewportSize({width,height:850});await page.goto(root+'settings#profile');await page.reload();const username=page.getByRole('textbox',{name:'Username',exact:true});await username.waitFor();await check(username);
   await username.evaluate(e=>e.setAttribute('aria-invalid','true'));const invalid=await check(username);assert.notEqual(invalid.border,await username.evaluate(e=>getComputedStyle(e).getPropertyValue('--field-state-line')));await username.evaluate(e=>e.removeAttribute('aria-invalid'));
   await page.goto(root+'files');const search=page.getByRole('searchbox',{name:'Search files',exact:true});await search.focus();const inner=await search.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,shadow:getComputedStyle(e).boxShadow}));assert.equal(inner.outline,'none');assert.equal(inner.shadow,'none');const owner=page.locator('.wu-list-search');assert.equal(await owner.evaluate(e=>getComputedStyle(e).outlineStyle),'none');assert.notEqual(await owner.evaluate(e=>getComputedStyle(e).boxShadow),'none');
   await page.goto(root+'chat');const input=page.getByRole('textbox',{name:'Message',exact:true});await input.waitFor();await check(input);const send=page.getByRole('button',{name:'Send message',exact:true});const a=await input.boundingBox(),b=await send.boundingBox();assert.ok(b.x-a.x-a.width>=11&&b.x-a.x-a.width<=13,'Send is separated by 12px');assert.ok(Math.abs(a.y+a.height-b.y-b.height)<=1,'Send aligns with input bottom');assert.equal(await page.locator('.wu-chat-composer').evaluate(e=>getComputedStyle(e).boxShadow),'none');assert.equal(await page.locator('.wu-chat-composer').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   await input.fill('First line\nSecond line\nThird line');const grown=await input.boundingBox(),button=await send.boundingBox();assert.ok(grown.height>a.height,'Composer grows');assert.ok(Math.abs(grown.y+grown.height-button.y-button.height)<=1);await page.screenshot({path:`/tmp/devup-migration-artifacts/input-chat-${theme}-${width}.png`});
   await input.fill('');assert.equal(await send.isDisabled(),true);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Inputs passed: regular/error focus, single-owner grouped search, separated composer spacing, growth and bottom alignment, disabled send, both themes and mobile.');process.exit(0);
 }
 if(process.env.FORMS_ONLY==='1'){
  for(const theme of ['light','dark'])for(const width of [1440,390]){
   profile.theme=theme;await page.setViewportSize({width,height:950});await page.goto(root+'settings#profile');await page.reload();const input=page.getByRole('textbox',{name:'Username',exact:true});await input.waitFor();await input.scrollIntoViewIfNeeded();
   const field=page.locator('.wu-field-group--action');const label=field.locator('label'),hint=page.locator('#settings-username-hint'),button=field.getByRole('button',{name:'Save username',exact:true});
   const l=await label.boundingBox(),i=await input.boundingBox(),h=await hint.boundingBox(),b=await button.boundingBox();
   assert.ok(i.y-l.y-l.height>=7&&i.y-l.y-l.height<=9,'Label to input gap is 8px');
   assert.ok(h.y-i.y-i.height>=7&&h.y-i.y-i.height<=9,'Helper stays 8px beneath input');
   assert.equal(await input.getAttribute('aria-describedby'),'settings-username-hint');
   if(width>600){assert.ok(Math.abs(b.height-i.height)<=1,'Inline action matches input height');assert.ok(b.x-i.x-i.width>=11,'Inline action has 12px gap');}
   else{assert.ok(b.y>=h.y+h.height+11,'Mobile action sits after helper with a clear gap');assert.ok(b.x+b.width<=width,'Mobile action fits screen');}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`/tmp/devup-migration-artifacts/form-profile-${theme}-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:950});await page.goto(root+'board');await page.getByRole('button',{name:'Add task',exact:true}).click();await page.locator('.wu-workspace-form-modal').waitFor();
  assert.equal(await page.locator('.wu-workspace-form-modal .wu-field-label').first().evaluate(e=>getComputedStyle(e).rowGap),'8px');await page.screenshot({path:'/tmp/devup-migration-artifacts/form-create-task.png'});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Forms passed: exact field/helper spacing, inline input/action height and gap, mobile helper/action ordering, helper association, theme views, overflow and task dialog field rhythm.');process.exit(0);
 }
 if(process.env.TOAST_ONLY==='1'){
  const emit=(id,thread='team',senderId='u2')=>socketEvents.push('42'+JSON.stringify([thread==='team'?'workspace-message.created':'direct-message.created',{id,senderId,content:'A new project update is ready for review.',createdAt:new Date().toISOString(),...(thread==='team'?{workspaceId:wid}:{conversationId:thread})}]));
  const toast=page.getByRole('region',{name:'New message notification'});
  await page.goto(root+'home');await page.locator('.wu-page').waitFor();
  for(let i=0;i<50&&!joinedWorkspace;i++)await page.waitForTimeout(100);
  assert.ok(joinedWorkspace,'Workspace message subscription stays active outside Chat');
  emit('self','team',uid);await page.waitForTimeout(350);assert.equal(await toast.count(),0,'Own messages stay quiet');
  emit('notice-1');await toast.waitFor();emit('notice-1');await page.waitForTimeout(250);assert.equal(await toast.getByText('2 messages',{exact:true}).count(),0,'Duplicate events do not increment the toast');
  emit('notice-2');await toast.getByText('2 messages',{exact:true}).waitFor();assert.match(await toast.locator('.wu-message-toast-progress').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);
  await toast.hover();const before=await toast.locator('.wu-message-toast-progress').evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(6200);assert.equal(await toast.count(),1,'Hover pauses expiry');assert.equal(await toast.locator('.wu-message-toast-progress').evaluate(e=>getComputedStyle(e).transform),before,'Hover pauses progress');
  await toast.getByRole('button',{name:'Dismiss message notification'}).focus();await page.mouse.move(0,0);await page.waitForTimeout(6200);assert.equal(await toast.count(),1,'Keyboard focus pauses expiry');
  await page.screenshot({path:'/tmp/devup-migration-artifacts/message-toast-light.png'});await toast.getByRole('button',{name:'Dismiss message notification'}).click();assert.equal(await toast.count(),0);
  emit('direct-1','dm1');await toast.waitFor();await toast.getByRole('button',{name:'Open conversation with Sarah Kim'}).click();await page.waitForURL('**page=chat#dm-dm1');await page.locator('.wu-chat-thread').waitFor();emit('direct-2','dm1');await page.waitForTimeout(350);assert.equal(await toast.count(),0,'Active conversation stays quiet');
  emit('team-while-direct');await toast.waitFor();await page.mouse.move(0,0);await toast.waitFor({state:'hidden',timeout:7500});
  for(const width of [1440,390]){profile.theme='dark';await page.setViewportSize({width,height:850});await page.goto(root+'home');await page.locator('.wu-page').waitFor();await page.waitForTimeout(400);emit('dark-'+width);await toast.waitFor();await toast.hover();const box=await toast.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,'Toast fits viewport');assert.ok(box.y>=50,'Toast is below app header');await page.screenshot({path:`/tmp/devup-migration-artifacts/message-toast-dark-${width}.png`});await toast.getByRole('button',{name:'Dismiss message notification'}).click();}
  await page.emulateMedia({reducedMotion:'reduce'});emit('reduced-motion');await toast.waitFor();assert.equal(await toast.locator('.wu-message-toast-progress').evaluate(e=>getComputedStyle(e).animationName),'none');await toast.getByRole('button',{name:'Dismiss message notification'}).click();
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Message toasts passed: real Socket.IO fixture events, outside-Chat subscription, own/active suppression, duplicate handling, burst grouping, hover/focus pause, automatic/manual dismissal, DM navigation, themes, mobile and reduced motion.');process.exit(0);
 }
 if(process.env.CHAT_ONLY==='1'){
  for(const theme of ['light','dark'])for(const width of [1440,1100,390]){
   profile.theme=theme;await page.setViewportSize({width,height:850});await page.goto(root+'chat');await page.locator('.wu-message').first().waitFor();
   assert.ok(await page.locator('.wu-message.is-grouped').count()>0,'Consecutive messages are grouped');
   assert.equal(await page.locator('.wu-message').count(),18);
   assert.match(await page.locator('.wu-message.is-own .wu-message-bubble').first().evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/,'Outgoing bubbles retain the subtle theme gradient');
   assert.match(await page.locator('.wu-conversation-panel').evaluate(e=>getComputedStyle(e).backgroundImage),/radial-gradient/,'Conversation list retains its top glow');
   const dimensions=await page.evaluate(()=>({body:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,bottom:document.querySelector('.wu-chat-composer').getBoundingClientRect().bottom}));
   assert.ok(dimensions.body<=dimensions.width,'No page horizontal overflow');assert.ok(dimensions.bottom<=dimensions.height,'Composer stays in viewport');
   await page.screenshot({path:`/tmp/devup-migration-artifacts/chat-${theme}-${width}.png`});
   await page.getByRole('button',{name:'Search loaded messages',exact:true}).click();await page.getByRole('searchbox',{name:'Search this conversation'}).fill('Latest update');await page.locator('#chat-message-search').getByRole('button',{name:'Search',exact:true}).click();await page.locator('#chat-message-search article').waitFor();assert.equal(await page.locator('#chat-message-search article').count(),1);await page.getByRole('button',{name:'Search loaded messages',exact:true}).click();
   if(width===1440){await page.getByRole('button',{name:'Show details',exact:true}).click();await page.locator('#chat-details').waitFor({state:'visible'});await page.getByRole('button',{name:'Links',exact:true}).click();assert.equal(await page.locator('.wu-chat-link-row').count(),1);await page.screenshot({path:`/tmp/devup-migration-artifacts/chat-details-${theme}.png`});await page.getByRole('button',{name:'Hide details',exact:true}).click();}
   else if(width===1100){await page.getByRole('button',{name:'Show conversation details',exact:true}).click();await page.locator('.wu-chat-details-body .wu-chat-identity').waitFor();await page.keyboard.press('Escape');}
   else {await page.getByRole('button',{name:'Show conversations',exact:true}).click();await page.getByRole('searchbox',{name:'Search conversations'}).fill('Sarah');assert.equal(await page.locator('.wu-chat-conversations .wu-conversation').count(),1);await page.getByRole('searchbox',{name:'Search conversations'}).fill('');await page.locator('.wu-chat-conversations .wu-conversation').first().click();}
  }
  await page.setViewportSize({width:1440,height:850});await page.goto(root+'chat');await page.locator('.wu-message').first().waitFor();
  const input=page.getByRole('textbox',{name:'Message',exact:true});await input.fill('Draft persists');assert.match(await page.getByRole('button',{name:'Send message',exact:true}).evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/,'Enabled Send button uses the signature finish');await page.locator('.wu-chat-conversations .wu-conversation').nth(1).click();await input.fill('Direct draft');await page.locator('.wu-chat-conversations .wu-conversation').first().click();assert.equal(await input.inputValue(),'Draft persists');
  await page.locator('.wu-message').last().hover();await page.locator('.wu-chat-reply').last().click();await input.fill('Reply fixture');await input.press('Enter');await page.getByText('Reply fixture',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('textarea[aria-label=Message]')?.value==='');assert.equal(await input.inputValue(),'');assert.equal(writes.filter(w=>w.path.endsWith('/messages')&&w.method==='POST').length,1);
  for(const theme of ['light','dark']){profile.theme=theme;await page.goto(root+'chat');await page.locator('.wu-chat-conversations .wu-conversation').nth(1).click();await page.locator('.wu-chat-empty-conversation').waitFor();await page.screenshot({path:`/tmp/devup-migration-artifacts/chat-empty-${theme}.png`});}
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Chat passed: six theme/viewport views, grouping, overflow, anchored composer, header search, desktop and drawer details, safe link rows, mobile list search, per-thread drafts, reply send DTO and two empty states.');process.exit(0);
 }
 if(process.env.TARGET_ONLY==='1'){
  notes.push(...Array.from({length:104},(_,i)=>({id:'note-batch-'+i,title:i===103?'Beyond first hundred notes':`Notes ${String(i).padStart(3,'0')}`,content:'Target-compatible note content',creatorId:uid,updatedAt:stamp,pinnedAt:null})));
  await page.goto(root+'notes');await page.locator('.wu-note-gradient-card').first().waitFor();assert.equal(await page.locator('.wu-note-gradient-card').count(),20);
  await page.getByRole('searchbox',{name:'Search notes'}).fill('Beyond first hundred');await page.getByRole('button',{name:'Beyond first hundred notes',exact:true}).waitFor();assert.equal(await page.locator('.wu-note-gradient-card').count(),1);
  await page.goto(root+'settings#profile');await page.getByRole('button',{name:'Change avatar',exact:true}).click();await page.getByRole('button',{name:'Use your own image'}).click();
  await page.locator('input[type=file]').setInputFiles('public/illustrations/empty-states/geometric/light/tasks.webp');
  await page.getByRole('button',{name:'Save avatar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.wu-avatar-large')?.getAttribute('src')?.startsWith('data:image/jpeg;base64,'));assert.ok(profile.avatarUrl.startsWith('data:image/jpeg;base64,'));
  await page.goto(root+'settings#appearance');await page.getByRole('button',{name:'Use dark theme',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.workspace-app')?.getAttribute('data-theme')==='dark');assert.equal(profile.theme,'dark');
  await page.goto(root+'settings#security');await page.getByRole('button',{name:'Enable 2FA',exact:true}).click();await page.locator('.otp-box').first().fill('123456');await page.getByRole('button',{name:'Disable 2FA',exact:true}).waitFor();assert.equal(profile.isTwoFactorEnabled,true);
  await page.getByRole('button',{name:'Disable 2FA',exact:true}).click();await page.getByRole('button',{name:'Enable 2FA',exact:true}).waitFor();assert.equal(profile.isTwoFactorEnabled,false);
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Target features passed: strict Notes pagination, search beyond 100 notes, JPEG avatar compression/upload, persistent theme API, and enable/disable 2FA DTOs.');process.exit(0);
 }
 if(process.env.FILES_ONLY==='1'){
  files.push(...Array.from({length:103},(_,i)=>({id:'batch-'+i,displayName:i===102?'Beyond first hundred.pdf':`Batch ${String(i).padStart(3,'0')}.txt`,mimeType:i===102?'application/pdf':'text/plain',sizeBytes:String(i===102?999999:200+i),uploaderId:uid,createdAt:stamp,taskId:null})));
  await page.goto(root+'files');await page.locator('.wu-files-table tbody tr').first().waitFor();
  assert.equal(await page.locator('.wu-files-table tbody tr').count(),20);
  await page.getByRole('button',{name:'Next',exact:true}).click();assert.equal(await page.locator('.wu-files-table tbody tr').count(),20);
  await page.getByRole('searchbox',{name:'Search files'}).fill('Beyond first hundred');
  await page.locator('.wu-list-item-name').filter({hasText:'Beyond first hundred.pdf'}).waitFor();assert.equal(await page.locator('.wu-files-table tbody tr').count(),1);
  await page.getByRole('searchbox',{name:'Search files'}).fill('');
  await page.getByRole('button',{name:'Documents',exact:true}).click();assert.equal(await page.locator('.wu-files-table tbody tr').count(),2);
  assert.equal(await page.locator('.wu-recent-file').count(),4,'Recent files remain independent of filters');
  await page.getByRole('button',{name:'All files',exact:true}).click();await page.getByLabel('Sort by').selectOption('size');
  assert.match(await page.locator('.wu-files-table tbody tr').first().innerText(),/Beyond first hundred/);
  await page.getByLabel('Uploaded by').selectOption('u2');assert.equal(await page.locator('.wu-files-table tbody tr').count(),1);
  await page.getByRole('button',{name:'Grid view',exact:true}).click();assert.equal(await page.locator('.wu-file-card').count(),1);
  await page.screenshot({path:'/tmp/devup-migration-artifacts/files-query-contract.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Files passed: strict page/limit API, 105 files across backend pages, local pagination, search beyond first 100, category/uploader filters, sorting, grid and independent recent files.');process.exit(0);
 }
 if(process.env.DARK_ONLY==='1'){
  profile.theme='dark';
  function ratio(a,b){const lum=c=>{const values=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  const sections=['General','Access','Board settings','Integrations','Archive','Profile','Security','Appearance','Notifications'];
  if(!process.env.DARK_SKIP_VIEWS)for(const width of [1440,390]){
   await page.setViewportSize({width,height:950});
   for(const name of ['home','projects','board','backlog','notes','files','team','github','analytics','activity','chat','settings']){
    await page.goto(root+name);await page.locator('.wu-page').waitFor();await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' dark overflow');
    const colors=await page.locator('.workspace-app').evaluate(e=>{const c=getComputedStyle(e),out={};for(const key of ['--wu-canvas','--wu-surface','--wu-ink','--wu-muted','--wu-subtle'])out[key]=c.getPropertyValue(key).trim();const toRgb=value=>{const x=document.createElement('span');x.style.color=value;e.append(x);const rgb=getComputedStyle(x).color;x.remove();return rgb;};return Object.fromEntries(Object.entries(out).map(([k,v])=>[k,toRgb(v)]));});
    assert.ok(ratio(colors['--wu-ink'],colors['--wu-surface'])>=7,'Primary contrast');assert.ok(ratio(colors['--wu-muted'],colors['--wu-surface'])>=4.5,'Metadata contrast');assert.ok(ratio(colors['--wu-subtle'],colors['--wu-surface'])>=4.5,'Subtle contrast');
    await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-refinement-'+name+'-'+width+'.png'});
   }
   for(const name of sections){if(width<=900){await page.getByRole('button',{name:/^Settings section:/}).click();await page.getByRole('dialog',{name:'Settings sections',exact:true}).getByRole('button',{name,exact:true}).click();}else await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name,exact:true}).click();await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-settings-'+name.replaceAll(' ','-')+'-'+width+'.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  }
  await page.setViewportSize({width:1440,height:950});
  const hoverColors=[];
  for(const [name,selector] of [['files','.wu-files-table tbody tr'],['team','.wu-team-table tbody tr'],['backlog','.wu-list-table tbody tr']]){await page.goto(root+name);if(name==='files')await page.getByRole('button',{name:'List view',exact:true}).click();const row=page.locator(selector).first();await row.waitFor();await row.hover();await page.waitForTimeout(160);hoverColors.push(await row.evaluate(e=>getComputedStyle(e).backgroundColor));}
  assert.equal(new Set(hoverColors).size,1,'Dark row hovers remain unified');
  await page.goto(root+'files');const primary=page.getByRole('button',{name:'Upload file',exact:true});await primary.waitFor();const fg=await primary.evaluate(e=>getComputedStyle(e).color);assert.ok(ratio(fg,'rgb(112,79,173)')>=4.5,'Primary button text contrast');
  await page.getByRole('button',{name:'Search tasks and pages',exact:true}).click();await page.locator('.wu-command-dialog[open]').waitFor();const raised=await page.locator('.wu-command-dialog').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(raised,'rgb(40, 42, 48)');assert.equal(await page.locator('.wu-command-input input').evaluate(e=>getComputedStyle(e).outlineStyle),'none');await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-search-overlay.png'});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Account menu for Alex Morgan',exact:true}).click();assert.equal(await page.locator('.wu-profile-menu').evaluate(e=>getComputedStyle(e).backgroundColor),raised);await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-account-menu.png'});await page.keyboard.press('Escape');
  await page.goto(root+'notes');await page.getByRole('button',{name:'New note',exact:true}).click();await page.getByRole('textbox',{name:'Note content',exact:true}).waitFor();assert.equal(await page.locator('.wu-native-drawer').evaluate(e=>getComputedStyle(e).backgroundColor),raised);await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-note-editor.png'});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.goto(root+'files');await page.locator('.wu-file-type').first().waitFor();
  const accents=await page.evaluate(()=>{
   const host=document.querySelector('.workspace-app'), sample=document.querySelector('.wu-file-type');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
   const rgb=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const d=ctx.getImageData(0,0,1,1).data;return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;};
   const result=[];
   for(const kind of ['pdf','design','archive','spreadsheet','presentation','image','video','audio','code','document','other']){const el=sample.cloneNode(true);el.dataset.kind=kind;host.append(el);const c=getComputedStyle(el);result.push({kind,fg:rgb(c.color),bg:rgb(c.backgroundColor)});el.remove();}
   for(const tone of ['blue','violet','pink','mint','orange','red','neutral']){const el=document.createElement('span');el.className='wu-pill wu-pill--'+tone;el.textContent=tone;host.append(el);const c=getComputedStyle(el);result.push({tone,fg:rgb(c.color),bg:rgb(c.backgroundColor)});el.remove();}
   return result;
  });
  assert.equal(new Set(accents.filter(a=>a.kind).map(a=>a.fg)).size,11,'File formats retain distinct colors');
  for(const accent of accents)assert.ok(ratio(accent.fg,accent.bg)>=4.5,'Dark accent contrast: '+(accent.kind??accent.tone));
  await page.goto(root+'home');const stage=page.locator('.devup-distribution [data-chart-label]').first();await stage.hover();await page.getByRole('tooltip').waitFor();assert.match(await page.getByRole('tooltip').innerText(),/task/);assert.equal(await page.getByRole('tooltip').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(40, 42, 48)');await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);await stage.focus();await page.getByRole('tooltip').waitFor();await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-stage-tooltip.png'});
  assert.equal(await page.locator('.wu-home-progress-bar').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(58, 62, 71)');
  await page.setViewportSize({width:390,height:950});await page.goto(root+'github');await page.locator('.wu-github-activity__point').first().focus();await page.getByRole('tooltip').waitFor();const tip=await page.getByRole('tooltip').boundingBox();assert.ok(tip.x>=0&&tip.x+tip.width<=390,'Mobile chart tooltip stays inside viewport');await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-github-tooltip-mobile.png'});
  await page.setViewportSize({width:1440,height:950});await page.goto(root+'analytics');const dayBar=page.locator('.wu-analytics-bar').first();await dayBar.focus();await page.getByRole('tooltip').waitFor();await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-analytics-tooltip.png'});await dayBar.press('Enter');await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');
  await page.goto(root+'settings#profile');const disabledSave=page.getByRole('button',{name:'Save username',exact:true});await disabledSave.waitFor();assert.equal(await disabledSave.isDisabled(),true);assert.equal(await disabledSave.evaluate(e=>getComputedStyle(e).opacity),'1');assert.equal(await disabledSave.evaluate(e=>getComputedStyle(e).cursor),'not-allowed');await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-disabled-profile-control.png'});
  await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Notifications',exact:true}).click();const badge=page.getByRole('checkbox',{name:'Show unread notification badge',exact:true});await badge.focus();const wasChecked=await badge.isChecked();await badge.press('Space');await page.waitForFunction(expected=>document.querySelector('input[aria-label="Show unread notification badge"]')?.checked===expected,!wasChecked);await badge.focus();assert.equal(await badge.isChecked(),!wasChecked);assert.equal(await page.locator('.wu-switch-slider').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');await page.screenshot({path:'/tmp/devup-migration-artifacts/dark-keyboard-switch.png'});
  await page.goto(root+'files');await page.getByRole('button',{name:'List view',exact:true}).click();const selectedRow=page.locator('.wu-files-table tbody tr').first();await selectedRow.waitFor();await selectedRow.evaluate(e=>e.setAttribute('aria-selected','true'));await selectedRow.hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('tr[aria-selected="true"]')).backgroundColor==='rgb(48, 43, 64)');assert.equal(await selectedRow.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(48, 43, 64)');await selectedRow.evaluate(e=>e.removeAttribute('aria-selected'));
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.workspace-app').evaluate(e=>{const sk=document.createElement('span');sk.className='wu-skeleton';e.append(sk);const animation=getComputedStyle(sk).animationName;sk.remove();return animation;}),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  profile.theme='light';await page.goto(root+'home');await page.locator('.wu-page-heading').waitFor();assert.equal(await page.locator('.workspace-app').evaluate(e=>getComputedStyle(e).getPropertyValue('--wu-canvas').trim()),'#f5f6f8');
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Dark mode passed: 24 page views, 18 Settings views, AA text/button contrast, unified row hovers, raised search/account/editor surfaces, single input focus, light-token preservation.');
 }else if(process.env.SETTINGS_ONLY==='1'){
  const sections=['General','Access','Board settings','Integrations','Archive','Profile','Security','Appearance','Notifications'];
  async function select(name,width=1440){
   if(width<=900){await page.getByRole('button',{name:/^Settings section:/}).click();await page.getByRole('dialog',{name:'Settings sections',exact:true}).getByRole('button',{name,exact:true}).click();}
   else await page.getByRole('navigation',{name:'Settings sections',exact:true}).getByRole('button',{name,exact:true}).click();
   assert.equal(await page.locator('.wu-settings-section-nav [aria-current=page]').innerText(),name);
  }
  if(!process.env.SETTINGS_SKIP_VIEWS)for(const [width,theme] of [[1440,'light'],[390,'light'],[1440,'dark']]){
   profile.theme=theme;await page.setViewportSize({width,height:950});await page.goto(root+'settings');await page.reload();await page.locator('.wu-settings-layout').waitFor();
   for(const name of sections){await select(name,width);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');await page.screenshot({path:'/tmp/devup-migration-artifacts/settings-'+name.replaceAll(' ','-')+'-'+width+'-'+theme+'.png'});}
  }
  for(const [width,theme] of [[1440,'light'],[390,'light'],[390,'dark']]){
   profile.theme=theme;await page.setViewportSize({width,height:568});await page.goto(root+'settings#profile');await page.reload();await page.locator('.wu-settings-panel').waitFor();
   const panel=page.locator('.wu-settings-panel');const heading=page.locator('.wu-page-heading');const headerY=(await heading.boundingBox()).y;
   assert.ok(await panel.evaluate(e=>e.scrollHeight>e.clientHeight),'Short screen has scrollable settings content');
   await panel.evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await panel.evaluate(e=>e.scrollTop>0));assert.equal((await heading.boundingBox()).y,headerY,'Settings heading stays fixed');
   assert.equal(await page.locator('.wu-page--settings').evaluate(e=>e.scrollTop),0,'Outer page does not scroll');assert.equal(await page.evaluate(()=>document.documentElement.scrollTop),0);
   await select('Appearance',width);assert.equal(await panel.evaluate(e=>e.scrollTop),0,'Switching sections resets internal scroll');
   await page.screenshot({path:`/tmp/devup-migration-artifacts/settings-fixed-${theme}-${width}.png`});
   if(width===390){
    const trigger=page.getByRole('button',{name:/^Settings section:/});await trigger.click();const drawer=page.getByRole('dialog',{name:'Settings sections',exact:true});await drawer.waitFor();await drawer.evaluate(e=>Promise.all(e.getAnimations().map(animation=>animation.finished)));const drawerBox=await drawer.boundingBox();assert.ok(drawerBox.x>=0&&drawerBox.x+drawerBox.width<=350,'Navigation drawer is fully visible and leaves a backdrop');
    await page.screenshot({path:`/tmp/devup-migration-artifacts/settings-navigation-drawer-${theme}.png`});
    for(let i=0;i<13;i++){await page.keyboard.press('Tab');assert.equal(await drawer.evaluate(e=>e.contains(document.activeElement)),true,'Keyboard focus stays in navigation drawer');}
    await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(e=>e===document.activeElement),true,'Escape returns focus to trigger');
    await trigger.click();await page.mouse.click(385,300);await drawer.waitFor({state:'hidden'});
    await trigger.click();await drawer.getByRole('button',{name:'Close settings navigation',exact:true}).click();await drawer.waitFor({state:'hidden'});
    await trigger.click();await page.setViewportSize({width:1440,height:568});await drawer.waitFor({state:'hidden'});
   }
  }
  profile.theme='light';await page.setViewportSize({width:1440,height:950});await page.goto(root+'settings#profile');await page.getByRole('textbox',{name:'Username',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Username',exact:true}).fill('Alex Updated');await page.getByRole('button',{name:'Save username',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.wu-settings-section-nav [aria-current=page]')?.textContent==='Profile');assert.equal(profile.username,'Alex Updated');
  await select('Appearance');await page.getByRole('button',{name:'Use dark theme',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.workspace-app')?.dataset.theme==='dark');assert.equal(await page.locator('.wu-settings-section-nav [aria-current=page]').innerText(),'Appearance');
  await page.reload();await page.getByRole('button',{name:'Use dark theme',exact:true}).waitFor();assert.equal(await page.locator('.wu-settings-section-nav [aria-current=page]').innerText(),'Appearance');
  await select('Notifications');await page.locator('.wu-settings-panel .wu-switch').first().click();await page.waitForTimeout(120);assert.equal(profile.notificationBadge,false);assert.equal(await page.locator('.wu-settings-section-nav [aria-current=page]').innerText(),'Notifications');await page.getByRole('checkbox',{name:'Show unread notification badge',exact:true}).focus();await page.keyboard.press('Space');await page.waitForTimeout(120);assert.equal(profile.notificationBadge,true,'Notification switch works from the keyboard');
  await select('Board settings');await page.getByRole('spinbutton',{name:/Active work limit/}).fill('7');await page.getByRole('heading',{name:'Board settings',exact:true}).click();await page.waitForTimeout(120);assert.equal(kanban.activeWipLimit,7);assert.equal(await page.locator('.wu-settings-section-nav [aria-current=page]').innerText(),'Board settings');
  await select('General');await page.getByRole('textbox',{name:'Name',exact:true}).fill('Updated workspace');await page.getByRole('heading',{name:'Workspace profile',exact:true}).click();await page.waitForTimeout(120);assert.equal(workspace.name,'Updated workspace');assert.equal(await page.locator('.wu-settings-section-nav [aria-current=page]').innerText(),'General');
  await select('Archive');await page.getByRole('button',{name:'Archive workspace',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(writes.some(w=>w.path.endsWith('/archive')),false);
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);console.log('Settings passed: 27 section/theme/mobile views, short-screen internal scroll and section reset, fixed heading, mobile navigation drawer, focus trap/restoration, Escape/backdrop/close dismissal, resize recovery, profile/theme/notification/workspace/board saves stay in section, direct links/reload, archive cancellation.');
 }else{
 for(const [width,theme] of [[1440,'light'],[390,'light'],[1440,'dark']]){
  profile.theme=theme;await page.setViewportSize({width,height:950});
  for(const name of ['home','projects','board','backlog','notes','files','team','github','analytics','activity','chat','settings']){
   await page.goto(root+name);await page.locator('.wu-page').waitFor();
   await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow '+width);
   await page.screenshot({path:'/tmp/devup-migration-artifacts/'+name+'-'+width+'-'+theme+'.png'});
  }
 }
 profile.theme='light';await page.setViewportSize({width:1440,height:950});
 await page.goto(root+'notes');await page.getByRole('button',{name:'Pin note: Planning notes',exact:true}).click();
 await page.waitForTimeout(100);assert.ok(notes[0].pinnedAt);
 await page.getByRole('button',{name:'New note',exact:true}).click();
 await page.getByRole('textbox',{name:'Title',exact:true}).fill('Rich migration note');
 await page.getByRole('textbox',{name:'Note content',exact:true}).fill('Content supported by the existing notes API.');
 await page.getByRole('button',{name:'Create note',exact:true}).click();
 await page.waitForTimeout(200);assert.equal(notes.length,2);
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByRole('textbox',{name:'Note content',exact:true}).fill('Revision-safe editor update.');
 await page.getByRole('button',{name:'Done editing',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).waitFor();
 await page.goto(root+'board');await page.getByRole('button',{name:'Move to a position for Polish mobile layout',exact:true}).click();
 await page.getByRole('combobox',{name:'Destination column',exact:true}).selectOption('READY');
 await page.getByRole('button',{name:'Move task',exact:true}).click();
 await page.waitForTimeout(100);
 const transition=writes.find(w=>w.path==='tasks/t1/transition');assert.equal(transition.body.toStatus,'READY');assert.ok(!('boardColumnId' in transition.body));
 await page.goto(root+'files');await page.getByRole('button',{name:'Documents',exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.locator('.wu-files-table tbody tr').count(),1);assert.equal(await page.locator('.wu-recent-file').count(),2);
 await page.getByRole('button',{name:'Grid view',exact:true}).click();await page.locator('.wu-file-card').first().waitFor();
 await page.getByRole('button',{name:'All files',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'Upload check.txt',mimeType:'text/plain',buffer:Buffer.from('Upload regression')});
 await page.waitForFunction(()=>document.body.textContent.includes('Upload check.txt'));
 assert.equal(files.length,3);
 await page.goto(root+'github');await page.getByRole('button',{name:'Sync',exact:true}).click();await page.getByRole('status').filter({hasText:'Repository synced.'}).waitFor();
 assert.equal(await page.getByRole('navigation',{name:'GitHub navigation'}).getByRole('button',{name:'Collaborators',exact:true}).count(),1);
 await page.getByRole('button',{name:'Repository actions',exact:true}).click();page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Disconnect repository',exact:true}).click();
 await page.getByRole('navigation',{name:'GitHub navigation'}).getByRole('button',{name:'Branches',exact:true}).click();await page.locator('.wu-gbranches__table').waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);
 console.log(JSON.stringify({views:36,errors,unknown,writes:writes.map(w=>({path:w.path,method:w.method})),checks:'current Notes DTO, Backlog/TODO workflow and transition payload, authenticated multipart upload, Files tabs/grid/recent files, GitHub stats/contributors/collaborators/sync/branches and disconnect cancellation'},null,2));
}
}catch(error){console.error('Failed view:',page.url(), 'Browser errors:',errors);throw error;}finally{await browser.close();}
