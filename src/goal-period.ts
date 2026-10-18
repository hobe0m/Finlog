import type { Period, State } from './types';
import { periodFor, today } from './lib/budget.mjs';

export const goalRange = (state: State) => ({ start: state.goal.startDate || state.period.start, end: state.goal.deadline });
export function withinGoal(state: State, date: string) {
  const range = goalRange(state);
  return date >= range.start && date <= range.end;
}
export function recordPeriod(state: State, date = today()): Period {
  const range = periodFor(date, state.payday);
  if (range.id === state.period.id) return { ...state.period };
  return { ...(state.periods?.find(p => p.id === range.id) || {
    income: state.salary, allocation: state.period.allocation, buffer: state.period.buffer, status: 'confirmed',
  }), ...range };
}
export function storePeriod(state: State, period: Period) {
  state.periods = [...(state.periods || []).filter(p => p.id !== period.id), { ...period }];
}
export function currentDemoPeriod(state: State, date = today()): State {
  const next = structuredClone(state);
  next.goal.startDate ||= state.period.start;
  storePeriod(next, next.period);
  next.period = recordPeriod(next, date);
  return next;
}
