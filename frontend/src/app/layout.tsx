import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './auth/context';

export const metadata: Metadata = {
  title: 'Voyr',
  description: 'Your Dream Trip, Designed by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
