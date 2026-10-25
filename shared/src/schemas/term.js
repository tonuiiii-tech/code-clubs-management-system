import { z } from 'zod';
import { TERM_NUMBERS } from '../enums.js';

/** A school term (questionnaire Q9). Reports and the HQ dashboard are per term. */
const termFields = z.object({
  year: z.number().int().min(2024).max(2100),
  number: z.union(TERM_NUMBERS.map((n) => z.literal(n))),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

const datesInOrder = (term, ctx) => {
  if (term.startDate && term.endDate && term.endDate <= term.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date must be after start date',
    });
  }
};

export const createTermSchema = termFields.strict().superRefine(datesInOrder);
export const updateTermSchema = termFields
  .pick({ startDate: true, endDate: true })
  .partial()
  .strict()
  .superRefine(datesInOrder);

/** The term that contains a date (YYYY-MM-DD), or null. */
export const termOn = (terms, date) =>
  terms.find((t) => t.startDate <= date && date <= t.endDate) ?? null;

/** The term containing the date, else the last one that ended before it, else null. */
export function termForDate(terms, date) {
  const current = termOn(terms, date);
  if (current) return current;
  const past = terms
    .filter((t) => t.endDate < date)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  return past[0] ?? null;
}

/** Usual Kenyan school term dates, offered when HQ adds a year (they can be changed). */
export const suggestedTerms = (year) => [
  { year, number: 1, startDate: `${year}-01-06`, endDate: `${year}-04-04` },
  { year, number: 2, startDate: `${year}-04-28`, endDate: `${year}-08-01` },
  { year, number: 3, startDate: `${year}-08-25`, endDate: `${year}-10-31` },
];
