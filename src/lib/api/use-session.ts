/**
 * The sign-in, as the screens see it.
 *
 * THE ORDER MATTERS AND IS FIXED HERE: the API base URL has to be set before any request is made,
 * and the session has to exist before any screen asks a question. Every tab therefore renders only
 * once this reports `ready`, which is also why each query hook takes an `enabled` flag — an
 * unauthenticated GET would just spend a round trip on a 401.
 *
 * OPENED OUTSIDE TELEGRAM (a developer, a preview link) there is no signed initData, so this
 * reports `needs-code` and the app asks for the one-time code the bot's /login prints. It must
 * never crash for being opened in a normal browser.
 */
import { useCallback, useEffect, useState } from 'react';

import { setApiBaseUrl } from './base-url';
import { apiBaseUrl } from './runtime-config';
import { currentPlayer, signIn, signInWithCode } from './session';
import { initData, readyAndExpand } from './telegram';
import type { PlayerView } from './types';

export type SessionState = 'signing-in' | 'ready' | 'needs-code' | 'failed';

export interface SessionHandle {
  state: SessionState;
  player: PlayerView | null;
  /** Arabic, and already written for the player: it comes from the backend. */
  error: string | null;
  /** Exchanges the code the bot printed. Resolves to false when the code was refused. */
  submitCode: (code: string) => Promise<boolean>;
  retry: () => void;
}

export function useSession(): SessionHandle {
  const [state, setState] = useState<SessionState>('signing-in');
  const [player, setPlayer] = useState<PlayerView | null>(currentPlayer);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setApiBaseUrl(apiBaseUrl());
    readyAndExpand();

    const signed = initData();
    if (signed === null) {
      setState('needs-code');
      // Explicit: `noImplicitReturns` wants every path to say what it returns, and an effect that
      // has nothing to clean up returns undefined.
      return undefined;
    }

    setState('signing-in');
    signIn(signed)
      .then((result) => {
        if (cancelled) return;
        setPlayer(result);
        setState('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : null);
        setState('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const submitCode = useCallback(async (code: string) => {
    try {
      const result = await signInWithCode(code);
      setPlayer(result);
      setState('ready');
      setError(null);
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : null);
      return false;
    }
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { state, player, error, submitCode, retry };
}
