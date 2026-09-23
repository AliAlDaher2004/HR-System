import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { generateNextEmployeeNo } from '@/lib/services/employee-service';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const nextEmployeeNo = await generateNextEmployeeNo();
    return NextResponse.json({ nextEmployeeNo });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء توليد الرقم الوظيفي' }, { status: 500 });
  }
}
