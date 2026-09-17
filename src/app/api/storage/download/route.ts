import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse('رمز التحميل مفقود أو غير صالح', { status: 400 });
  }

  try {
    const rawPayload = Buffer.from(token, 'base64url').toString('utf8');
    const { bucket, filePath, expiresAt, signature } = JSON.parse(rawPayload);

    // 1. Verify expiration
    if (Date.now() > expiresAt) {
      return new NextResponse('انتهت صلاحية رابط التحميل المؤقت (Expired Token)', { status: 403 });
    }

    // 2. Verify HMAC signature
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-secure-salt-2026';
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(`${bucket}:${filePath}:${expiresAt}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      return new NextResponse('فشل التحقق الأمني من توقيع الرابط (Invalid Signature)', { status: 403 });
    }

    // 3. Locate private file
    const localStoreDir = path.resolve(process.cwd(), './storage/private', bucket);
    const fullPath = path.join(localStoreDir, path.basename(filePath));

    if (!fs.existsSync(fullPath)) {
      return new NextResponse('الملف المطلوب غير موجود', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = 
      ext === '.pdf' ? 'application/pdf' :
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
      'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(filePath))}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    return new NextResponse('فشل معالجة طلب التحميل', { status: 500 });
  }
}
