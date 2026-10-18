export type Kind = 'expense'|'saving'|'fixed'|'withdraw'|'use'|'income';
export interface Transaction {id:string;periodId:string;requestId:string;kind:Kind;amount:number;date:string;category:string;memo:string;fixedId?:string;cancelled:boolean}
export interface Fixed {id:string;name:string;amount:number;day:number;carry?:boolean}
export interface Goal {name:string;target:number;opening:number;mode:'date'|'amount';startDate?:string;deadline:string;monthly:number;achievedAt:string|null}
export interface Period {id:string;start:string;end:string;income:number;allocation:number;buffer:number;status:string}
export interface Summary {saved:number;saving:number;spent:number;fixed:number;remaining:number;days:number;daily:number;progress:number;income:number}
export interface State {version:number;salary:number;payday:number;goal:Goal;period:Period;periods?:Period[];fixed:Fixed[];nextFixed?:Fixed[];transactions:Transaction[];history:(Period&{summary:Summary})[]}
export interface Snapshot {state:State;summary:Summary;forecast:{amount:number|null;date:string|null;opportunities:number};asOf:string}
