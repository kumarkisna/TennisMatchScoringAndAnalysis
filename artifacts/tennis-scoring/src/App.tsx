import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { ArrowLeft, CircleDot } from 'lucide-react';
import HomePage from '@/pages/home';
import NewMatchPage from '@/pages/new-match';
import MatchPage from '@/pages/match';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Shell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-home">
          <span className="brand-mark"><CircleDot size={18} strokeWidth={1.8} /></span>
          <span>Tennis<span style={{ fontWeight: 500 }}>Scoring</span></span>
        </Link>
        <div className="nav-note">MATCH NOTES · COURTSIDE</div>
        <Link href="/" className="button secondary small" data-testid="link-back-matches">
          <ArrowLeft size={15} /> Matches
        </Link>
      </header>
      <main>
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/matches/new" component={NewMatchPage} />
            <Route path="/matches/:id" component={MatchPage} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Shell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
