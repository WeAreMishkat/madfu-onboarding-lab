import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';

/** Render the whole Lab at a route, exactly as deployed (lazy routes included). */
export function renderAt(path: string) {
  const user = userEvent.setup({ delay: null });
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
  return { user, ...utils };
}
