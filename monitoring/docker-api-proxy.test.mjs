import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {allowed,createProxy} from './docker-api-proxy.mjs';

test('deny by default, allow only specific read paths',()=>{
 const id='a'.repeat(64);
 for(const [method,path] of [['POST','/v1.45/containers/create'],['DELETE',`/v1.45/containers/${id}`],['POST',`/v1.45/containers/${id}/exec`],['GET',`/v1.45/containers/${id}/archive?path=/`],['GET',`/containers/${id}/logs`],['GET','/events'],['GET','/images/json'],['GET','/v1.45/../info'],['GET','//info'],['GET','/%69nfo'],['GET','http://other/info'],['GET','/info?x=1'],['GET','/containers/json?size=true'],['HEAD','/info']])assert.equal(allowed(method,path),false,path);
 for(const path of ['/info','/version','/_ping',`/v1.45/containers/${id}/json`,'/containers/json?all=1&filters='+encodeURIComponent(JSON.stringify({label:['com.docker.compose.project=transcendence-prod']}))])assert.equal(allowed('GET',path),true,path);
});

test('blocked requests never reach mock daemon; inspect strips secrets',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'docker-proxy-test-'));const socket=join(dir,'daemon.sock');let calls=0;
 const daemon=http.createServer((req,res)=>{calls++;assert.equal(req.headers.authorization,undefined);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({Id:'a'.repeat(64),Name:'/fixture',Created:'2026-01-01T00:00:00Z',RestartCount:2,State:{Running:true,Pid:1,Health:{Log:[{Output:'secret-marker'}]}},Config:{Env:['TOKEN=secret-marker'],Cmd:['secret-marker'],Image:'fixture',Labels:{secret:'secret-marker','com.docker.compose.project':'transcendence-prod'}},HostConfig:{NetworkMode:'bridge',Binds:['secret-marker']},Mounts:['secret-marker']}));});
 await new Promise(r=>daemon.listen(socket,r));const proxy=createProxy(socket);await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${proxy.address().port}`;
 try{
  for(const method of ['POST','PUT','PATCH','DELETE']){assert.equal((await fetch(base+'/v1.45/containers/create',{method,body:'{}'})).status,403);}
  assert.equal((await fetch(base+'/v1.45/containers/'+ 'a'.repeat(64)+'/archive?path=/')).status,403);assert.equal(calls,0);
  const r=await fetch(base+'/v1.45/containers/'+ 'a'.repeat(64)+'/json',{headers:{Authorization:'secret-marker'}});const text=await r.text();assert.equal(r.status,200);assert.ok(!text.includes('secret-marker'));assert.equal(JSON.parse(text).RestartCount,2);assert.equal(calls,1);
  await new Promise(r=>daemon.close(r));assert.equal((await fetch(base+'/info')).status,502);
 }finally{await new Promise(r=>proxy.close(r));if(daemon.listening)await new Promise(r=>daemon.close(r));rmSync(dir,{recursive:true});}
});
