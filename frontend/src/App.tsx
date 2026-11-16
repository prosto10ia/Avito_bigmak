import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell, BottomNav } from './components/ui';
import Dashboard from './routes';
import Roadmap from './routes/roadmap';
import Chat from './routes/chat';
import Calendar from './routes/calendar';
import Profile from './routes/profile';
import './styles.css';
const queryClient = new QueryClient();
function RoutedApp() {
  const location = useLocation();
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
      <BottomNav activeTab={location.pathname} />
    </AppShell>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RoutedApp />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
