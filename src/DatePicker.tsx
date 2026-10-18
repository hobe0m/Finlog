import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { validDate } from './lib/budget.mjs';

type Props = { value: string; onChange: (date: string) => void; start: string; end: string; today: string };
const moveDate = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const dateName = (date: string) => `${Number(date.slice(0, 4))}년 ${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
const monthAfter = (month: string, offset: number) => {
  const d = new Date(month + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
};

export default function DatePicker({ value, onChange, start, end, today }: Props) {
  const id = useId(), grid = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true), [draft, setDraft] = useState(value);
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const lower = start.slice(0, 7), upper = end.slice(0, 7);
  const shown = month < lower ? lower : month > upper ? upper : month;
  const [focusDate, setFocusDate] = useState(value || today);
  const pendingFocus = useRef(false);
  const lastSelectable = today < end ? today : end;
  const selectable = (date: string) => date >= start && date <= lastSelectable;
  useEffect(() => { setDraft(value); input.current?.setCustomValidity(''); }, [value]);
  useEffect(() => {
    if (pendingFocus.current) {
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
      pendingFocus.current = false;
    }
  }, [focusDate, shown]);
  const first = shown + '-01';
  const firstWeekday = new Date(first + 'T00:00:00Z').getUTCDay();
  const days = Array.from({ length: 42 }, (_, i) => moveDate(first, i - firstWeekday));
  const year = Number(shown.slice(0, 4));
  const years = Array.from({ length: Number(upper.slice(0, 4)) - Number(lower.slice(0, 4)) + 1 }, (_, i) => Number(lower.slice(0, 4)) + i);
  const choose = (date: string) => {
    if (!selectable(date)) return;
    setDraft(date); setFocusDate(date); onChange(date); input.current?.setCustomValidity('');
  };
  function editText(text: string) {
    setDraft(text);
    try {
      validDate(text);
      if (!selectable(text)) throw new Error(`목표 기간 중 ${lastSelectable}까지 선택해 주세요.`);
      input.current?.setCustomValidity(''); setMonth(text.slice(0, 7)); onChange(text);
    } catch {
      input.current?.setCustomValidity(`날짜를 YYYY-MM-DD 형식으로 입력해 주세요. 선택 가능: ${start} ~ ${lastSelectable}`);
    }
  }
  return <div className="date-picker">
    <label htmlFor={id}>날짜</label>
    <div className="date-input-row">
      <input ref={input} id={id} aria-describedby={id + '-help'} placeholder="YYYY-MM-DD" inputMode="numeric" required value={draft} onChange={e => editText(e.target.value)} />
      <button type="button" className="date-toggle" aria-label={open ? '달력 접기' : '달력 펼치기'} aria-expanded={open} aria-controls={id + '-calendar'} onClick={() => setOpen(!open)}><CalendarDays size={20}/></button>
    </div>
    <p id={id + '-help'} className="date-range-hint">목표 기간: {start} ~ {end}<br/>기록 가능: {start} ~ {lastSelectable} · 미래 날짜는 기록할 수 없어요.</p>
    {!selectable(value) && <p className="date-range-hint danger">현재 날짜는 변경된 목표 기간 밖이에요. 기존 기록은 보존되며, 날짜를 바꾸려면 목표 기간 안에서 선택해 주세요.</p>}
    {open && <section id={id + '-calendar'} className="calendar-panel" aria-label="목표 기간 달력">
      <div className="calendar-header">
        <button type="button" className="icon-btn" aria-label="이전 달" disabled={shown <= lower} onClick={() => setMonth(monthAfter(shown, -1))}><ChevronLeft size={18}/></button>
        <div className="calendar-month-select">
          <select aria-label="달력 연도" value={year} onChange={e => { const candidate = e.target.value + shown.slice(4); setMonth(candidate < lower ? lower : candidate > upper ? upper : candidate); }}>
            {years.map(y => <option value={y} key={y}>{y}년</option>)}
          </select>
          <select aria-label="달력 월" value={Number(shown.slice(5))} onChange={e => setMonth(`${year}-${e.target.value.padStart(2, '0')}`)}>
            {Array.from({length:12}, (_,i) => i+1).map(m => { const key = `${year}-${String(m).padStart(2, '0')}`; return <option key={m} value={m} disabled={key < lower || key > upper}>{m}월</option>; })}
          </select>
        </div>
        <button type="button" className="icon-btn" aria-label="다음 달" disabled={shown >= upper} onClick={() => setMonth(monthAfter(shown, 1))}><ChevronRight size={18}/></button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">{['일','월','화','수','목','금','토'].map(d => <span key={d}>{d}</span>)}</div>
      <div ref={grid} className="calendar-days" role="group" aria-label={`${year}년 ${Number(shown.slice(5))}월 날짜`}>
        {days.map(date => {
          const inMonth = date.slice(0, 7) === shown, enabled = inMonth && selectable(date);
          const reason = date < start || date > end ? '목표 기간 밖' : date > today ? '미래 날짜' : '';
          return <button key={date} type="button" data-date={date} aria-label={dateName(date) + (reason ? ` (${reason})` : '')} aria-pressed={date === value} disabled={!enabled}
            className={`calendar-day ${!inMonth ? 'adjacent' : ''} ${date === today ? 'is-today' : ''} ${date === value ? 'selected' : ''}`}
            tabIndex={enabled && (focusDate.slice(0,7) === shown ? date === focusDate : date === days.find(d => d.slice(0,7) === shown && selectable(d))) ? 0 : -1}
            onFocus={() => setFocusDate(date)} onClick={() => choose(date)} onKeyDown={e => {
              const offset = ({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7} as Record<string, number>)[e.key];
              if (offset === undefined) return; e.preventDefault();
              const target = moveDate(date, offset);
              if (selectable(target)) { pendingFocus.current = true; setMonth(target.slice(0,7)); setFocusDate(target); }
            }} title={reason || dateName(date)}>{Number(date.slice(8))}</button>;
        })}
      </div>
      <div className="calendar-footer"><span><i/>오늘<span className="calendar-future">· 흐린 날짜는 선택 불가</span></span><button type="button" className="text-btn" disabled={!selectable(today)} onClick={() => { setMonth(today.slice(0,7)); choose(today); }}>오늘 선택</button></div>
    </section>}
  </div>;
}
