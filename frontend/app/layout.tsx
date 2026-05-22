import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'MediCore AI — Clinical Decision Support',
  description: 'AI-powered medical interpretation platform for ECG, X-Ray, CT, MRI and Lab results.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0f1a2e',
              border: '1px solid #1e3050',
              color: '#e8f4fd',
            },
          }}
        />
      </body>
    </html>
  );
}
