import { clerkMiddleware } from '@clerk/nextjs/server';
import { createClient } from './app/utils/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Handle Supabase session
  const supabaseResponse = createClient(req);
  return supabaseResponse;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};