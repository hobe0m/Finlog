import type { Snapshot, State } from './types';
import { forecast, money, summary, today, transact, validDate } from './lib/budget.mjs';

export function demoSnapshot(state: State): Snapshot {
  return { state, summary: summary(state), forecast: forecast(state), asOf: new Date().toISOString() };
}

/** All changes are applied to a copy, so rejected input never changes the screen. */
export function changeDemo(current: State, endpoint: string, input: any): Snapshot {
  const state = structuredClone(current);
  if (endpoint === '/transactions') {
    if (state.transactions.some(t => t.requestId === input.requestId)) return demoSnapshot(state);
    transact(state, input);
  } else if (endpoint.startsWith('/transactions/')) {
    const transaction = state.transactions.find(t => t.id === endpoint.split('/').at(-1));
    if (!transaction || transaction.cancelled) throw new Error('유효한 기록을 찾을 수 없습니다.');
    transaction.cancelled = true;
    if (input.action !== 'cancel') transact(state, { ...transaction, ...input, kind: transaction.kind });
    if (summary(state).saved < 0) throw new Error('이 저축을 사용하는 인출 기록을 먼저 취소해 주세요.');
  } else if (endpoint === '/plan') {
    money(input.allocation, '목표 저축 배정액');
    money(input.buffer, '여유 자금');
    if (input.allocation < summary(state).saving) throw new Error('이미 저축한 금액보다 배정을 줄일 수 없습니다.');
    state.period.allocation = input.allocation;
    state.period.buffer = input.buffer;
    if (summary(state).remaining < 0) throw new Error('생활비가 음수가 되지 않도록 조정해 주세요.');
  } else if (endpoint === '/goal') {
    money(input.target, '목표 금액', false);
    money(input.monthly, '월 저축액');
    validDate(input.deadline);
    if (!input.name?.trim() || !['date', 'amount'].includes(input.mode)) throw new Error('목표 이름과 방식을 확인해 주세요.');
    if (input.mode === 'amount' && input.monthly === 0 && summary(state).saved < input.target) throw new Error('월 저축액은 0원보다 커야 합니다.');
    Object.assign(state.goal, { name: input.name.slice(0, 80), target: input.target, monthly: input.monthly, deadline: input.deadline, mode: input.mode });
    if (forecast(state).amount === null) throw new Error('남은 저축 기회가 없습니다. 목표 날짜를 변경해 주세요.');
    if (summary(state).saved >= state.goal.target && !state.goal.achievedAt) state.goal.achievedAt = today();
  } else if (endpoint === '/settings') {
    money(input.salary, '월급', false);
    if (!Number.isInteger(input.payday) || input.payday < 1 || input.payday > 31) throw new Error('월급일은 1~31일입니다.');
    state.salary = input.salary;
    state.payday = input.payday;
  } else {
    throw new Error('데모에서는 제공하지 않는 기능이에요.');
  }
  state.version++;
  return demoSnapshot(state);
}
