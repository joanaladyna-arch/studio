'use client';

import { useUser } from '@/firebase';

import { useRouter, usePathname } from 'next/navigation';

import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {

  const { user, loading } = useUser();

  const router = useRouter();

  const pathname = usePathname();

  const isPublicRoute = pathname === '/login' || pathname === '/signup';

  useEffect(() => {

    if (!loading && user && isPublicRoute) {

      router.replace('/');

    }

    if (!loading && !user && !isPublicRoute) {

      router.replace('/login');

    }

  }, [user, loading, isPublicRoute, router]);

  if (loading) {

    return <>{children}</>;

  }

  if (!user && !isPublicRoute) {

    return <>{children}</>;

  }

  return <>{children}</>;

}