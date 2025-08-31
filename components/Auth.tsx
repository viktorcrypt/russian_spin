'use client';


import React, { useEffect, useState } from 'react';
import {
  usePrivy,
  CrossAppAccountWithMetadata,
  User as PrivyUser,
} from '@privy-io/react-auth';
import { MONAD_GAMES_CROSS_APP_ID, MGID_CHECK_USERNAME_URL } from '@/lib/game-config';

type PublicUser = {
  id?: string;
  address: string;
  username?: string;
  hasUsername: boolean;
  isLoading: boolean;
} | null;

interface AuthComponentProps {
  onUserChange?: (user: PublicUser) => void;
}

export function AuthComponent({ onUserChange }: AuthComponentProps) {
  const [isClient, setIsClient] = useState(false);
  const [accountAddress, setAccountAddress] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [hasUsername, setHasUsername] = useState<boolean>(false);

  const { authenticated, user, ready, login, logout } = usePrivy();

  
  useEffect(() => setIsClient(true), []);

  
  useEffect(() => {
    const run = async () => {
      if (!isClient || !ready || !authenticated || !user) return;

      const u = user as PrivyUser;

      if (u.linkedAccounts?.length) {
        const crossApp = u.linkedAccounts.find(
          (acc) =>
            acc.type === 'cross_app' &&
            (acc as CrossAppAccountWithMetadata).providerApp?.id === MONAD_GAMES_CROSS_APP_ID
        ) as CrossAppAccountWithMetadata | undefined;

        if (!crossApp) {
          console.warn('No MGID cross_app account found for user');
          return;
        }

        const wallet = crossApp.embeddedWallets?.[0]?.address;
        if (!wallet) {
          console.warn('MGID cross_app has no embedded wallet');
          return;
        }

        if (wallet !== accountAddress) {
          setAccountAddress(wallet);

          try {
            const resp = await fetch(`${MGID_CHECK_USERNAME_URL}?wallet=${wallet}`);
            const data = await resp.json();
            if (data?.hasUsername) {
              setUsername(data.user.username);
              setHasUsername(true);
            } else {
              setUsername('');
              setHasUsername(false);
            }
          } catch (e) {
            console.error('Username fetch failed', e);
            setUsername('');
            setHasUsername(false);
          }
        }
      } else {
        console.warn('User has no linkedAccounts');
      }
    };

    run();
  }, [isClient, ready, authenticated, user, accountAddress]);

  
  useEffect(() => {
    if (!onUserChange || !isClient) return;

    if (authenticated && accountAddress) {
      onUserChange({
        id: user?.id,
        address: accountAddress,
        username,
        hasUsername,
        isLoading: false,
      });
    } else if (!authenticated) {
      onUserChange(null);
    }
  }, [isClient, authenticated, accountAddress, username, hasUsername, onUserChange, user?.id]);

  if (!isClient || !ready) {
    return <div className="text-sm opacity-70">Loading authentication…</div>;
  }

  if (!authenticated) {
    return (
      <button
        onClick={() => login()}
        className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500"
      >
        Monad Games ID
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {hasUsername && username ? (
        <span className="px-2 py-1 rounded bg-zinc-800">@{username}</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded bg-zinc-800">
            {accountAddress
              ? `${accountAddress.slice(0, 6)}…${accountAddress.slice(-4)}`
              : 'Connecting…'}
          </span>
          {accountAddress && (
            <a
              href="https://monad-games-id-site.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
            >
              Register Username
            </a>
          )}
        </div>
      )}
      <button
        onClick={() => logout()}
        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
      >
        Log out
      </button>
    </div>
  );
}

export default AuthComponent;