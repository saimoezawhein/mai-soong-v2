'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../dashboard/layout';

export default function DailySummaryLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/login');
    }
  }, [router]);

  return <DashboardLayout>{children}</DashboardLayout>;
}
