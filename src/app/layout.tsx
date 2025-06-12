import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import ClientProviders from '@/components/client-providers';
import { AuthProvider } from '@/contexts/auth-context';

export const metadata: Metadata = {
  title: 'KharchGini',
  description: 'Next-generation personal expense tracker by Firebase Studio, now KharchGini!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ClientProviders>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
