import { AppShell } from './components/AppShell';
import { DashboardPage } from './components/DashboardPage';
import { DashboardProvider } from './lib/store';

export default function App() {
  return (
    <DashboardProvider>
      <AppShell>
        <DashboardPage />
      </AppShell>
    </DashboardProvider>
  );
}
