export default function PolicyPage({ title, subtitle, intro, sections, contact }) {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '48px 20px 80px', lineHeight: 1.75, color: 'var(--ink-900)' }}>
      <div style={{ maxWidth: 860 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--mint-500)', marginBottom: 12 }}>
          {subtitle}
        </div>
        <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.05 }}>{title}</h1>
        {intro && <p style={{ margin: '0 0 30px', fontSize: 16, color: 'var(--ink-600)', maxWidth: 820 }}>{intro}</p>}
        <div style={{ display: 'grid', gap: 18 }}>
          {sections.map(section => (
            <section key={section.title} style={{ padding: '22px 22px 20px', border: '1px solid var(--hairline)', borderRadius: 14, background: 'var(--paper)' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.25 }}>{section.title}</h2>
              {section.paragraphs?.map(paragraph => (
                <p key={paragraph} style={{ margin: '0 0 12px', color: 'var(--ink-700)' }}>{paragraph}</p>
              ))}
              {section.items?.length ? (
                <ul style={{ margin: '12px 0 0', paddingLeft: 20, color: 'var(--ink-700)' }}>
                  {section.items.map(item => <li key={item} style={{ marginBottom: 8 }}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        {contact && (
          <section style={{ marginTop: 24, padding: '22px', border: '1px solid var(--hairline)', borderRadius: 14, background: 'var(--paper-tint)' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Contact</h2>
            {contact.paragraphs?.map(paragraph => (
              <p key={paragraph} style={{ margin: '0 0 10px', color: 'var(--ink-700)' }}>{paragraph}</p>
            ))}
            {contact.items?.length ? (
              <ul style={{ margin: '12px 0 0', paddingLeft: 20, color: 'var(--ink-700)' }}>
                {contact.items.map(item => <li key={item} style={{ marginBottom: 8 }}>{item}</li>)}
              </ul>
            ) : null}
          </section>
        )}
      </div>
    </main>
  )
}
