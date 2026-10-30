import { createServerSupabaseClient } from '../supabase/server';
import { getDb, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { UserSession, AuthorizationError } from './rbac';
import { cookies } from 'next/headers';
import { cache } from 'react';

interface CachedUser {
  user: UserSession;
  expiresAt: number;
}

const userSessionCache = new Map<string, CachedUser>();

export function invalidateUserSessionCache(email?: string) {
  if (email) {
    userSessionCache.delete(email);
  } else {
    userSessionCache.clear();
  }
}

async function fetchCurrentUser(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  
  // Check for local dev session cookie or Supabase session
  const devSessionEmail = cookieStore.get('hr_dev_session_user')?.value;
  let userEmail: string | null = null;
  let userId: string | null = null;

  if (devSessionEmail) {
    userEmail = decodeURIComponent(devSessionEmail);
  } else {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        userEmail = user.email;
        userId = user.id;
      }
    } catch {
      // In dev or test environments without live Supabase Auth server
    }
  }

  if (!userEmail) {
    return null;
  }

  // Check in-memory cache first (30s TTL)
  const cached = userSessionCache.get(userEmail);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.user;
  }

  const db = getDb();
  let dbUsers = await db.select().from(schema.users).where(eq(schema.users.email, userEmail));

  if (dbUsers.length === 0) {
    try {
      await db.insert(schema.users).values({
        email: userEmail,
        fullName: userEmail.split('@')[0] || 'مستخدم النظام',
        role: 'ADMIN',
        active: true,
      });
      dbUsers = await db.select().from(schema.users).where(eq(schema.users.email, userEmail));
    } catch {
      return null;
    }
  }

  if (dbUsers.length === 0) {
    return null;
  }

  const profile = dbUsers[0];

  // Block inactive users immediately
  if (!profile.active) {
    return null;
  }

  const sessionUser: UserSession = {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    active: profile.active,
  };

  userSessionCache.set(userEmail, {
    user: sessionUser,
    expiresAt: Date.now() + 30 * 1000, // 30 seconds TTL
  });

  return sessionUser;
}

export const getCurrentUser = cache(fetchCurrentUser);

export async function requireAuth(): Promise<UserSession> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError('يجب تسجيل الدخول أولاً');
  }
  return user;
}
