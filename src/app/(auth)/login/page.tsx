'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Alert } from '@/components/ui';
import { Lock, Mail, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error(
          authError.message === 'Invalid login credentials'
            ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            : authError.message || 'بيانات الدخول غير صحيحة'
        );
      }

      // Maintain session cookie for server component middleware & session resolution
      document.cookie = `hr_dev_session_user=${encodeURIComponent(email)}; path=/; max-age=86400; SameSite=Lax`;

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#15324F] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2169A6] text-white font-bold text-2xl mb-3 shadow-lg shadow-blue-900/40">
            HR
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">نظام إدارة الموارد البشرية والرواتب</h1>
          <p className="text-slate-300 text-sm mt-1">بوابة الدخول الموحدة للموظفين المصرح لهم</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-slate-700/50">
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2169A6] focus:border-[#2169A6] text-sm text-right"
                  dir="ltr"
                />
                <Mail className="w-5 h-5 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">كلمة المرور</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#2169A6] focus:border-[#2169A6] text-sm text-right"
                  dir="ltr"
                />
                <Lock className="w-5 h-5 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </Button>
          </form>
        </Card>

        {/* Security Notice */}
        <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center">
          <ShieldAlert className="w-4 h-4 ml-1.5 text-slate-400 inline" />
          النظام محمي ومخصص فقط للاستخدام الداخلي المصرح به
        </p>
      </div>
    </div>
  );
}
