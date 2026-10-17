import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {today} from '../server/budget.mjs';
test('서버 로그인·계정 격리·저장·중복 방지·충돌·취소·내보내기',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'finlog-test-')),port=19100+Math.floor(Math.random()*800),origin=`http://localhost:${port}`;
 const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),APP_ORIGIN:origin,DATA_DIR:dir,NODE_ENV:'test',EMAIL_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Server start timeout')),10000).unref())]);
  const call=async(path,method='GET',data,cookie='',customOrigin=origin)=>{const r=await fetch(origin+'/api'+path,{method,headers:{'Content-Type':'application/json',Origin:customOrigin,Cookie:cookie},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  assert.equal((await call('/dashboard')).status,401);
  async function login(email){const r=await call('/auth/link','POST',{email});assert.equal(r.status,200);const token=new URL(r.body.devLink).searchParams.get('token');const v=await call('/auth/verify','POST',{token});assert.equal(v.status,200);assert.equal((await call('/auth/verify','POST',{token})).status,400);return v.cookie;}
  const alice=await login('alice@example.com'),bob=await login('bob@example.com');
  const setup={complete:true,salary:3000000,payday:1,available:3000000,allocation:400000,buffer:100000,fixed:[{name:'통신비',amount:100000,day:25}],goal:{name:'여행',target:3000000,opening:600000,monthly:400000,mode:'amount',deadline:'2030-01-01'}};
  let result=await call('/onboarding','PUT',setup,alice);assert.equal(result.status,200);assert.equal((await call('/dashboard','GET',undefined,bob)).status,404);
  await call('/onboarding','PUT',setup,bob);
  const tx={kind:'expense',amount:12000,date:today(),category:'식비',version:1,requestId:'repeat-1'};
  result=await call('/transactions','POST',tx,alice);assert.equal(result.status,200);assert.equal(result.body.state.version,2);const transaction=result.body.state.transactions[0];
  const repeat=await call('/transactions','POST',tx,alice);assert.equal(repeat.status,200);assert.equal(repeat.body.state.transactions.length,1);
  assert.equal((await call('/transactions','POST',{...tx,requestId:'other'},alice)).status,409);
  assert.equal((await call('/transactions/'+transaction.id,'PATCH',{version:1,action:'cancel'},bob)).status,400);
  assert.equal((await call('/transactions','POST',{...tx,version:2,requestId:'cross-site'},alice,'https://other.example')).status,403);
  const cancel=await call('/transactions/'+transaction.id,'PATCH',{version:2,action:'cancel',requestId:'cancel-1'},alice);assert.equal(cancel.status,200);assert.equal(cancel.body.summary.spent,0);
  const exported=await call('/export','GET',undefined,alice);assert.equal(exported.body.formatVersion,1);assert.equal(exported.body.state.transactions.length,1);
  assert.equal((await call('/dashboard','GET',undefined,bob)).body.state.transactions.length,0);
  const preview=await call('/restore/preview','POST',{backup:exported.body},alice);assert.equal(preview.status,200);assert.equal(preview.body.duplicates,1);
  const restore=await call('/restore','POST',{backup:exported.body,version:3,confirm:true,requestId:'restore-1'},alice);assert.equal(restore.status,200);assert.equal(restore.body.state.version,4);
  const bad=structuredClone(exported.body);bad.state.transactions.push({...bad.state.transactions[0]});assert.equal((await call('/restore','POST',{backup:bad,version:4,confirm:true,requestId:'restore-bad'},alice)).status,400);assert.equal((await call('/dashboard','GET',undefined,alice)).body.state.version,4);
  const old=structuredClone(exported.body),d=new Date(today()+'T00:00:00Z');const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString().slice(0,10),start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).toISOString().slice(0,10);
  Object.assign(old.state.period,{id:start,start,end});old.state.transactions=[];old.state.history=[];
  assert.equal((await call('/restore','POST',{backup:old,version:4,confirm:true,requestId:'old-period'},alice)).status,200);
  const closed=await call('/period/close','POST',{version:5,confirm:true,requestId:'close-1'},alice);assert.equal(closed.status,200);assert.equal(closed.body.state.history.length,1);assert.equal(closed.body.state.period.income,6000000);assert.equal(closed.body.state.fixed.length,2);assert.equal(closed.body.summary.remaining,5300000);assert.equal(closed.body.summary.saved,600000);
  assert.equal((await call('/fixed','PUT',{version:6,fixed:[{name:'새 고정비',amount:70000,day:15}],requestId:'fixed-next'},alice)).status,200);const latest=await call('/dashboard','GET',undefined,alice);assert.equal(latest.body.state.fixed.length,2);assert.equal(latest.body.state.nextFixed[0].amount,70000);
  await call('/auth/logout','POST',{},alice);assert.equal((await call('/dashboard','GET',undefined,alice)).status,401);
 }finally{child.kill();await once(child,'exit');await rm(dir,{recursive:true,force:true});}
});
