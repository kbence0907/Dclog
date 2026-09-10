'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>Dclog bejelentkezés</h1>
      <button onClick={() => signIn('discord')} style={{ padding: '12px 24px', fontSize: 16 }}>
        Bejelentkezés Discorddal
      </button>
    </main>
  );
}
