import { useTranslation } from 'react-i18next';
import { Button, Separator, useToast } from 'steamlabsui';
import { createSeedData, DEMO_ACCOUNTS, DEMO_PASSWORD, uid } from '@code-clubs/shared/demo';
import { resetMockDb } from '../../services/mock/mockApi.js';

const seedUsers = createSeedData().users;

/** One-click sign-in for each role. Only rendered in mock mode, never in a real build. */
export function DemoAccounts({ disabled, onSignIn }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return (
    <div className="demo-accounts">
      <Separator />
      <strong>{t('demo.signInAs')}</strong>
      {DEMO_ACCOUNTS.map(({ role, userNumber }) => {
        const user = seedUsers.find((u) => u.id === uid(userNumber));
        return (
          <Button
            key={role}
            variant="outline"
            disabled={disabled}
            onClick={() => onSignIn(user.email, DEMO_PASSWORD)}
          >
            {t(`roles.${role}`)} · {user.fullName}
          </Button>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          resetMockDb();
          toast({ title: t('demo.resetDone') });
        }}
      >
        {t('demo.reset')}
      </Button>
    </div>
  );
}
