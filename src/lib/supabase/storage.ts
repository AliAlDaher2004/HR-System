import { createAdminClient } from './admin';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const PRIVATE_BUCKETS = {
  DOCUMENTS: 'employee-documents',
  CONTRACTS: 'contracts',
  LEAVE: 'leave-attachments',
  PAYSLIPS: 'payslips',
} as const;

export type PrivateBucket = typeof PRIVATE_BUCKETS[keyof typeof PRIVATE_BUCKETS];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export async function uploadPrivateFile(
  bucket: PrivateBucket,
  fileRelativePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ success: boolean; path: string; error?: string }> {
  if (buffer.length > MAX_FILE_SIZE) {
    return { success: false, path: '', error: 'حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميغابايت).' };
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return { success: false, path: '', error: 'نوع الملف غير مدعوم. الأنواع المسموح بها هي PDF, PNG, JPG, DOCX.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasRealSupabase =
    supabaseUrl &&
    !supabaseUrl.includes('127.0.0.1') &&
    !supabaseUrl.includes('localhost') &&
    !supabaseUrl.includes('mock') &&
    !supabaseUrl.includes('dev-project');

  if (hasRealSupabase) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(bucket)
        .upload(fileRelativePath, buffer, {
          contentType,
          upsert: true,
        });

      if (!error && data?.path) {
        return { success: true, path: data.path };
      }
      console.warn('Supabase storage unavailable, falling back to local private storage:', error?.message);
    } catch (err: any) {
      console.warn('Supabase storage connection failed, falling back to local private storage:', err?.message);
    }
  }

  // Local private storage fallback for offline/development environments
  try {
    const localStoreDir = path.resolve(process.cwd(), './storage/private', bucket);
    fs.mkdirSync(localStoreDir, { recursive: true });
    const fullPath = path.join(localStoreDir, path.basename(fileRelativePath));
    fs.writeFileSync(fullPath, buffer);
    return { success: true, path: `${bucket}/${path.basename(fileRelativePath)}` };
  } catch (err: any) {
    return { success: false, path: '', error: err.message };
  }
}

export async function getSignedDownloadUrl(
  bucket: PrivateBucket,
  filePath: string,
  expiresInSeconds: number = 300 // 5 minutes expiration
): Promise<{ signedUrl: string | null; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasRealSupabase =
    supabaseUrl &&
    !supabaseUrl.includes('127.0.0.1') &&
    !supabaseUrl.includes('localhost') &&
    !supabaseUrl.includes('mock') &&
    !supabaseUrl.includes('dev-project');

  if (hasRealSupabase) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresInSeconds);

      if (!error && data?.signedUrl) {
        return { signedUrl: data.signedUrl };
      }
      console.warn('Supabase signed URL generation failed, falling back to local signed URL:', error?.message);
    } catch (err: any) {
      console.warn('Supabase signed URL exception, falling back to local signed URL:', err?.message);
    }
  }

  // Local secured token generation
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'local-secure-salt-2026';
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${bucket}:${filePath}:${expiresAt}`)
    .digest('hex');

  const token = Buffer.from(JSON.stringify({ bucket, filePath, expiresAt, signature })).toString('base64url');
  const signedUrl = `/api/storage/download?token=${token}`;

  return { signedUrl };
}
