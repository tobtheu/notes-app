import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { PGliteProvider } from '@electric-sql/pglite-react';
import { Loader2 } from 'lucide-react';
import { getDb } from '../lib/electric';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

interface Props {
  children: ReactNode;
}

export function PGliteWrapper({ children }: Props) {
  const [db, setDb] = useState<PGliteWithLive | null>(null);
  useEffect(() => {
    getDb().then(setDb).catch(console.error);
  }, []);

  if (!db) return (
    <div className="flex items-center justify-center w-full h-full min-h-screen bg-white dark:bg-gray-900">
      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  );

  return <PGliteProvider db={db}>{children}</PGliteProvider>;
}
