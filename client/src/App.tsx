import { AppShell } from './components/AppShell';
import { DashboardPage } from './components/DashboardPage';
import { DashboardProvider } from './lib/store';
import { TimersProvider } from './lib/timersStore';

export default function App() {
  return (
    <DashboardProvider>
      <TimersProvider>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </TimersProvider>
    </DashboardProvider>
  );
}
