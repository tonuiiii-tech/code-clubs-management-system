import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from 'steamlabsui';

/** Search box that waits until typing pauses before updating the filter. */
export function SearchInput({ value, onSearch, delay = 300 }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);

  // When the URL changes the filter (back button, cleared filters), show the new value.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return undefined;
    const timer = setTimeout(() => onSearch(text.trim()), delay);
    return () => clearTimeout(timer);
  }, [text, value, onSearch, delay]);

  return (
    <Input
      type="search"
      aria-label={t('common.search')}
      placeholder={t('common.search')}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}
