'use client';

import { useState } from 'react';

export default function SearchClient() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  async function runSearch(p = 1) {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&page=${p}`);
      const data = await res.json();
      setResult(data);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Dclog kereső</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(1)}
          placeholder="Discord ID, Steam ID, License, CitizenID vagy karakternév..."
          style={{ flex: 1, padding: 10, fontSize: 16 }}
        />
        <button onClick={() => runSearch(1)} disabled={loading} style={{ padding: '10px 20px' }}>
          {loading ? 'Keresés...' : 'Keresés'}
        </button>
      </div>

      {result?.error && <p style={{ color: '#f04747' }}>{result.error}</p>}

      {result && !result.error && (
        <>
          <section style={{ marginTop: 24, padding: 16, background: '#1a1d23', borderRadius: 8 }}>
            <h3>Ismert azonosítók ({result.identitySet.length})</h3>
            <ul>
              {result.identitySet.map((i) => (
                <li key={i.value}>
                  <code>{i.value}</code> {i.types.length ? `— ${i.types.join(', ')}` : ''}
                </li>
              ))}
            </ul>
            <p>
              <strong>{result.total}</strong> log bejegyzés találva.
            </p>
          </section>

          <section style={{ marginTop: 24 }}>
            {result.entries.map((entry) => (
              <article key={entry.id} style={{ border: '1px solid #2f333d', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9aa0aa' }}>
                  <span>{entry.channel?.name || `#${entry.channelId}`}</span>
                  <span>{new Date(entry.timestamp).toLocaleString('hu-HU')}</span>
                </header>
                {entry.title && <h4 style={{ margin: '8px 0' }}>{entry.title}</h4>}
                {entry.description && <p>{entry.description}</p>}
                {entry.fields?.length > 0 && (
                  <dl style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 4, fontSize: 14 }}>
                    {entry.fields.map((f) => (
                      <div key={f.id} style={{ display: 'contents' }}>
                        <dt style={{ fontWeight: 600 }}>{f.name}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </article>
            ))}
          </section>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <button disabled={page <= 1} onClick={() => runSearch(page - 1)}>
              ◀ Előző
            </button>
            <span>
              Oldal {result.page}/{result.pageCount}
            </span>
            <button disabled={page >= result.pageCount} onClick={() => runSearch(page + 1)}>
              Következő ▶
            </button>
          </div>
        </>
      )}
    </main>
  );
}
