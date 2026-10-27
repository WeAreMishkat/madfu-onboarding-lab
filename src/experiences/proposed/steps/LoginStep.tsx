import { useState } from 'react';
import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button } from '../ui/components';
import { IconLock } from '../ui/icons';

/**
 * Existing live merchant after the account-mobile code: a popup, never an automatic redirect. Only the
 * "Log in" click hands over to the merchant login. No onboarding application is created. The merchant
 * login and Merchant Portal themselves are outside this prototype.
 */
export function LoginStep() {
  const { state } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  const [opened, setOpened] = useState(false);
  const cr = state.app.kyb.kind === 'CR' || /^7/.test(state.app.identity.identifier);

  if (opened) {
    return (
      <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
        <div className="mb-icon-tile" aria-hidden="true"><IconLock size={22} /></div>
        <h1 className="mb-title" ref={titleRef} tabIndex={-1}>Merchant login</h1>
        <Alert tone="info">Prototype: this is where the merchant login opens. The login and the Merchant Portal are outside this onboarding prototype.</Alert>
      </section>
    );
  }

  return (
    <div className="mb-modal-backdrop">
      <div className="mb-modal" role="dialog" aria-modal="true" aria-labelledby="mb-step-title">
        <div className="mb-icon-tile" aria-hidden="true"><IconLock size={22} /></div>
        <h1 className="mb-title" id="mb-step-title" ref={titleRef} tabIndex={-1}>You already have an active account under this {cr ? 'CR' : 'National ID'}.</h1>
        <p className="mb-description">Log in to manage your merchant account. No new application was created.</p>
        <Actions><Button size="lg" block onClick={() => setOpened(true)}>Log in</Button></Actions>
      </div>
    </div>
  );
}
