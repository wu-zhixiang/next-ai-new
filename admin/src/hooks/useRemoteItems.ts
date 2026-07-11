import { useCallback, useEffect, useRef, useState } from 'react';
import { requestWithDedupe } from '../services/requestDedupe';

interface RemoteItemsState<T> {
  readonly items: readonly T[];
  readonly isLoading: boolean;
  readonly errorMessage: string;
  readonly setItems: (items: readonly T[]) => void;
  readonly reload: (options?: { readonly force?: boolean }) => Promise<void>;
}

export function useRemoteItems<T>(
  resourceKey: string,
  loader: () => Promise<readonly T[]>,
): RemoteItemsState<T> {
  const [items, setItems] = useState<readonly T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const requestIdRef = useRef(0);
  const didAutoLoadRef = useRef(false);

  const reload = useCallback(async (options: { readonly force?: boolean } = {}): Promise<void> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const nextItems = await requestWithDedupe(
        resourceKey,
        loader,
        options.force === undefined ? {} : { force: options.force },
      );
      if (requestId !== requestIdRef.current) {
        return;
      }
      setItems(nextItems);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '接口请求失败');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [loader, resourceKey]);

  useEffect(() => {
    if (didAutoLoadRef.current) {
      return;
    }
    didAutoLoadRef.current = true;
    void reload();
  }, [reload]);

  return {
    items,
    isLoading,
    errorMessage,
    setItems,
    reload,
  };
}
