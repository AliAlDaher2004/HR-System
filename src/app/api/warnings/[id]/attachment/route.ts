import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { RBAC } from '@/lib/auth/rbac';
import { getWarningById, getWarningAttachmentSignedUrl } from '@/lib/services/warning-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse('يجب تسجيل الدخول', { status: 401 });
  }

  if (!RBAC.canViewWarnings(user.role)) {
    return new NextResponse('غير مصرح لك بالاطلاع على مرفقات الإنذارات', { status: 403 });
  }

  const { id } = await params;
  const warning = await getWarningById(user, id);
  if (!warning || !warning.attachmentPath) {
    return new NextResponse('مرفق كتاب الإنذار غير موجود', { status: 404 });
  }

  const signedUrl = await getWarningAttachmentSignedUrl(user, warning.attachmentPath);
  if (!signedUrl) {
    return new NextResponse('فشل توليد رابط المرفق الآمن', { status: 500 });
  }

  return NextResponse.redirect(new URL(signedUrl, req.url));
}
