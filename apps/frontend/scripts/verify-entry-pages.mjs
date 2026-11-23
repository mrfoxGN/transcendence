import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const uid='22222222-2222-4222-8222-222222222222';let theme='light';const writes=[];
const workspaces=Array.from({length:22},(_,i)=>({id:'workspace-'+i,ownerId:i%2?uid:'other',name:i===0?'Platform engineering with a longer workspace name':'Workspace '+(i+1),description:'Design, development and collaboration',archivedAt:i===21?'2026-11-01':null}));
await page.addInitScript(()=>sessionStorage.setItem('devup.access-token','entry-test-token'));
await page.route('**/api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname.slice(5);const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 if(req.method()!=='GET')writes.push({path,body:req.postDataJSON()});
 if(path==='auth/profile')return json({id:uid,username:'Alex Morgan',email:'alex@example.test',emailVerified:false,avatarUrl:null,theme,createdAt:'2026-11-01'});
 if(path==='workspaces')return json(workspaces);
 if(path.startsWith('notifications'))return json(path.includes('unread-count')?{count:0}:[]);
 if(path==='auth/login')return json({twoFactorRequired:true,twoFactorToken:'challenge-token'});
 if(path==='auth/login/2fa')return json({message:'Invalid verification code'},400);
 if(path==='auth/password-reset/request'||path==='auth/email-verification/request')return json({ok:true});
 if(path==='auth/email-verification/confirm')return json({message:'Invalid verification code'},400);
 return json([]);
});
await fs.mkdir('/tmp/devup-entry-artifacts',{recursive:true});
try {
 for(const width of [1440,390])for(const mode of ['light','dark']) {
  theme=mode;await page.setViewportSize({width,height:width===390?844:900});
  for(const route of ['/login','/register','/forgot-password','/verify-email','/onboarding','/onboarding/email','/join-workspace','/workspaces']) {
   await page.goto((process.env.DEVUP_APP_URL || 'http://localhost:5182')+route);await page.locator('.entry-experience[data-theme="'+mode+'"]').waitFor();await page.waitForTimeout(180);
   if(route==='/workspaces')assert.equal(await page.locator('.auth-page').evaluate(el=>getComputedStyle(el).backgroundColor),mode==='dark'?'rgb(17, 18, 20)':'rgb(248, 249, 252)');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1),route+' fits viewport');
   const heading=page.locator('h1');assert.ok(await heading.isVisible(),route+' has heading');
   await page.screenshot({path:`/tmp/devup-entry-artifacts/${route.slice(1).replaceAll('/','-')}-${mode}-${width}.png`,fullPage:true});
  }
 }
 await page.goto('http://localhost:5181/workspaces');await page.locator('.workspace-picker-list').first().waitFor();
 await page.getByRole('searchbox').fill('Workspace 5');assert.equal(await page.locator('.workspace-picker-card').count(),1);
 await page.getByRole('searchbox').fill('no match');assert.ok(await page.getByRole('status').filter({hasText:'No workspaces match'}).isVisible());
 await page.getByRole('searchbox').fill('');
 assert.ok(await page.locator('.workspace-picker-results').evaluate(el=>el.scrollHeight>el.clientHeight),'Long workspace list scrolls internally');
 await page.getByRole('button',{name:'Create workspace',exact:true}).click();await page.getByRole('dialog').waitFor();
 assert.ok(await page.getByRole('textbox',{name:'Workspace name'}).isVisible());await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.locator('.workspace-picker-card-menu summary').first().click();assert.ok(await page.getByRole('button',{name:'Leave workspace',exact:true}).first().isVisible());
 await page.locator('.workspace-picker-card-menu summary').first().click();
 await page.getByRole('radio',{name:'Light theme',exact:true}).check();await page.locator('.entry-experience[data-theme=light]').waitFor();
 await page.getByRole('radio',{name:'Dark theme',exact:true}).check();await page.locator('.entry-experience[data-theme=dark]').waitFor();
 await page.goto('http://localhost:5181/login');await page.locator('#auth-email').fill('alex@example.test');await page.locator('#auth-password').fill('correct-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Verify your sign-in'}).waitFor();
 await page.screenshot({path:'/tmp/devup-entry-artifacts/two-factor-dark-390.png',fullPage:true});
 await page.goto('http://localhost:5181/onboarding');await page.getByRole('button',{name:'Portrait 2',exact:true}).click();assert.equal(await page.getByAltText('Selected avatar').getAttribute('src'),'/team/chat.jpg');
 await page.getByRole('button',{name:'Use your own image'}).click();await page.getByRole('textbox',{name:'Image URL'}).fill('https://example.test/avatar.png');
 await page.screenshot({path:'/tmp/devup-entry-artifacts/avatar-custom-dark-390.png',fullPage:true});
 await page.goto('http://localhost:5181/forgot-password');await page.getByRole('textbox',{name:'Account email address'}).fill('alex@example.test');await page.getByRole('button',{name:'Send reset code'}).click();await page.getByRole('heading',{name:'Create new password'}).waitFor();
 await page.screenshot({path:'/tmp/devup-entry-artifacts/password-reset-dark-390.png',fullPage:true});
 await page.setViewportSize({width:390,height:568});
 for(const route of ['/register','/onboarding','/onboarding/email','/workspaces']){
  await page.goto((process.env.DEVUP_APP_URL || 'http://localhost:5182')+route);await page.locator('h1').waitFor();await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1),route+' fits short viewport');
  const scrollRegion=route==='/workspaces'?'.workspace-picker-results':'.auth-shell';
  await page.locator(scrollRegion).evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.screenshot({path:`/tmp/devup-entry-artifacts/short-${route.slice(1).replaceAll('/','-')}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Notifications',exact:true}).click();
 await page.locator('.wu-inbox:popover-open').waitFor();
 assert.equal(await page.locator('.wu-inbox').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(40, 42, 48)');
 await page.screenshot({path:'/tmp/devup-entry-artifacts/notifications-dark-short.png',fullPage:true});
 await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);assert.ok(writes.some(x=>x.path==='auth/login'&&x.body.email==='alex@example.test'));console.log('Passed: 32 light/dark desktop/mobile entry views, contained workspace search/list, create dialog, appearance switching, 2FA transition, avatar selection and recovery transition.');
} finally {await browser.close();}
