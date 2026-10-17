import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {createState,summary,forecast,transact,today,periodFor,money,validDate,active,preview,validateBackup} from './budget.mjs';

const port=Number(process.env.PORT||3001), origin=process.env.APP_ORIGIN||`http://localhost:5173`, production=process.env.NODE_ENV==='production';
if(production&&(!origin.startsWith('https://')||!process.env.EMAIL_API_KEY))throw new Error('Production requires HTTPS APP_ORIGIN and EMAIL_API_KEY.');
mkdirSync(process.env.DATA_DIR||'data',{recursive:true});
const db=new DatabaseSync(resolve(process.env.DATA_DIR||'data','finlog.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,state TEXT,draft TEXT);
CREATE TABLE IF NOT EXISTS links(token TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(email TEXT PRIMARY KEY,last INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS requests(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,request_id TEXT NOT NULL,PRIMARY KEY(user_id,request_id));`);
const hash=t=>createHash('sha256').update(t).digest('hex');
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const cookie=token=>`finlog=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${production?'; Secure':''}`;
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw new Error('요청이 너무 큽니다.');}return raw?JSON.parse(raw):{};}
function view(s){return {state:s,summary:summary(s),forecast:forecast(s),asOf:new Date().toISOString()};}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
    if(!path.startsWith('/api/')){
      const root=resolve('dist'),file=resolve(root,'.'+decodeURIComponent(path));
      if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')&&file!==root)return send(res,404,{error:'찾을 수 없습니다.'});
      const target=existsSync(file)&&extname(file)?file:resolve(root,'index.html');
      if(!existsSync(target))return send(res,404,{error:'먼저 npm run build를 실행하거나 개발 서버(5173)에 접속해 주세요.'});
      res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(target)]||'application/octet-stream');res.end(readFileSync(target));return;
    }
    if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return send(res,403,{error:'허용되지 않은 요청 출처입니다.'});
    if(path==='/api/auth/link'&&req.method==='POST'){
      const {email}=await body(req);if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw new Error('이메일 주소를 확인해 주세요.');
      const normalized=email.trim().toLowerCase(),last=db.prepare('SELECT last FROM attempts WHERE email=?').get(normalized);
      if(last&&Date.now()-last.last<60000)return send(res,429,{error:'1분 후 다시 요청해 주세요.'});
      db.prepare('INSERT OR REPLACE INTO attempts VALUES (?,?)').run(normalized,Date.now());
      const token=randomBytes(32).toString('hex'),link=`${origin}/login?token=${token}`;
      db.prepare('INSERT INTO links VALUES (?,?,?)').run(hash(token),normalized,Date.now()+15*60000);
      if(process.env.EMAIL_API_KEY){const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.EMAIL_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:normalized,subject:'Finlog 로그인 링크',html:`<p>15분 안에 아래 링크를 눌러 로그인해 주세요.</p><a href="${link}">Finlog 로그인</a>`})});if(!response.ok)throw new Error('이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.');}
      return send(res,200,{sent:true,...(!production&&!process.env.EMAIL_API_KEY?{devLink:link}:{} )});
    }
    if(path==='/api/auth/verify'&&req.method==='POST'){
      const {token}=await body(req);if(typeof token!=='string')throw new Error('인증 링크가 올바르지 않습니다.');
      db.exec('BEGIN IMMEDIATE');try{
        const link=db.prepare('SELECT * FROM links WHERE token=? AND expires>?').get(hash(token),Date.now());if(!link)throw new Error('인증 링크가 만료되었거나 이미 사용되었습니다.');
        db.prepare('DELETE FROM links WHERE token=?').run(hash(token));db.prepare('INSERT OR IGNORE INTO users(id,email) VALUES (?,?)').run(randomUUID(),link.email);
        const user=db.prepare('SELECT id FROM users WHERE email=?').get(link.email),session=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(session),user.id,Date.now()+30*86400000);db.exec('COMMIT');res.setHeader('Set-Cookie',cookie(session));return send(res,200,{ok:true});
      }catch(e){db.exec('ROLLBACK');throw e;}
    }
    const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('finlog='))?.slice(7);
    const user=token?db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?').get(hash(token),Date.now()):null;
    if(!user)return send(res,401,{error:'로그인이 필요합니다.'});
    if(path==='/api/me')return send(res,200,{email:user.email,hasState:!!user.state,draft:user.draft?JSON.parse(user.draft):null});
    if(path==='/api/plans/preview'&&req.method==='POST')return send(res,200,preview(await body(req)));
    if(path==='/api/auth/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));res.setHeader('Set-Cookie','finlog=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return send(res,200,{ok:true});}
    if(path==='/api/account'&&req.method==='DELETE'){db.prepare('DELETE FROM links WHERE email=?').run(user.email);db.prepare('DELETE FROM attempts WHERE email=?').run(user.email);db.prepare('DELETE FROM users WHERE id=?').run(user.id);res.setHeader('Set-Cookie','finlog=; HttpOnly; Path=/; Max-Age=0');return send(res,200,{ok:true});}
    if(path==='/api/onboarding'&&req.method==='PUT'){const input=await body(req);if(user.state)throw new Error('이미 설정을 완료했습니다.');if(!input.complete){db.prepare('UPDATE users SET draft=? WHERE id=?').run(JSON.stringify(input),user.id);return send(res,200,{ok:true});}const s=createState(input);db.prepare('UPDATE users SET state=?,draft=NULL WHERE id=?').run(JSON.stringify(s),user.id);return send(res,200,view(s));}
    if(!user.state)return send(res,404,{error:'첫 설정을 완료해 주세요.'});
    const s=JSON.parse(user.state);
    if(path==='/api/restore/preview'&&req.method==='POST'){
      const restored=validateBackup((await body(req)).backup),existing=new Set(s.transactions.map(t=>t.id));
      return send(res,200,{transactions:restored.transactions.length,duplicates:restored.transactions.filter(t=>existing.has(t.id)).length,goal:restored.goal.name,summary:summary(restored)});
    }
    if(path==='/api/dashboard'&&req.method==='GET')return send(res,200,view(s));
    if(path==='/api/export'&&req.method==='GET')return send(res,200,{format:'finlog',formatVersion:1,exportedAt:new Date().toISOString(),state:s});
    if(req.method==='GET')return send(res,404,{error:'찾을 수 없습니다.'});
    const input=await body(req);
    db.exec('BEGIN IMMEDIATE');
    try{
      const latest=JSON.parse(db.prepare('SELECT state FROM users WHERE id=?').get(user.id).state);
      if(input.requestId&&db.prepare('SELECT 1 FROM requests WHERE user_id=? AND request_id=?').get(user.id,input.requestId)){db.exec('ROLLBACK');return send(res,200,view(latest));}
      if(input.version!==latest.version){db.exec('ROLLBACK');return send(res,409,{error:'다른 화면에서 자료가 변경되었습니다. 최신 내용을 불러온 후 다시 확인해 주세요.'});}
      let next=latest;
      if(path==='/api/transactions'&&req.method==='POST'){if(typeof input.requestId!=='string'||input.requestId.length>100)throw new Error('요청 식별자가 필요합니다.');next=transact(latest,input);}
      else if(path.startsWith('/api/transactions/')&&req.method==='PATCH'){
        const t=next.transactions.find(t=>t.id===path.split('/').at(-1));if(!t||t.cancelled)throw new Error('유효한 기록을 찾을 수 없습니다.');if(t.periodId!==next.period.id)throw new Error('마감한 기간의 수정은 지원하지 않습니다.');
        t.cancelled=true;
        if(input.action!=='cancel')next=transact(next,{...t,...input,kind:t.kind,requestId:input.requestId});
        if(summary(next).saved<0)throw new Error('이 저축을 사용하는 인출 기록을 먼저 취소해 주세요.');
      }
      else if(path==='/api/plan'&&req.method==='PUT'){
        money(input.allocation,'목표 배정액');money(input.buffer,'여유 자금');if(input.allocation<summary(next).saving)throw new Error('이미 저축한 금액보다 배정을 줄일 수 없습니다.');
        next.period.allocation=input.allocation;next.period.buffer=input.buffer;if(summary(next).remaining<0)throw new Error('생활비가 음수인 계획은 확정할 수 없습니다.');
      }
      else if(path==='/api/goal'&&req.method==='PATCH'){
        money(input.target,'목표 금액',false);money(input.monthly,'월 저축액');validDate(input.deadline);if(!input.name?.trim()||!['date','amount'].includes(input.mode))throw new Error('목표 이름과 방식을 확인해 주세요.');
        if(input.mode==='amount'&&input.monthly===0&&summary(next).saved<input.target)throw new Error('월 저축액은 0원보다 커야 합니다.');
        Object.assign(next.goal,{name:input.name.slice(0,80),target:input.target,mode:input.mode,deadline:input.deadline,monthly:input.monthly});if(forecast(next).amount===null)throw new Error('남은 저축 기회가 없습니다.');
        if(summary(next).saved>=next.goal.target&&!next.goal.achievedAt)next.goal.achievedAt=today();
      }
      else if(path==='/api/settings'&&req.method==='PUT'){money(input.salary,'월급',false);if(!Number.isInteger(input.payday)||input.payday<1||input.payday>31)throw new Error('월급일은 1~31일입니다.');next.salary=input.salary;next.payday=input.payday;}
      else if(path==='/api/fixed'&&req.method==='PUT'){
        if(!Array.isArray(input.fixed)||input.fixed.length>100)throw new Error('필수 지출 항목을 확인해 주세요.');
        next.nextFixed=input.fixed.map(f=>{money(f.amount,'필수 지출');if(typeof f.name!=='string'||!f.name.trim()||f.name.length>80||!Number.isInteger(f.day)||f.day<1||f.day>31)throw new Error('필수 지출 이름과 날짜를 확인해 주세요.');return {name:f.name,amount:f.amount,day:f.day};});
      }
      else if(path==='/api/restore'&&req.method==='POST'){
        const restored=validateBackup(input.backup);if(!input.confirm)throw new Error('복원 미리보기를 확인해 주세요.');
        restored.version=next.version;next=restored;
        db.prepare('DELETE FROM requests WHERE user_id=?').run(user.id);
        for(const t of next.transactions)db.prepare('INSERT INTO requests VALUES (?,?)').run(user.id,t.requestId);
      }
      else if(path==='/api/period/close'&&req.method==='POST'){
        if(today()<next.period.end)throw new Error('기간 종료 후 마감할 수 있습니다.');
        const x=summary(next),unpaid=next.fixed.filter(f=>!active(next).some(t=>t.periodId===next.period.id&&t.kind==='fixed'&&t.fixedId===f.id));
        if(!input.confirm)throw new Error('미납 항목과 저축 미달, 이월액을 확인해 주세요.');
        next.history.push({...structuredClone(next.period),summary:x,status:'closed',closedAt:today()});
        const p=periodFor(next.period.end,next.payday);if(p.start<next.period.end)throw new Error('변경한 월급일이 이전 기간과 겹칩니다. 월급일을 기존 날짜로 복원한 후 마감해 주세요.');
        const unsaved=Math.max(0,next.period.allocation-x.saving),reservedUnpaid=unpaid.reduce((n,f)=>n+f.amount,0),carry=x.remaining+unsaved+reservedUnpaid+next.period.buffer;
        next.period={...p,income:next.salary+carry,allocation:Math.min(next.period.allocation,Math.max(0,next.goal.target-x.saved)),buffer:next.period.buffer,status:'confirmed'};
        next.fixed=(next.nextFixed??next.fixed.filter(f=>!f.carry)).map(f=>({...f,id:randomUUID()})).concat(unpaid.map(f=>({...f,id:randomUUID(),name:f.carry?f.name:f.name+' (이전 미납)',carry:true})));
        delete next.nextFixed;
        if(summary(next).remaining<0)throw new Error('다음 계획의 생활비가 부족합니다. 현재 저축·여유 배정을 먼저 조정해 주세요.');
      }
      else {db.exec('ROLLBACK');return send(res,404,{error:'지원하지 않는 동작입니다.'});}
      next.version++;db.prepare('UPDATE users SET state=? WHERE id=?').run(JSON.stringify(next),user.id);if(input.requestId)db.prepare('INSERT INTO requests VALUES (?,?)').run(user.id,input.requestId);db.exec('COMMIT');return send(res,200,view(next));
    }catch(e){db.exec('ROLLBACK');throw e;}
  }catch(e){send(res,400,{error:e instanceof Error?e.message:'요청을 처리하지 못했습니다.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Finlog server: http://localhost:${port}`));
