import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb, schema } from './index';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import { createAdminClient } from '../lib/supabase/admin';

export async function seedDatabase() {
  const db = getDb();

  console.log(`Starting database initialization in ${process.env.NODE_ENV || 'development'} mode...`);

  const adminEmail = process.env.FIRST_ADMIN_EMAIL;
  const adminPassword = process.env.FIRST_ADMIN_PASSWORD || '123456';
  const adminName = process.env.FIRST_ADMIN_NAME || 'محمد (مدير النظام)';

  if (adminEmail) {
    console.log(`Initializing system administrator: ${adminEmail}`);
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail));
    if (existing.length === 0) {
      await db.insert(schema.users).values({
        email: adminEmail,
        fullName: adminName,
        role: 'ADMIN',
        active: true,
      });
      console.log('System administrator provisioned in PostgreSQL Database.');
    }

    // Provision user in Supabase Auth
    try {
      const supabaseAdmin = createAdminClient();
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

      if (error) {
        if (error.message.includes('already') || error.status === 422) {
          console.log('User already registered in Supabase Auth. Syncing password...');
          const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
          const targetUser = usersData?.users.find((u) => u.email === adminEmail);
          if (targetUser) {
            await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
              password: adminPassword,
              email_confirm: true,
            });
            console.log('Supabase Auth user password updated to 123456.');
          }
        } else {
          console.warn('Supabase Auth notice:', error.message);
        }
      } else {
        console.log('Supabase Auth user created successfully.');
      }
    } catch (err: any) {
      console.warn('Could not provision Supabase Auth user:', err.message);
    }
  }

  const existingSettings = await db.select().from(schema.settings);
  if (existingSettings.length === 0) {
    await db.insert(schema.settings).values({
      companyName: 'إدارة الموارد البشرية',
      country: 'المملكة الأردنية الهاشمية',
      currency: 'JOD',
      timezone: 'Asia/Amman',
      payrollPolicy: 'سياسة صرف الرواتب والأجور المعتمدة للشركة',
      payrollPolicyConfirmed: true,
      defaultWorkStartTime: '08:00:00',
      defaultWorkEndTime: '17:00:00',
      defaultBreakMinutes: 60,
      defaultMinuteDeductionRate: '0.300',
    });
    console.log('Default system settings initialized.');
  }

  // Ensure storage directories exist
  try {
    const storageDir = path.resolve(process.cwd(), './storage/private/employee-documents');
    fs.mkdirSync(storageDir, { recursive: true });
  } catch (err) {
    console.warn('Storage directory initialization warning:', err);
  }

  console.log('Database initialization completed.');
}

// When run directly from CLI
if (require.main === module || process.argv[1]?.includes('seed.ts')) {
  seedDatabase()
    .then(() => {
      console.log('Database seeding finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
