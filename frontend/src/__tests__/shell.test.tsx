import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell, BottomNav } from '../components/ui';
import { describe, expect, it } from 'vitest';
describe('shell', () => {
  it('renders synthetic label and accessible navigation', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>Контент</p>
        </AppShell>
        <BottomNav activeTab="/" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Данные синтетические')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument();
  });
});
