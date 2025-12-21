"use client";

import { useEffect } from 'react';
import { initParentAppIntegration } from '@/lib/parentAppIntegration';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize parent app integration
    const cleanup = initParentAppIntegration();
    return cleanup;
  }, []);

  return <>{children}</>;
}

