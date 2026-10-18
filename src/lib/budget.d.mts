import type { State, Snapshot } from '../types';
export function today(): string;
export function periodFor(date: string, payday: number, next?: boolean): Pick<State['period'], 'id' | 'start' | 'end'>;
export function summary(state: State, date?: string): Snapshot['summary'];
export function forecast(state: State): Snapshot['forecast'];
export function money(value: number, name?: string, allowZero?: boolean): number;
export function validDate(value: string): string;
export function transact(state: State, input: any): State;
