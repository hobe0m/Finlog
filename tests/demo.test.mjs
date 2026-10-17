import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeDemo,demoSnapshot} from '../src/demo.ts';
import {createState,today} from '../src/lib/budget.mjs';

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
