import { useProposed, useStepFocus } from '../store';
import { Actions, Alert, Button, StepHeader } from '../ui/components';
import { IconLock } from '../ui/icons';

/**
 * Existing (live) merchant after the account-mobile code: hand over to the merchant login. No
 * onboarding application is created. The Merchant Portal itself is outside this prototype.
 */
export function LoginStep() {
  const { state } = useProposed();
  const titleRef = useStepFocus<HTMLHeadingElement>();
  return (
    <section className="mb-card mb-card-narrow" aria-labelledby="mb-step-title">
      <div className="mb-icon-tile" aria-hidden="true"><IconLock size={22} /></div>
      <StepHeader title="This business already has a Madfu account." description="Sign in to your merchant account to manage it. No new application was created." titleRef={titleRef} />
      <Actions><Button size="lg" block disabled>Go to merchant login</Button></Actions>
      <Alert tone="info">Prototype: the merchant login and Merchant Portal are outside this onboarding prototype.{state.app.status === 'LIVE' ? ' This application is now live.' : ''}</Alert>
    </section>
  );
}
