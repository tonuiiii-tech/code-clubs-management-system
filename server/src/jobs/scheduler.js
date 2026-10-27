import { runTermlyReports } from '../modules/reports/reports.service.js';

/**
 * Daily jobs (plan section 5). Checked every hour, so a restart never skips a day; the report
 * lock makes repeated checks and several servers safe (R4-2).
 */
const HOUR = 60 * 60 * 1000;

export function startScheduler({ log = console } = {}) {
  const tick = () =>
    runTermlyReports()
      .then((results) => {
        for (const r of results) {
          if (r.error) log.error(`Termly report for term ${r.termId} failed: ${r.error}`);
          else log.log(`Termly report for term ${r.termId}: ${r.messages} emails recorded.`);
        }
      })
      .catch((err) => log.error(`Termly report check failed: ${err.message}`));
  tick();
  const timer = setInterval(tick, HOUR);
  timer.unref();
  return () => clearInterval(timer);
}
