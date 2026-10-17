export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dateAt(year, month, day) { return new Date(Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month+1, 0)).getUTCDate()))).toISOString().slice(0,10); }
export function periodFor(date, payday, next = false) {
  const d = new Date(date+'T00:00:00Z'); let y=d.getUTCFullYear(), m=d.getUTCMonth();
  if(date < dateAt(y,m,payday)) m--;
  if(next) m++;
  const start=dateAt(y,m,payday), end=dateAt(y,m+1,payday);
  return {id:start,start,end};
}
export function money(n, name='금액', allowZero=true) { if(!Number.isSafeInteger(n)||n<(allowZero?0:1)||n>1e12) throw new Error(`${name}은 ${allowZero?'0 이상의':'양의'} 정수 원으로 입력해 주세요.`); return n; }
export function validDate(value) { if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value) throw new Error('올바른 날짜를 입력해 주세요.'); return value; }
export const active = s => s.transactions.filter(t=>!t.cancelled);
export function summary(s, date=today()) {
  const ts=active(s), p=s.period, current=ts.filter(t=>t.periodId===p.id);
  const saved=ts.reduce((n,t)=>n+(t.kind==='saving'?t.amount:['withdraw','use'].includes(t.kind)?-t.amount:0),s.goal.opening);
  const saving=current.filter(t=>t.kind==='saving').reduce((n,t)=>n+t.amount,0);
  const spent=current.filter(t=>t.kind==='expense').reduce((n,t)=>n+t.amount,0);
  const incoming=current.filter(t=>['income','withdraw'].includes(t.kind)).reduce((n,t)=>n+t.amount,0);
  const fixed=s.fixed.reduce((n,f)=>n+(current.find(t=>t.kind==='fixed'&&t.fixedId===f.id)?.amount??f.amount),0);
  const remaining=p.income+incoming-fixed-p.allocation-p.buffer-spent;
  const days=Math.max(0,Math.ceil((Date.parse(p.end)-Date.parse(date))/86400000));
  return {saved,saving,spent,fixed,remaining,days,daily:days?Math.floor(Math.max(0,remaining)/days):0,progress:Math.min(100,Math.floor(saved/s.goal.target*100)),income:p.income+incoming};
}
export function forecast(s) {
  const x=summary(s), left=Math.max(0,s.goal.target-x.saved); if(!left)return {amount:0,date:today(),opportunities:0};
  const dates=[]; if(x.saving<s.period.allocation && s.period.end>today())dates.push(s.period.start);
  for(let i=1;i<=600;i++){const d=new Date(s.period.start+'T00:00:00Z'); dates.push(dateAt(d.getUTCFullYear(),d.getUTCMonth()+i,s.payday));}
  if(s.goal.mode==='date'){const n=dates.filter(d=>d<=s.goal.deadline).length;return {amount:n?Math.ceil(left/n):null,date:s.goal.deadline,opportunities:n};}
  const amount=s.goal.monthly || s.period.allocation; const n=amount?Math.ceil(left/amount):0;
  return {amount,date:n?dates[n-1]??null:null,opportunities:n};
}
export function createState(input) {
  money(input.salary,'월급',false); money(input.available,'배분 전 보유금'); money(input.allocation,'목표 배정액'); money(input.buffer,'여유 자금');
  if(!Number.isInteger(input.payday)||input.payday<1||input.payday>31)throw new Error('월급일은 1~31일입니다.');
  if(!input.goal?.name?.trim())throw new Error('목표 이름을 입력해 주세요.');
  money(input.goal.target,'목표 금액',false);money(input.goal.opening,'이미 모은 돈');money(input.goal.monthly,'월 저축액');
  if(input.goal.opening>input.goal.target)throw new Error('이미 모은 돈이 목표 금액보다 큽니다.');
  if(!['date','amount'].includes(input.goal.mode))throw new Error('목표 방식을 확인해 주세요.');
  validDate(input.goal.deadline);
  const period={...periodFor(today(),input.payday,input.next),income:input.next?input.salary:input.available,allocation:input.allocation,buffer:input.buffer,status:'confirmed'};
  const fixed=(input.fixed??[]).map(f=>{money(f.amount,'필수 지출');if(!f.name?.trim()||!Number.isInteger(f.day)||f.day<1||f.day>31)throw new Error('필수 지출 이름과 예정일을 확인해 주세요.'); return {...f,id:crypto.randomUUID()};});
  const s={version:1,salary:input.salary,payday:input.payday,goal:{...input.goal,achievedAt:input.goal.opening>=input.goal.target?today():null},period,fixed,transactions:[],history:[]};
  if(summary(s).remaining<0)throw new Error('배분 금액이 보유금을 초과합니다. 목표 저축이나 여유 자금을 조정해 주세요.');
  if(input.goal.mode==='amount'&&input.goal.opening<input.goal.target&&!input.goal.monthly)throw new Error('월 저축액은 0원보다 커야 합니다.');
  if(input.goal.mode==='date'&&forecast(s).amount===null)throw new Error('목표일까지 남은 저축 기회가 없습니다. 기한을 변경해 주세요.');
  return s;
}
export function preview(input) {
  const s=createState({...input,allocation:1,buffer:0,available:Math.max(input.available, input.fixed.reduce((n,f)=>n+f.amount,0)+1),salary:Math.max(input.salary,input.fixed.reduce((n,f)=>n+f.amount,0)+1),goal:{...input.goal,mode:'amount',monthly:Math.max(1,input.goal.monthly)}});
  s.goal={...input.goal};
  const estimate=forecast(s);
  const allocation=input.goal.mode==='date'?estimate.amount:input.goal.monthly;
  return {forecast:estimate,allocation,remaining:allocation===null?null:(input.next?input.salary:input.available)-input.fixed.reduce((n,f)=>n+f.amount,0)-allocation-input.buffer};
}
export function validateBackup(value) {
  if(value?.format!=='finlog'||value.formatVersion!==1)throw new Error('지원하는 Finlog 백업 형식이 아닙니다.');
  const s=structuredClone(value.state);
  if(!s||!Array.isArray(s.transactions)||!Array.isArray(s.fixed)||!Array.isArray(s.history)||s.transactions.length>10000)throw new Error('백업 자료 구조를 확인해 주세요.');
  const text=(str,max=300)=>typeof str==='string'&&str.length<=max;
  money(s.salary,'월급',false);if(!Number.isInteger(s.payday)||s.payday<1||s.payday>31)throw new Error('백업 월급일이 잘못되었습니다.');
  if(!s.goal||!text(s.goal.name,80)||!s.goal.name.trim()||!['date','amount'].includes(s.goal.mode))throw new Error('백업 목표가 잘못되었습니다.');
  money(s.goal.target,'목표 금액',false);money(s.goal.opening);money(s.goal.monthly);validDate(s.goal.deadline);
  if(s.goal.achievedAt!==null)validDate(s.goal.achievedAt);
  const periodIds=new Set();
  for(const p of [s.period,...s.history]){if(!p||p.id!==p.start||!['confirmed','closed'].includes(p.status))throw new Error('백업 기간을 확인해 주세요.');validDate(p.start);validDate(p.end);if(p.start>=p.end||periodIds.has(p.id))throw new Error('백업 기간이 중복되거나 잘못되었습니다.');periodIds.add(p.id);if(!Number.isSafeInteger(p.income)||Math.abs(p.income)>1e12)throw new Error('기간 수입이 잘못되었습니다.');money(p.allocation);money(p.buffer);}
  const fixedIds=new Set();for(const f of s.fixed){if(!text(f.id,100)||fixedIds.has(f.id)||!text(f.name,100)||!Number.isInteger(f.day)||f.day<1||f.day>31)throw new Error('백업 필수 지출을 확인해 주세요.');money(f.amount);fixedIds.add(f.id);}
  if(s.nextFixed!==undefined){if(!Array.isArray(s.nextFixed)||s.nextFixed.length>100)throw new Error('다음 반복 지출을 확인해 주세요.');for(const f of s.nextFixed){if(!text(f.name,80)||!f.name.trim()||!Number.isInteger(f.day)||f.day<1||f.day>31)throw new Error('다음 반복 지출이 잘못되었습니다.');money(f.amount);}}
  const ids=new Set(),requests=new Set(),paid=new Set();
  for(const t of s.transactions){if(!text(t.id,100)||!t.id||ids.has(t.id)||!text(t.requestId,100)||!t.requestId||requests.has(t.requestId)||!periodIds.has(t.periodId)||!['expense','saving','fixed','withdraw','use','income'].includes(t.kind)||!text(t.category,50)||!text(t.memo)||typeof t.cancelled!=='boolean')throw new Error('백업 거래가 중복되거나 잘못되었습니다.');money(t.amount,'거래 금액',false);validDate(t.date);const p=[s.period,...s.history].find(p=>p.id===t.periodId);if(t.date<p.start||t.date>=p.end)throw new Error('거래 날짜가 기간과 맞지 않습니다.');ids.add(t.id);requests.add(t.requestId);
    if(t.kind==='fixed'&&t.periodId===s.period.id){if(!fixedIds.has(t.fixedId))throw new Error('필수 지출 연결이 잘못되었습니다.');if(!t.cancelled){if(paid.has(t.fixedId))throw new Error('필수 지출이 중복 납부되었습니다.');paid.add(t.fixedId);}}
  }
  if(summary(s).saved<0||summary(s).saving>s.period.allocation)throw new Error('백업의 목표 잔액 또는 배정을 확인해 주세요.');
  s.version=1;return s;
}
export function transact(s, input) {
  if(s.period.start>today())throw new Error('다음 월급일부터 기록할 수 있습니다.');
  if(s.period.status==='closed')throw new Error('마감한 기간에는 기록할 수 없습니다.');
  if(!['expense','saving','fixed','withdraw','use','income'].includes(input.kind))throw new Error('기록 종류를 확인해 주세요.');
  money(input.amount,'금액',false);validDate(input.date);
  if(input.date<s.period.start||input.date>=s.period.end||input.date>today())throw new Error('현재 월급 기간의 오늘 이전 날짜를 선택해 주세요.');
  const x=summary(s);
  if(input.kind==='saving'&&input.amount>Math.max(0,s.goal.target-x.saved))throw new Error('남은 목표 금액까지만 저축할 수 있습니다.');
  if(['withdraw','use'].includes(input.kind)&&input.amount>x.saved)throw new Error('목표 자금보다 많이 인출할 수 없습니다.');
  if(input.kind==='saving'&&x.saving+input.amount>s.period.allocation){if(!input.confirmExtra)throw new Error('배정액 초과 저축을 확인해 주세요.');s.period.allocation=x.saving+input.amount;}
  if(input.kind==='fixed') {if(!s.fixed.some(f=>f.id===input.fixedId))throw new Error('예정 항목을 선택해 주세요.');if(active(s).some(t=>t.periodId===s.period.id&&t.kind==='fixed'&&t.fixedId===input.fixedId))throw new Error('이미 납부한 항목입니다.');}
  const t={id:crypto.randomUUID(),periodId:s.period.id,requestId:input.requestId,kind:input.kind,amount:input.amount,date:input.date,category:String(input.category||'기타').slice(0,50),memo:String(input.memo||'').slice(0,300),fixedId:input.fixedId,createdAt:new Date().toISOString(),cancelled:false};s.transactions.unshift(t);
  if(summary(s).saved>=s.goal.target&&!s.goal.achievedAt)s.goal.achievedAt=today();
  return s;
}
