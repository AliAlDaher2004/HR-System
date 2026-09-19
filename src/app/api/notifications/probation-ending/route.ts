import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getEmployeesDueForContractSigning } from '@/lib/services/employee-service';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح لك بالوصول' }, { status: 401 });
  }

  try {
    const employeesDue = await getEmployeesDueForContractSigning(user);
    return NextResponse.json({
      success: true,
      count: employeesDue.length,
      employees: employeesDue,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء جلب إشعارات العقود' }, { status: 500 });
  }
}
