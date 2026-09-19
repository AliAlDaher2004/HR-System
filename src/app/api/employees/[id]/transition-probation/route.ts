import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { transitionProbationToPermanent } from '@/lib/services/employee-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح لك بالوصول' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const updated = await transitionProbationToPermanent(user, id, body);

    return NextResponse.json({
      success: true,
      employee: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء تثبيت الموظف وتوقيع العقد' }, { status: 400 });
  }
}
