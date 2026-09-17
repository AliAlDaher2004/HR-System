import { getDb, schema } from '../../db';
import { sql } from 'drizzle-orm';

let columnChecked = false;

export async function getSystemSettings() {
  const db = getDb();

  try {
    const [row] = await db.select().from(schema.settings).limit(1);
    if (!row) return null;
    return {
      ...row,
      defaultOtRate: (row as any).defaultOtRate || '2.500',
    };
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
      return row ? { ...row, defaultOtRate: '2.500' } : null;
    } catch {
      return null;
    }
  }
}

