import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Field } from 'steamlabsui';
import '../i18n/index.js';
import { PasswordInput } from './PasswordInput.jsx';

describe('PasswordInput', () => {
  it('hides the password until the eye button is pressed', async () => {
    render(
      <Field label="Password">
        <PasswordInput defaultValue="secret" />
      </Field>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await act(async () => screen.getByRole('button', { name: 'Show password' }).click());
    expect(input).toHaveAttribute('type', 'text');

    await act(async () => screen.getByRole('button', { name: 'Hide password' }).click());
    expect(input).toHaveAttribute('type', 'password');
  });
});
