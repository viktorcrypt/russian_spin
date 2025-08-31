'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { LoginMethodOrderOption } from '@privy-io/react-auth';

export default function Providers({ children }: { children: React.ReactNode }) {
  const cross = process.env.NEXT_PUBLIC_MONAD_CROSS_APP_ID!;
  const mgidMethod = (`privy:${cross}` as unknown) as LoginMethodOrderOption;

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethodsAndOrder: {
          primary: [mgidMethod],
          overflow: ['email'],
        },

        embeddedWallets: { createOnLogin: 'users-without-wallets' },

        appearance: {
          theme: 'dark',
          accentColor: '#7c3aed',
      
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}