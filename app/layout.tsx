import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth';
// Self-hosted fonts: builds never depend on fetching from Google Fonts.
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlyLast',
  description: 'Airline-approved last-minute seats for FlyLast subscribers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
