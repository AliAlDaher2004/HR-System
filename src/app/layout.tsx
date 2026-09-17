import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'نظام إدارة الموارد البشرية والرواتب',
  description: 'منظومة متكاملة لإدارة شؤون الموظفين، الحضور، الإجازات، السلف، ومسيرات الرواتب',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var observer = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                        m.target.removeAttribute('bis_skin_checked');
                      }
                    }
                  });
                  observer.observe(document.documentElement, {
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['bis_skin_checked']
                  });
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased font-sans min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

