import './globals.css';

export const metadata = {
  title: 'Mai Soong - Exchange Tracker',
  description: 'MMK/THB Exchange Rate Tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
