import { getDb, schema } from '../../db';
import { sql } from 'drizzle-orm';

interface SettingsCache {
  data: any;
  expiresAt: number;
}

let settingsCache: SettingsCache | null = null;

export function invalidateSettingsCache() {
  settingsCache = null;
}

export async function getSystemSettings() {
  if (settingsCache && Date.now() < settingsCache.expiresAt) {
    return settingsCache.data;
  }

  const db = getDb();

  try {
    const [row] = await db.select().from(schema.settings).limit(1);
    if (!row) return null;
    const result = {
      ...row,
      defaultOtRate: (row as any).defaultOtRate || '2.500',
    };
    settingsCache = {
      data: result,
      expiresAt: Date.now() + 60 * 1000, // 60 seconds TTL
    };
    return result;
  } catch (err) {
    try {
      const [row] = await db
        .select({
          id: schema.settings.id,
          companyName: schema.settings.companyName,
          country: schema.settings.country,
          currency: schema.settings.currency,
          timezone: schema.settings.timezone,
          payrollPolicy: schema.settings.payrollPolicy,
          payrollPolicyConfirmed: schema.settings.payrollPolicyConfirmed,
          defaultWorkStartTime: schema.settings.defaultWorkStartTime,
          defaultWorkEndTime: schema.settings.defaultWorkEndTime,
          defaultBreakMinutes: schema.settings.defaultBreakMinutes,
          defaultMinuteDeductionRate: schema.settings.defaultMinuteDeductionRate,
        })
        .from(schema.settings)
        .limit(1);
      const result = row ? { ...row, defaultOtRate: '2.500' } : null;
      if (result) {
        settingsCache = {
          data: result,
          expiresAt: Date.now() + 60 * 1000,
        };
      }
      return result;
    } catch {
      return null;
    }
  }
}

