import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb, schema } from './index';

export async function clearOperationalData() {
  const db = getDb();

  console.log('Starting operational database cleanup...');

  // 1. Clear repayments
  console.log('Clearing repayments table...');
  await db.delete(schema.repayments);

  // 2. Clear payroll
  console.log('Clearing payroll table...');
  await db.delete(schema.payroll);

  // 3. Clear loans
  console.log('Clearing loans table...');
  await db.delete(schema.loans);

  // 4. Clear attendance
  console.log('Clearing attendance table...');
  await db.delete(schema.attendance);

  // 5. Clear leave_requests
  console.log('Clearing leave_requests table...');
  await db.delete(schema.leaveRequests);

  // 6. Clear leave_balances
  console.log('Clearing leave_balances table...');
  await db.delete(schema.leaveBalances);

  // 7. Clear documents
  console.log('Clearing documents table...');
  await db.delete(schema.documents);

  // 8. Clear daily_rate_history
  console.log('Clearing daily_rate_history table...');
  await db.delete(schema.dailyRateHistory);

  // 9. Clear contracts
  console.log('Clearing contracts table...');
  await db.delete(schema.contracts);

  // 10. Clear employees
  console.log('Clearing employees table...');
  await db.delete(schema.employees);

  // 11. Clear audit_log
  console.log('Clearing audit_log table...');
  await db.delete(schema.auditLog);

  console.log('Operational database cleanup completed successfully.');
}

if (require.main === module || process.argv[1]?.includes('clear_data.ts')) {
  clearOperationalData()
    .then(() => {
      console.log('Cleanup script finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Cleanup script failed:', err);
      process.exit(1);
    })
}
