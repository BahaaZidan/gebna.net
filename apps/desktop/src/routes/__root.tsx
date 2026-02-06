import '../global.css';

import { Outlet, createRootRoute } from '@tanstack/react-router';
import { RelayEnvironmentProvider } from 'react-relay';
import { createRelayEnvironment } from '@repo/data-components';

const environment = createRelayEnvironment();

const RootComponent = () => {
  return (
    <RelayEnvironmentProvider environment={environment}>
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <header className="border-b border-slate-800 px-6 py-4">
          <h1 className="text-xl font-semibold">Desktop (TanStack Start + RN Web)</h1>
        </header>
        <main className="px-6 py-8">
          <Outlet />
        </main>
      </div>
    </RelayEnvironmentProvider>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
});
