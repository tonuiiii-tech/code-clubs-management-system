import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../utils/useApi.js';
import { listAnnouncements } from '../services/announcementsService.js';

/** Tells the bell to count again, e.g. after an announcement is opened. */
const EVENT = 'cc-announcements-changed';
export const notifyAnnouncementsChanged = () => window.dispatchEvent(new Event(EVENT));

// `refresh` only changes the key so the count is fetched again.
const unreadCount = () => listAnnouncements({ pageSize: 1 });

/** The bell in the top bar with the number of new announcements (plan section 7). */
export function AnnouncementsBell() {
  const { t } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const bump = () => setRefresh((n) => n + 1);
    window.addEventListener(EVENT, bump);
    return () => window.removeEventListener(EVENT, bump);
  }, []);
  const { data } = useApi(unreadCount, refresh);
  const unread = data?.unread ?? 0;
  const label = unread ? t('announcements.bell', { count: unread }) : t('announcements.bellNone');
  return (
    <Link to="/announcements" className="bell" aria-label={label} title={label}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && <span className="bell__count">{unread}</span>}
    </Link>
  );
}
