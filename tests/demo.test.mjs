import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyDemoSalary,changeDemo,demoSnapshot} from '../src/demo.ts';
import {createState,today} from '../src/lib/budget.mjs';
import {currentDemoPeriod,withinGoal} from '../src/goal-period.ts';

const initial=()=>createState({salary:3000000,payday:1,available:3000000,allocation:400000,buffer:100000,fixed:[{name:'통신비',amount:100000,day:25}],goal:{name:'여행',target:5000000,opening:600000,mode:'amount',monthly:400000,deadline:'2030-01-01'}});
test('데모 변경은 원본을 보존하고 중복 요청을 재반영하지 않는다',()=>{
  const s=initial(),input={kind:'expense',amount:12000,date:today(),category:'식비',memo:'점심',requestId:'once'};
  const next=changeDemo(s,'/transactions',input);assert.equal(s.transactions.length,0);assert.equal(next.summary.spent,12000);assert.equal(changeDemo(next.state,'/transactions',input).state.transactions.length,1);
});
test('데모 수정·취소가 목표와 생활비에 함께 반영된다',()=>{
  let v=changeDemo(initial(),'/transactions',{kind:'saving',amount:100000,date:today(),requestId:'save'});const id=v.state.transactions[0].id,remaining=v.summary.remaining;
  v=changeDemo(v.state,'/transactions/'+id,{amount:150000,date:today(),requestId:'edit'});assert.equal(v.summary.saved,750000);assert.equal(v.summary.remaining,remaining);
  v=changeDemo(v.state,'/transactions/'+v.state.transactions[0].id,{action:'cancel'});assert.equal(v.summary.saved,600000);assert.equal(v.summary.remaining,remaining);
});
test('유효하지 않은 데모 입력은 기존 스냅숏을 바꾸지 않는다',()=>{
  const s=initial(),before=JSON.stringify(s);
  assert.throws(()=>changeDemo(s,'/transactions',{kind:'withdraw',amount:700000,date:today()}));
  assert.throws(()=>changeDemo(s,'/plan',{allocation:4000000,buffer:100000}));
  assert.throws(()=>changeDemo(s,'/goal',{...s.goal,monthly:0}));
  assert.throws(()=>changeDemo(s,'/period/close',{}),/데모/);
  assert.equal(JSON.stringify(s),before);
});
test('목표 조건 변경 시 데모에서도 달성일을 다시 계산한다',()=>{
  const s=initial(),first=demoSnapshot(s),next=changeDemo(s,'/goal',{...s.goal,monthly:800000});assert.ok(next.forecast.date<first.forecast.date);assert.equal(next.state.period.allocation,s.period.allocation);
});
test('월급일 변경은 현재 기간과 수입을 즉시 갱신하고 날짜별 기록을 보존한다',()=>{
  const s=initial();
  s.period={...s.period,id:'2026-10-01',start:'2026-10-01',end:'2026-11-01'};
  s.transactions=[['before','2026-10-05',10000],['inside','2026-10-18',20000]].map(([id,date,amount])=>({id,requestId:id,periodId:s.period.id,kind:'expense',amount,date,category:'식비',memo:'',cancelled:false}));
  const before=JSON.stringify(s),next=applyDemoSalary(s,3200000,10,'2026-10-18');
  assert.equal(next.period.start,'2026-10-10');assert.equal(next.period.end,'2026-11-10');assert.equal(next.period.income,3200000);
  assert.equal(next.transactions[0].periodId,'2026-09-10');assert.equal(next.transactions[1].periodId,'2026-10-10');assert.equal(demoSnapshot(next).summary.spent,20000);assert.equal(JSON.stringify(s),before);
});
test('월을 걸친 기간·연말·31일 월급일을 날짜 기준으로 처리한다',()=>{
  for(const [date,payday,start,end] of [['2026-10-18',25,'2026-09-25','2026-10-25'],['2027-01-05',10,'2026-12-10','2027-01-10'],['2027-02-28',31,'2027-02-28','2027-03-31'],['2028-02-29',31,'2028-02-29','2028-03-31'],['2026-04-29',31,'2026-03-31','2026-04-30'],['2026-04-30',31,'2026-04-30','2026-05-31'],['2026-05-31',31,'2026-05-31','2026-06-30']]){
    const next=applyDemoSalary(initial(),3000000,payday,date);assert.equal(next.period.start,start);assert.equal(next.period.end,end);
  }
});
test('기간 재분류 시 과거 저축 실적을 보존하고 현재 배정을 실제 저축보다 줄이지 않는다',()=>{
  const s=initial();s.period.allocation=100000;
  s.transactions=[{id:'saved',requestId:'saved',periodId:'2026-09-01',kind:'saving',amount:250000,date:'2026-09-30',category:'저축',memo:'',cancelled:false}];
  const original=demoSnapshot(s).summary.saved,next=applyDemoSalary(s,3000000,25,'2026-10-18');assert.equal(demoSnapshot(next).summary.saved,original);assert.equal(demoSnapshot(next).summary.saving,250000);assert.equal(next.period.allocation,250000);
});
function multiMonth() {
  const s=initial(),d=new Date(today()+'T00:00:00Z');
  const start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).toISOString().slice(0,10);
  s.goal.startDate=start;s.goal.deadline=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+4,0)).toISOString().slice(0,10);
  return s;
}
test('목표 기간의 과거 월 기록은 해당 기간에 배정하고 이번 생활비는 유지한다',()=>{
  const s=multiMonth(),remaining=demoSnapshot(s).summary.remaining,date=s.goal.startDate;
  let v=changeDemo(s,'/transactions',{kind:'expense',amount:12000,date,requestId:'past-expense'});
  assert.equal(v.summary.remaining,remaining);assert.equal(v.state.transactions[0].periodId,date);
  v=changeDemo(v.state,'/transactions',{kind:'saving',amount:500000,date,confirmExtra:true,requestId:'past-saving'});
  assert.equal(v.summary.saved,1100000);assert.equal(v.summary.saving,0);assert.equal(v.summary.remaining,remaining);assert.equal(v.state.period.allocation,400000);
  assert.equal(v.state.periods.find(p=>p.id===date).allocation,500000);
});
test('목표 기간 밖과 미래 기록을 거부하며 경계 날짜를 허용한다',()=>{
  const s=multiMonth(),start=s.goal.startDate,before=new Date(Date.parse(start)-86400000).toISOString().slice(0,10),future=new Date(Date.parse(today())+86400000).toISOString().slice(0,10);
  assert.throws(()=>changeDemo(s,'/transactions',{kind:'expense',amount:100,date:before,requestId:'outside'}),/목표 기간/);
  assert.throws(()=>changeDemo(s,'/transactions',{kind:'expense',amount:100,date:future,requestId:'future'}),/미래/);
  assert.equal(changeDemo(s,'/transactions',{kind:'expense',amount:100,date:start,requestId:'start'}).state.transactions.length,1);
});
test('목표 기간을 줄여도 범위 밖 기록과 저축 실적은 보존한다',()=>{
  const s=multiMonth(),date=s.goal.startDate;
  let v=changeDemo(s,'/transactions',{kind:'saving',amount:100000,date,requestId:'old-saving'});
  const id=v.state.transactions[0].id;
  v=changeDemo(v.state,'/goal',{...v.state.goal,startDate:today(),deadline:v.state.goal.deadline});
  assert.equal(v.summary.saved,700000);assert.equal(v.state.transactions[0].date,date);assert.equal(withinGoal(v.state,date),false);
  v=changeDemo(v.state,'/transactions/'+id,{amount:100000,date,memo:'기간 밖 기록도 보존',requestId:'edit-old'});
  assert.equal(v.summary.saved,700000);assert.equal(v.state.transactions[0].date,date);
});
test('기간이 지나도 마감 없이 다음 기간으로 이동하고 이전 기록·계획을 보존한다',()=>{
  const s=multiMonth(),oldId=s.period.id;
  s.transactions=[{id:'old',requestId:'old',periodId:oldId,kind:'expense',amount:1000,date:s.period.start,category:'식비',memo:'',cancelled:false}];
  const next=currentDemoPeriod(s,s.period.end);
  assert.equal(next.period.start,s.period.end);assert.equal(next.transactions.length,1);assert.equal(next.transactions[0].periodId,oldId);assert.ok(next.periods.some(p=>p.id===oldId));assert.equal(next.history.length,0);
});
