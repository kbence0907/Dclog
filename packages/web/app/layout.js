import './globals.css';

export const metadata = {
  title: 'Dclog',
  description: 'FiveM szerver log kereső',
};

export default function RootLayout({ children }) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
