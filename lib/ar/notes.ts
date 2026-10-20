import { daysBetween } from './dates';
import type { ArData, Note, Paise } from './types';

export type PromiseStatus = 'Kept' | 'Broken' | 'Pending';

export interface FollowUp {
  note: Note;
  daysOverdue: number; // 0 when the follow-up is due today
}

export interface PromiseToPay {
  note: Note;
  promiseDate: string;
  promiseAmount: Paise;
  received: Paise; // settlement value received from note_date to min(promise_date, asOf)
  status: PromiseStatus;
}

/**
 * R16: open follow-ups as at asOf: follow_up_date on or before asOf and not marked done.
 * A note dated after asOf does not exist yet (R10). Oldest follow-up first.
 */
export function followUpsDue(data: ArData, asOf: string): FollowUp[] {
  return data.notes
    .filter((n) => n.noteDate <= asOf && n.followUpDate !== null && n.followUpDate <= asOf && !n.followUpDone)
    .map((note) => ({ note, daysOverdue: daysBetween(note.followUpDate!, asOf) }))
    .sort((a, b) => a.note.followUpDate!.localeCompare(b.note.followUpDate!) || a.note.id - b.note.id);
}

/**
 * R16: every promise to pay noted on or before asOf, with its status.
 * Kept when the customer's receipts (bank + TDS) dated from the note date to the earlier of
 * the promise date and asOf reach the promised amount; Broken when not kept and the promise
 * date has passed; otherwise Pending.
 */
export function promiseStatuses(data: ArData, asOf: string): PromiseToPay[] {
  const promises: PromiseToPay[] = [];
  for (const note of data.notes) {
    if (note.noteDate > asOf || note.promiseDate === null || note.promiseAmount === null) continue;
    const windowEnd = note.promiseDate < asOf ? note.promiseDate : asOf;
    let received = 0;
    for (const r of data.receipts) {
      if (r.customerId === note.customerId && note.noteDate <= r.receiptDate && r.receiptDate <= windowEnd) {
        received += r.bankAmount + r.tdsAmount;
      }
    }
    const status: PromiseStatus =
      received >= note.promiseAmount ? 'Kept' : note.promiseDate < asOf ? 'Broken' : 'Pending';
    promises.push({ note, promiseDate: note.promiseDate, promiseAmount: note.promiseAmount, received, status });
  }
  return promises;
}
