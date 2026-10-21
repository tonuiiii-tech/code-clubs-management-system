import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';

function Title() {
  const { t } = useTranslation();
  return <h1>{t('login.title')}</h1>;
}

describe('LanguageSwitcher', () => {
  afterEach(() => act(() => i18n.changeLanguage('en')));

  it('switches the interface between English and Kiswahili', async () => {
    await act(() => i18n.changeLanguage('en'));
    render(
      <>
        <LanguageSwitcher />
        <Title />
      </>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Sign in');
    await act(async () => screen.getByText('Kiswahili').click());
    expect(screen.getByRole('heading')).toHaveTextContent('Ingia');
  });
});
