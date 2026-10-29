import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Link,
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { ArrowLeft, CircleDot } from 'lucide-react';
import HomePage from '@/pages/home';
import NewMatchPage from '@/pages/new-match';
import MatchPage from '@/pages/match';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkQueryCacheInvalidator() {
  const { user } = useUser();
  const queryClientForUser = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClientForUser.clear();
    }
    previousUserId.current = userId;
  }, [queryClientForUser, user?.id]);

  return null;
}

function PublicLanding() {
  return (
    <div className="page public-landing">
      <div className="eyebrow">PLAYER DEVELOPMENT · PRIVATE BY DEFAULT</div>
      <h1 className="display-title">
        Every point<br />
        <span>has a story.</span>
      </h1>
      <p>
        Keep a private record of every match. Share a scorecard with family or a
        coach only when you choose.
      </p>
      <div className="landing-actions">
        <Link href="/sign-up" className="button">Create your account</Link>
        <Link href="/sign-in" className="button secondary">Sign in</Link>
      </div>
      <div className="privacy-note">
        <span aria-hidden="true">●</span>
        Match notes and insights are private unless you invite a viewer by email.
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="auth-page">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={basePath || '/'}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="auth-page">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={basePath || '/'}
      />
    </div>
  );
}

function Shell() {
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-home">
          <span className="brand-mark"><CircleDot size={18} strokeWidth={1.8} /></span>
          <span>Tennis<span style={{ fontWeight: 500 }}>Scoring</span></span>
        </Link>
        <div className="nav-note">MATCH NOTES · COURTSIDE</div>
        {isLoaded && isSignedIn ? (
          <button
            type="button"
            className="button secondary small"
            onClick={() => void signOut({ redirectUrl: basePath || '/' })}
            data-testid="button-sign-out"
          >
            Sign out
          </button>
        ) : (
          <Link href="/sign-in" className="button secondary small">Sign in</Link>
        )}
      </header>
      <main>
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/">
              {isLoaded && isSignedIn ? <HomePage /> : <PublicLanding />}
            </Route>
            <Route path="/matches/new">
              {isLoaded && isSignedIn ? <NewMatchPage /> : <Redirect to="/" />}
            </Route>
            <Route path="/matches/:id">
              {isLoaded && isSignedIn ? <MatchPage /> : <Redirect to="/" />}
            </Route>
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </main>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  function stripBase(path: string) {
    return basePath && path.startsWith(basePath)
      ? path.slice(basePath.length) || '/'
      : path;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={{
        theme: shadcn,
        cssLayerName: 'clerk',
        options: {
          logoPlacement: 'inside',
          logoLinkUrl: basePath || '/',
          logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
        },
        variables: {
          colorPrimary: '#285743',
          colorForeground: '#253d32',
          colorMutedForeground: '#66766b',
          colorDanger: '#9d493c',
          colorBackground: '#fbfaf5',
          colorInput: '#fffef9',
          colorInputForeground: '#253d32',
          colorNeutral: '#dcd7cb',
          fontFamily: "'DM Sans', sans-serif",
          borderRadius: '0.65rem',
        },
        elements: {
          rootBox: 'w-full flex justify-center',
          cardBox: 'bg-[#fbfaf5] rounded-2xl w-[440px] max-w-full overflow-hidden',
          card: '!shadow-none !border-0 !bg-transparent !rounded-none',
          footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
          headerTitle: 'text-[#234c3d]',
          headerSubtitle: 'text-[#637266]',
          socialButtonsBlockButtonText: 'text-[#253d32]',
          formFieldLabel: 'text-[#57645b]',
          footerActionLink: 'text-[#285743]',
          footerActionText: 'text-[#637266]',
          dividerText: 'text-[#637266]',
          identityPreviewEditButton: 'text-[#285743]',
          formFieldSuccessText: 'text-[#285743]',
          alertText: 'text-[#253d32]',
          logoBox: 'rounded-lg',
          logoImage: 'object-contain',
          socialButtonsBlockButton: 'border-[#dcd7cb] bg-[#fffef9]',
          formButtonPrimary: 'bg-[#285743] hover:bg-[#1d4433] text-[#fbf8ee]',
          formFieldInput: 'border-[#dcd7cb] bg-[#fffef9] text-[#253d32]',
          footerAction: 'border-t border-[#e1ddd2]',
          dividerLine: 'bg-[#dcd7cb]',
          alert: 'bg-[#f8ede7] border-[#e8cfc4]',
          otpCodeFieldInput: 'border-[#dcd7cb] bg-[#fffef9] text-[#253d32]',
          formFieldRow: 'text-[#253d32]',
          main: 'text-[#253d32]',
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your private match book' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Your match history stays private' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryCacheInvalidator />
      <Shell />
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
