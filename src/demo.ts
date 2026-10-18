import type { Snapshot, State } from './types';
import { forecast, money, periodFor, summary, today, transact, validDate } from './lib/budget.mjs';
import { currentDemoPeriod, goalRange, recordPeriod, storePeriod, withinGoal } from './goal-period.ts';

/** Reassign by actual date rather than moving dates or deleting earlier records. */
export function applyDemoSalary(state: State, salary: number, payday: number, date = today()): State {
  money(salary, '월급', false);
  if (!Number.isInteger(payday) || payday < 1 || payday > 31) throw new Error('월급일은 1~31일입니다.');
  const next = structuredClone(state);
  next.goal.startDate ||= state.period.start;
  next.salary = salary;
  next.payday = payday;
  next.period = { ...next.period, ...periodFor(date, payday), income: salary };
  next.transactions = next.transactions.map(transaction => ({
    ...transaction,
    periodId: periodFor(transaction.date, payday).id,
  }));
  if (payday !== state.payday) next.periods = [];
  const paid = new Set<string>();
  for (const transaction of next.transactions) {
    if (!transaction.cancelled && transaction.kind === 'fixed' && transaction.periodId === next.period.id && transaction.fixedId) {
      if (paid.has(transaction.fixedId)) throw new Error('변경할 기간에 같은 필수 지출의 납부 기록이 겹쳐요. 기록을 확인한 후 다시 변경해 주세요.');
      paid.add(transaction.fixedId);
    }
  }
  // Existing savings remain real savings, even when a wider period includes them.
  next.period.allocation = Math.max(next.period.allocation, summary(next).saving);
  storePeriod(next, next.period);
  return next;
}

export function demoSnapshot(state: State): Snapshot {
  const current = currentDemoPeriod(state);
  return { state: current, summary: summary(current), forecast: forecast(current), asOf: new Date().toISOString() };
}

export function snapshotForDate(state: State, date: string): Snapshot {
  const selected = { ...state, period: recordPeriod(state, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today()) };
  return { state: selected, summary: summary(selected), forecast: forecast(selected), asOf: new Date().toISOString() };
}

function recordDemo(state: State, input: any, originalDate?: string) {
  validDate(input.date);
  if (input.date > today()) throw new Error('미래 날짜에는 실제 기록을 남길 수 없어요. 오늘까지 선택해 주세요.');
  if (!withinGoal(state, input.date) && input.date !== originalDate) {
    const range = goalRange(state);
    throw new Error(`목표 기간 ${range.start} ~ ${range.end} 안의 날짜를 선택해 주세요.`);
  }
  storePeriod(state, state.period);
  state.period = recordPeriod(state, input.date);
  transact(state, input);
  storePeriod(state, state.period);
  state.period = recordPeriod(state);
}

/** All changes are applied to a copy, so rejected input never changes the screen. */
export function changeDemo(current: State, endpoint: string, input: any): Snapshot {
  let state = currentDemoPeriod(current);
  if (endpoint === '/transactions') {
    if (state.transactions.some(t => t.requestId === input.requestId)) return demoSnapshot(state);
    recordDemo(state, input);
  } else if (endpoint.startsWith('/transactions/')) {
    const transaction = state.transactions.find(t => t.id === endpoint.split('/').at(-1));
    if (!transaction || transaction.cancelled) throw new Error('유효한 기록을 찾을 수 없습니다.');
    transaction.cancelled = true;
    if (input.action !== 'cancel') recordDemo(state, { ...transaction, ...input, kind: transaction.kind }, transaction.date);
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
    const startDate = input.startDate || state.goal.startDate || state.period.start;
    validDate(startDate);
    if (input.deadline < startDate) throw new Error('목표 종료일은 시작일보다 빠를 수 없습니다.');
    if (!input.name?.trim() || !['date', 'amount'].includes(input.mode)) throw new Error('목표 이름과 방식을 확인해 주세요.');
    if (input.mode === 'amount' && input.monthly === 0 && summary(state).saved < input.target) throw new Error('월 저축액은 0원보다 커야 합니다.');
    Object.assign(state.goal, { name: input.name.slice(0, 80), target: input.target, monthly: input.monthly, startDate, deadline: input.deadline, mode: input.mode });
    if (summary(state).saved >= state.goal.target && !state.goal.achievedAt) state.goal.achievedAt = today();
  } else if (endpoint === '/settings') {
    state = applyDemoSalary(state, input.salary, input.payday);
  } else {
    throw new Error('데모에서는 제공하지 않는 기능이에요.');
  }
  state.version++;
  storePeriod(state, state.period);
  return demoSnapshot(state);
}
