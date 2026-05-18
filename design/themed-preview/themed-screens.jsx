/* End-to-end themed screens — Midnight×Lime + Paper×Cobalt
   Palette-driven. 8 key screens of the flow, rendered one theme at a time
   via the Night/Light toggle in index.html. */

const FH = "'Plus Jakarta Sans', sans-serif";
const FB = "'Inter', sans-serif";
const FN = "'DM Sans', sans-serif";

const Photo = ({ hue = 24, label, w = '100%', h = '100%', radius = 0 }) => (
  <div style={{
    width: w, height: h, borderRadius: radius, overflow: 'hidden', position: 'relative',
    background: `linear-gradient(135deg, oklch(0.72 0.13 ${hue}) 0%, oklch(0.42 0.16 ${hue}) 100%)`,
  }}>
    <div style={{ position: 'absolute', inset: 0, opacity: .32,
      background: `repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,.1) 8px 16px)` }}/>
    {label && <span style={{ position: 'absolute', left: 8, bottom: 8,
      fontFamily: 'ui-monospace, monospace', fontSize: 8.5, color: 'rgba(255,255,255,.9)',
      letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>}
  </div>
);

const Tag = ({ children, color, fb = FB }) => (
  <span style={{ fontFamily: fb, fontSize: 9, fontWeight: 800,
    letterSpacing: '.16em', textTransform: 'uppercase', color }}>{children}</span>
);

const CTA = ({ p, children, sub }) => (
  <button style={{
    width: '100%', height: 54, border: 'none', borderRadius: 16,
    background: p.accent, color: p.accentInk,
    fontFamily: FB, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: `0 8px 22px ${p.accent}55, inset 0 1px 0 rgba(255,255,255,.18)`,
  }}>
    {children}
    {sub && <span style={{ opacity: .7, fontWeight: 600, fontSize: 12.5 }}>· {sub}</span>}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/>
    </svg>
  </button>
);

const Pill = ({ p, children, accent, style }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 11px', borderRadius: 9999,
    fontFamily: FB, fontSize: 11, fontWeight: 600,
    background: accent ? `${p.accent}1a` : p.surface2,
    color: accent ? p.accent : p.ink,
    border: `1px solid ${accent ? `${p.accent}40` : p.rule}`,
    ...style,
  }}>{children}</span>
);

const Header = ({ p, step, dark }) => (
  <div style={{ padding: '8px 22px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ width: 36, height: 36, borderRadius: 18, background: p.surface,
      border: `1px solid ${p.rule}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={p.ink} strokeWidth="2.4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
      </svg>
    </div>
    {step && (
      <div style={{ display: 'flex', gap: 6 }}>
        {step.map((w, i) => (
          <span key={i} style={{ width: w, height: 4, borderRadius: 2,
            background: i < step.activeIdx + 1 ? p.accent : p.rule }}/>
        ))}
      </div>
    )}
    <div style={{ width: 36, height: 36 }}/>
  </div>
);

/* ============ 01 Welcome ============ */
window.T_Welcome = function T_Welcome({ p }) {
  return (
    <div style={{ width: '100%', height: '100%', background: p.bg, color: p.ink,
      fontFamily: FB, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '0 26px 110px' }}>
      <Photo hue={24} label="hero · BOM" />
      <div style={{ position: 'absolute', inset: 0, top: 0, height: '65%',
        background: `linear-gradient(180deg, rgba(0,0,0,.1) 0%, ${p.bg} 100%)` }}/>
      <div style={{ position: 'absolute', top: '40%', left: '-15%',
        fontFamily: FH, fontWeight: 800, fontSize: 200,
        color: 'transparent', WebkitTextStroke: `1px ${p.accent}30`,
        letterSpacing: '-0.04em', lineHeight: 1, pointerEvents: 'none' }}>MUMBAI</div>

      <div style={{ position: 'absolute', top: 70, left: 26,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, background: p.accent, borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill={p.accentInk}>
            <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
          </svg>
        </div>
        <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 14, color: 'white' }}>
          Mumbai Buddies
        </span>
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 11px', borderRadius: 9999, marginBottom: 22,
          background: `${p.good}22`, color: p.good,
          fontFamily: FN, fontSize: 10, fontWeight: 700,
          letterSpacing: '.12em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: p.good }}/>
          42 guides ready · BOM
        </div>
        <h1 style={{ fontFamily: FH, fontWeight: 800, fontSize: 50, lineHeight: .95,
          letterSpacing: '-0.04em', marginBottom: 14, color: p.ink }}>
          Your<br/>
          <em style={{ fontStyle: 'italic', color: p.accent }}>layover,</em><br/>
          <span style={{ color: 'transparent', WebkitTextStroke: `1.5px ${p.ink40}` }}>rewritten.</span>
        </h1>
        <p style={{ fontSize: 13.5, color: p.ink60, lineHeight: 1.55,
          maxWidth: 280, marginBottom: 22 }}>
          Skip the airport hotel. Spend transit hours with a verified Mumbai student guide.
        </p>
        <CTA p={p}>Start your story</CTA>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12.5 }}>
          <span style={{ color: p.ink40 }}>Have an account? </span>
          <span style={{ color: p.accent, fontWeight: 700 }}>Sign in</span>
        </div>
      </div>
    </div>
  );
};

/* ============ 02 Setup ============ */
window.T_Setup = function T_Setup({ p }) {
  const interests = [
    { l: 'Street Food', em: '🍜', on: true },
    { l: 'History', em: '🏛️', on: true },
    { l: 'Bollywood', em: '🎬' },
    { l: 'Markets', em: '🛍️', on: true },
    { l: 'Photography', em: '📸' },
    { l: 'Nature', em: '🌿' },
    { l: 'Art', em: '🎨' },
    { l: 'Nightlife', em: '🌙' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: p.bg, color: p.ink,
      fontFamily: FB, paddingTop: 60 }}>
      <div style={{ padding: '8px 22px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: p.surface,
          border: `1px solid ${p.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={p.ink} strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 28, height: 4, borderRadius: 2, background: p.accent }}/>
          <span style={{ width: 16, height: 4, borderRadius: 2, background: p.rule }}/>
          <span style={{ width: 16, height: 4, borderRadius: 2, background: p.rule }}/>
        </div>
        <span style={{ fontFamily: FN, fontSize: 11, color: p.ink40, fontWeight: 700 }}>1 / 3</span>
      </div>
      <div style={{ padding: '0 22px 100px' }}>
        <Tag color={p.accent}>Step 01 · Your Layover</Tag>
        <h1 style={{ fontFamily: FH, fontSize: 32, fontWeight: 800,
          letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 8, marginBottom: 24 }}>
          When does your<br/>
          plane <em style={{ color: p.accent, fontStyle: 'italic' }}>land?</em>
        </h1>

        <div style={{ background: p.surface, borderRadius: 18, padding: 18,
          border: `1px solid ${p.rule}`, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14 }}>
            <Tag color={p.ink40}>Flight</Tag>
            <Pill p={p} accent>verified</Pill>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 22,
              letterSpacing: '-0.02em', color: p.ink }}>BA 199</span>
            <span style={{ fontSize: 12, color: p.ink40 }}>British Airways</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontFamily: FN, fontSize: 26, fontWeight: 700, lineHeight: 1,
                letterSpacing: '-0.02em', color: p.ink }}>LHR</div>
              <div style={{ fontSize: 11, color: p.ink40, marginTop: 3 }}>13:25 · Mar 14</div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, borderTop: `1.5px dashed ${p.rule}` }}/>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={p.accent} style={{ margin: '0 5px' }}>
                <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
              </svg>
              <div style={{ flex: 1, borderTop: `1.5px dashed ${p.rule}` }}/>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: FN, fontSize: 26, fontWeight: 700, lineHeight: 1,
                letterSpacing: '-0.02em', color: p.accent }}>BOM</div>
              <div style={{ fontSize: 11, color: p.ink40, marginTop: 3 }}>03:50 · Mar 15</div>
            </div>
          </div>
        </div>

        <div style={{ background: p.surface, borderRadius: 18, padding: '16px 18px',
          border: `1px solid ${p.rule}`, marginBottom: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Tag color={p.ink40}>Hours in Mumbai</Tag>
            <div style={{ fontFamily: FH, fontSize: 26, fontWeight: 800,
              letterSpacing: '-0.02em', marginTop: 2, color: p.ink }}>
              <span style={{ color: p.accent }}>6h</span> 30m
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['−', '+'].map(s => (
              <button key={s} style={{ width: 36, height: 36, borderRadius: 10,
                background: p.surface2, border: 'none', fontSize: 17, fontWeight: 700,
                color: p.ink }}>{s}</button>
            ))}
          </div>
        </div>

        <Tag color={p.ink40}>What sparks your interest?</Tag>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12, marginBottom: 24 }}>
          {interests.map(i => (
            <span key={i.l} style={{
              padding: '8px 13px', borderRadius: 9999,
              background: i.on ? p.ink : p.surface,
              color: i.on ? p.bg : p.ink,
              fontFamily: FB, fontSize: 12.5, fontWeight: 600,
              border: i.on ? 'none' : `1px solid ${p.rule}`,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <span>{i.em}</span>{i.l}
            </span>
          ))}
        </div>
        <CTA p={p}>Find my buddy</CTA>
      </div>
    </div>
  );
};

/* ============ 03 Results ============ */
window.T_Results = function T_Results({ p }) {
  const guides = [
    { n: 'Arjun Sharma', u: 'Univ. of Mumbai · Yr 3', tags: ['Food','History'], price: 2000, fit: 96, r: 4.95, t: 184, hue: 24, top: true },
    { n: 'Priya Nair', u: 'SNDT Women\'s', tags: ['Bollywood','Art'], price: 3000, fit: 91, r: 4.92, t: 96, hue: 320 },
    { n: 'Rahul Mehta', u: 'IIT Bombay · MTech', tags: ['Markets','Photo'], price: 2500, fit: 88, r: 4.86, t: 142, hue: 200 },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: p.bg, color: p.ink,
      fontFamily: FB, paddingTop: 60 }}>
      <div style={{ padding: '8px 22px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: p.surface,
          border: `1px solid ${p.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={p.ink} strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
          </svg>
        </div>
        <Pill p={p}>
          <span style={{ width:6, height:6, borderRadius:3, background:p.good }}/>
          BOM · 6h 30m · Mar 15
        </Pill>
        <div style={{ width: 36 }}/>
      </div>

      <div style={{ padding: '4px 22px 14px' }}>
        <Tag color={p.accent}>3 buddies match</Tag>
        <h1 style={{ fontFamily: FH, fontSize: 30, fontWeight: 800,
          letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 6 }}>
          Pick your<br/>
          <em style={{ color: p.accent, fontStyle: 'italic' }}>Mumbai buddy.</em>
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 7, padding: '4px 22px 16px', overflowX: 'auto' }}>
        {[{l:'Top fit',on:true},{l:'Lowest price'},{l:'Food'},{l:'Bollywood'},{l:'New'}].map(c => (
          <span key={c.l} style={{
            padding: '7px 13px', borderRadius: 9999,
            background: c.on ? p.ink : p.surface,
            color: c.on ? p.bg : p.ink,
            border: c.on ? 'none' : `1px solid ${p.rule}`,
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}>{c.l}</span>
        ))}
      </div>

      <div style={{ padding: '0 22px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {guides.map((g, i) => (
          <div key={i} style={{
            background: p.surface, borderRadius: 18, overflow: 'hidden',
            display: 'grid', gridTemplateColumns: '104px 1fr',
            border: `1px solid ${p.rule}`, position: 'relative',
          }}>
            <Photo hue={g.hue}/>
            {g.top && (
              <span style={{ position: 'absolute', top: 10, left: 10,
                padding: '3px 8px', borderRadius: 9999, background: p.accent,
                color: p.accentInk, fontFamily: FB, fontSize: 9, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '.1em' }}>★ Top fit</span>
            )}
            <div style={{ padding: '12px 14px', display: 'flex',
              flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 800,
                    letterSpacing: '-0.02em', color: p.ink }}>{g.n}</span>
                  <span style={{ fontFamily: FN, fontSize: 12, fontWeight: 700,
                    color: p.accent }}>{g.fit}%</span>
                </div>
                <div style={{ fontSize: 11, color: p.ink40, marginTop: 1 }}>{g.u}</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                  {g.tags.map(t => <Pill key={t} p={p} style={{ fontSize: 10 }}>{t}</Pill>)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <div style={{ fontSize: 11, color: p.ink60 }}>
                  <span style={{ color: p.accent2 }}>★</span> <span style={{ fontWeight: 700, color: p.ink }}>{g.r}</span>
                  <span style={{ color: p.ink40 }}> · {g.t}</span>
                </div>
                <span style={{ fontFamily: FN, fontSize: 15, fontWeight: 700,
                  letterSpacing: '-0.02em', color: p.ink }}>
                  ₹{g.price.toLocaleString()}<span style={{ fontSize: 10, color: p.ink40 }}>/day</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============ 04 Profile (Stories + Posts compact) ============ */
window.T_Profile = function T_Profile({ p }) {
  const stories = [
    { t: 'Bandra morning', d: '0:48', hue: 24 },
    { t: 'Vada pav 5 ways', d: '1:12', hue: 42, live: true },
    { t: 'Marine Drive', d: '0:32', hue: 200 },
    { t: 'Spice alley', d: '0:55', hue: 12 },
  ];
  const posts = [
    { kind: 'video', hue: 24, l: 'Sunset at Bandstand', date: '2d', span: 2, dur: '0:42' },
    { kind: 'photo', hue: 12, l: 'Biryani', date: '4d' },
    { kind: 'photo', hue: 42, l: 'Crawford', date: '5d' },
    { kind: 'video', hue: 200, l: 'Gateway', date: '1w', dur: '0:18' },
    { kind: 'photo', hue: 320, l: 'CST gold hour', date: '1w', span: 2 },
    { kind: 'photo', hue: 60, l: 'Strawberry', date: '2w' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: p.bg, color: p.ink,
      fontFamily: FB, position: 'relative', overflow: 'auto' }}>
      <div style={{ position: 'relative', height: 260, paddingTop: 60 }}>
        <Photo hue={24}/>
        <div style={{ position: 'absolute', inset: 0,
          background: `linear-gradient(180deg, rgba(0,0,0,.3) 0%, transparent 40%, transparent 60%, ${p.bg} 100%)` }}/>
        <div style={{ position: 'absolute', top: 60, left: 18, right: 18,
          display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ width: 36, height: 36, borderRadius: 18,
            background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
            </svg>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: -34, left: 22,
          width: 72, height: 72, borderRadius: 22,
          background: `linear-gradient(135deg, oklch(0.78 0.14 24), oklch(0.55 0.18 36))`,
          border: `4px solid ${p.bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FH, fontSize: 28, fontWeight: 800, color: 'white' }}>A</div>
      </div>

      <div style={{ padding: '46px 22px 4px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 9px', borderRadius: 9999, marginBottom: 6,
          background: `${p.accent}22`, color: p.accent,
          fontFamily: FB, fontSize: 9, fontWeight: 800,
          letterSpacing: '.12em', textTransform: 'uppercase' }}>
          ✓ verified · top rated
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: FH, fontSize: 24, fontWeight: 800,
            letterSpacing: '-0.025em', color: p.ink }}>Arjun Sharma</div>
          <div style={{ fontSize: 11, color: p.ink60 }}>Univ. of Mumbai</div>
        </div>
      </div>

      <div style={{ padding: '12px 22px 6px',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[{v:'4.95',l:'★'},{v:'184',l:'trips'},{v:'12k',l:'fans'},{v:'<4m',l:'reply'}].map((s,i) => (
          <div key={i} style={{ textAlign: 'center',
            borderRight: i < 3 ? `1px solid ${p.rule}` : 'none' }}>
            <div style={{ fontFamily: FN, fontSize: 16, fontWeight: 700,
              letterSpacing: '-0.02em', color: p.ink }}>{s.v}</div>
            <div style={{ fontSize: 9, color: p.ink40, fontWeight: 700,
              letterSpacing: '.1em', textTransform: 'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Stories rail */}
      <div style={{ padding: '14px 22px 4px',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Tag color={p.accent}>
          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 3,
            background: p.accent2, marginRight: 5, verticalAlign: 'middle' }}/>
          Stories · 14
        </Tag>
        <span style={{ fontSize: 10.5, color: p.ink40, fontWeight: 700 }}>See all</span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 22px', overflowX: 'auto' }}>
        {stories.map((s, i) => (
          <div key={i} style={{
            flexShrink: 0, width: 96, height: 138, borderRadius: 16,
            position: 'relative', overflow: 'hidden',
            border: s.live ? `2px solid ${p.accent}` : `1px solid ${p.rule}`,
            boxShadow: s.live ? `0 0 0 3px ${p.accent}33` : 'none',
          }}>
            <Photo hue={s.hue}/>
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.85) 100%)' }}/>
            <div style={{ position: 'absolute', top: 6, left: 6, width: 18, height: 18,
              borderRadius: 9, background: 'rgba(0,0,0,.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="7" height="7" viewBox="0 0 12 12" fill="white">
                <path d="M3 1.5v9l8-4.5z"/></svg>
            </div>
            <span style={{ position: 'absolute', top: 6, right: 6,
              padding: '1px 5px', borderRadius: 4, fontFamily: FN,
              fontSize: 8.5, fontWeight: 700, color: 'white',
              background: 'rgba(0,0,0,.5)' }}>{s.d}</span>
            {s.live && (
              <span style={{ position: 'absolute', top: 28, left: 6,
                padding: '1px 5px', borderRadius: 3, fontFamily: FB,
                fontSize: 7.5, fontWeight: 800, color: p.accentInk,
                background: p.accent, letterSpacing: '.1em',
                textTransform: 'uppercase' }}>NEW</span>
            )}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8,
              color: 'white' }}>
              <div style={{ fontFamily: FH, fontSize: 10.5, fontWeight: 800,
                lineHeight: 1.15 }}>{s.t}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Posts feed */}
      <div style={{ padding: '14px 22px 4px',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Tag color={p.accent2}>Posts · 47</Tag>
        <span style={{ fontSize: 10, color: p.good, fontWeight: 700 }}>
          <span style={{ display:'inline-block', width:5, height:5, borderRadius:3,
            background: p.good, marginRight: 4 }}/>
          Active · 2d ago
        </span>
      </div>
      <div style={{ padding: '6px 22px 100px', display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {posts.map((post, i) => (
          <div key={i} style={{
            gridColumn: post.span === 2 ? 'span 2' : 'span 1',
            aspectRatio: post.span === 2 ? '2.1 / 1.4' : '1 / 1.25',
            position: 'relative', borderRadius: 12, overflow: 'hidden',
          }}>
            <Photo hue={post.hue}/>
            <div style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,.78) 100%)' }}/>
            {post.kind === 'video' && (
              <div style={{ position: 'absolute', top: 6, left: 6,
                padding: '1px 6px', borderRadius: 5, fontFamily: FN,
                fontSize: 8.5, fontWeight: 700, color: 'white',
                background: 'rgba(0,0,0,.55)' }}>▶ {post.dur}</div>
            )}
            <span style={{ position: 'absolute', top: 6, right: 6,
              padding: '1px 5px', borderRadius: 4, fontFamily: FN,
              fontSize: 8.5, fontWeight: 700, color: 'white',
              background: 'rgba(0,0,0,.45)' }}>{post.date}</span>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7,
              color: 'white' }}>
              <div style={{ fontFamily: FH, fontSize: post.span === 2 ? 12 : 10,
                fontWeight: 800, lineHeight: 1.15 }}>{post.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '12px 22px 30px',
        background: `linear-gradient(180deg, transparent 0%, ${p.bg} 35%)`,
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontFamily: FN, fontSize: 20, fontWeight: 700,
            letterSpacing: '-0.02em', color: p.ink, lineHeight: 1 }}>₹2,000</div>
          <div style={{ fontSize: 9, color: p.ink40, fontWeight: 700,
            letterSpacing: '.08em', textTransform: 'uppercase' }}>per day · all-in</div>
        </div>
        <CTA p={p}>Plan with Arjun</CTA>
      </div>
    </div>
  );
};

/* ============ 05 Pay ============ */
window.T_Pay = function T_Pay({ p }) {
  return (
    <div style={{ width: '100%', height: '100%', background: p.bg, color: p.ink,
      fontFamily: FB, paddingTop: 60, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 22px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: p.surface,
          border: `1px solid ${p.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={p.ink} strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
          </svg>
        </div>
        <span style={{ fontFamily: FN, fontSize: 11, color: p.ink40, fontWeight: 700 }}>Step 3 / 3</span>
        <div style={{ width: 36 }}/>
      </div>

      <div style={{ padding: '0 22px', flex: 1 }}>
        <Tag color={p.accent}>Confirm</Tag>
        <h1 style={{ fontFamily: FH, fontSize: 28, fontWeight: 800,
          letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 6, marginBottom: 18 }}>
          One tap from<br/>
          <em style={{ color: p.accent, fontStyle: 'italic' }}>your story.</em>
        </h1>

        <div style={{ background: p.surface, borderRadius: 18, padding: 16,
          border: `1px solid ${p.rule}`, marginBottom: 10,
          display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden' }}>
            <Photo hue={24}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FH, fontSize: 15, fontWeight: 800,
              letterSpacing: '-0.02em', color: p.ink }}>Arjun Sharma</div>
            <div style={{ fontSize: 11, color: p.ink40 }}>Mar 15 · 15:30 → 20:45</div>
          </div>
          <span style={{ fontSize: 11, color: p.accent, fontWeight: 700 }}>Edit</span>
        </div>

        <div style={{ background: p.surface, borderRadius: 18, padding: 16,
          border: `1px solid ${p.rule}`, marginBottom: 10 }}>
          {[
            { l: 'Buddy fee · 5h 15m', v: '₹2,000' },
            { l: 'Travel & cabs', v: '₹650' },
            { l: 'Mumbai tax', v: '₹165' },
            { l: 'First-trip credit', v: '−₹250', acc: true },
          ].map((r, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '6px 0', fontSize: 13,
              color: r.acc ? p.accent : p.ink60, fontWeight: r.acc ? 700 : 500,
            }}>
              <span>{r.l}</span>
              <span style={{ fontFamily: FN }}>{r.v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: p.rule, margin: '8px 0' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: FH, fontSize: 15, fontWeight: 800, color: p.ink }}>Total</span>
            <span style={{ fontFamily: FN, fontSize: 24, fontWeight: 700,
              letterSpacing: '-0.02em', color: p.ink }}>₹2,565</span>
          </div>
        </div>

        <div style={{ background: p.surface, borderRadius: 18, padding: '12px 16px',
          border: `1px solid ${p.rule}`, marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 28, borderRadius: 5,
            background: `linear-gradient(135deg, ${p.ink}, ${p.ink60})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: p.bg, fontFamily: FN, fontSize: 8, fontWeight: 800,
            letterSpacing: '.06em' }}>VISA</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: p.ink }}>•••• 4242</div>
            <div style={{ fontSize: 10.5, color: p.ink40 }}>Default · Visa</div>
          </div>
          <span style={{ fontSize: 11, color: p.accent, fontWeight: 700 }}>Change</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 12,
          background: `${p.good}1a` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p.good} strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <span style={{ fontSize: 11.5, color: p.ink, fontWeight: 500 }}>
            Free cancel until 24h before pickup
          </span>
        </div>
      </div>

      <div style={{ padding: '14px 22px 26px' }}>
        <CTA p={p} sub="₹2,565">Pay & lock buddy</CTA>
      </div>
    </div>
  );
};

/* ============ 06 Confirmed ============ */
window.T_Confirmed = function T_Confirmed({ p }) {
  const isDark = p.chrome === 'dark';
  return (
    <div style={{ width: '100%', height: '100%',
      background: isDark ? p.bg : p.ink, color: isDark ? p.ink : p.bg,
      fontFamily: FB, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: '14%', left: '50%', transform: 'translateX(-50%)',
        width: 240, height: 240, borderRadius: '50%',
        background: `radial-gradient(circle, ${p.accent}55 0%, transparent 70%)` }}/>

      <div style={{ flex: 1, padding: '90px 26px 0', position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 36, background: p.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 0 8px ${p.accent}30, 0 12px 32px ${p.accent}55`, marginBottom: 22 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={p.accentInk} strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
          </svg>
        </div>
        <Tag color={p.accent}>Story locked</Tag>
        <h1 style={{ fontFamily: FH, fontSize: 36, fontWeight: 800,
          letterSpacing: '-0.03em', lineHeight: 1, marginTop: 8, marginBottom: 12 }}>
          You're set with<br/>
          <em style={{ color: p.accent, fontStyle: 'italic' }}>Arjun.</em>
        </h1>
        <p style={{ fontSize: 13, color: isDark ? p.ink60 : 'rgba(255,255,255,.55)',
          maxWidth: 280, lineHeight: 1.55, marginBottom: 26 }}>
          See you Mar 15, 15:30 at BOM T2, Gate 4. We'll text when he leaves.
        </p>

        <div style={{ width: '100%', maxWidth: 320,
          background: isDark ? p.surface : 'rgba(255,255,255,.06)',
          border: `1px solid ${isDark ? p.rule : 'rgba(255,255,255,.12)'}`,
          borderRadius: 18, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden' }}>
              <Photo hue={24}/>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontFamily: FH, fontSize: 13, fontWeight: 800,
                color: isDark ? p.ink : 'white' }}>Arjun Sharma</div>
              <div style={{ fontSize: 10.5, color: isDark ? p.ink40 : 'rgba(255,255,255,.5)' }}>
                Booking #MB-7204
              </div>
            </div>
            <span style={{ fontSize: 9, padding: '3px 7px', borderRadius: 9999,
              background: `${p.good}28`, color: p.good, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '.1em' }}>Confirmed</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { l: 'Pickup', v: '15:30 · Mar 15' },
              { l: 'Drop', v: '20:45' },
              { l: 'Where', v: 'BOM T2 · Gate 4' },
              { l: 'Paid', v: '₹2,565 · ••42' },
            ].map((d, i) => (
              <div key={i} style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 8.5, color: isDark ? p.ink40 : 'rgba(255,255,255,.4)',
                  textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700 }}>{d.l}</div>
                <div style={{ fontFamily: FN, fontSize: 12, fontWeight: 600,
                  color: isDark ? p.ink : 'white', marginTop: 2 }}>{d.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px 32px', position: 'relative', zIndex: 2 }}>
        <CTA p={p}>Open chat with Arjun</CTA>
        <button style={{
          width: '100%', height: 48, marginTop: 10, borderRadius: 14,
          border: `1.5px solid ${isDark ? p.rule : 'rgba(255,255,255,.18)'}`,
          background: 'transparent', color: isDark ? p.ink60 : 'rgba(255,255,255,.7)',
          fontFamily: FB, fontSize: 13.5, fontWeight: 600,
        }}>Add to calendar</button>
      </div>
    </div>
  );
};

/* ============ 07 Live trip ============ */
window.T_Live = function T_Live({ p }) {
  const stops = [
    { t: '15:30', n: 'BOM T2 Pickup', s: 'done' },
    { t: '16:00', n: 'Vada Pav · Ashok', s: 'done' },
    { t: '17:00', n: 'Crawford Market', s: 'live' },
    { t: '18:15', n: 'Gateway of India', s: 'next' },
    { t: '19:30', n: 'Marine Drive', s: 'up' },
    { t: '20:45', n: 'Drop · BOM T2', s: 'up' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: p.bg, color: p.ink,
      fontFamily: FB, paddingTop: 60, paddingBottom: 28 }}>
      <div style={{ padding: '8px 22px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 11px', borderRadius: 9999,
          background: `${p.good}1a`, color: p.good,
          fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: p.good,
            boxShadow: `0 0 0 4px ${p.good}30` }}/>
          Live · Stop 3 of 6
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 15, overflow: 'hidden' }}>
            <Photo hue={24}/>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: p.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={p.accentInk} strokeWidth="2.4">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"/>
            </svg>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 22px 16px' }}>
        <div style={{ borderRadius: 22, overflow: 'hidden', position: 'relative',
          border: `1px solid ${p.rule}` }}>
          <div style={{ height: 200 }}><Photo hue={42} label="crawford · spice alley"/></div>
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,.85) 100%)' }}/>
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ padding: '4px 10px', borderRadius: 9999,
              background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(10px)',
              color: 'white', fontSize: 10, fontWeight: 700,
              border: '1px solid rgba(255,255,255,.2)' }}>🛍️ Stop 03</span>
            <span style={{ fontFamily: FN, fontSize: 10.5, color: 'white',
              fontWeight: 700 }}>17:04 · 1h 11m left</span>
          </div>
          <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, color: 'white' }}>
            <h2 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800,
              letterSpacing: '-0.02em', lineHeight: 1.1 }}>Crawford Market</h2>
            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,.75)', marginTop: 4,
              textWrap: 'pretty' }}>
              Spice alley, then textiles. Arjun says: "Smell first, ask second, buy third."
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['+ 14 min', 'Skip', 'Tip'].map(l => (
            <button key={l} style={{ flex: 1, height: 40, borderRadius: 12,
              border: `1px solid ${p.rule}`, background: p.surface, color: p.ink,
              fontSize: 12, fontWeight: 600 }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '8px 22px' }}>
        <Tag color={p.ink40}>Today's loop</Tag>
        <div style={{ marginTop: 12 }}>
          {stops.map((s, i) => {
            const dotColor = s.s === 'done' ? p.ink40 : s.s === 'live' ? p.accent : p.rule;
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '46px 22px 1fr', gap: 0,
                alignItems: 'center', position: 'relative',
                paddingBottom: i < stops.length - 1 ? 14 : 0,
              }}>
                <span style={{ fontFamily: FN, fontSize: 10.5,
                  color: s.s === 'done' ? p.ink40 : p.ink60,
                  fontWeight: 700, textDecoration: s.s === 'done' ? 'line-through' : 'none' }}>{s.t}</span>
                <div style={{ position: 'relative', width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    width: s.s === 'live' ? 13 : 9, height: s.s === 'live' ? 13 : 9,
                    borderRadius: 7, background: dotColor,
                    border: s.s === 'live' ? `3px solid ${p.bg}` : 'none',
                    boxShadow: s.s === 'live' ? `0 0 0 4px ${p.accent}33` : 'none',
                  }}/>
                  {i < stops.length - 1 && (
                    <div style={{ position: 'absolute', left: 10, top: 17, height: 18,
                      borderLeft: `2px ${s.s === 'done' ? 'solid' : 'dashed'} ${p.rule}` }}/>
                  )}
                </div>
                <span style={{ fontFamily: FH, fontSize: 13.5,
                  fontWeight: s.s === 'live' ? 800 : 600,
                  color: s.s === 'done' ? p.ink40 : p.ink,
                  textDecoration: s.s === 'done' ? 'line-through' : 'none' }}>
                  {s.n}
                  {s.s === 'live' && <span style={{ color: p.accent, marginLeft: 8,
                    fontSize: 10.5, fontWeight: 700 }}>· now</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ============ 08 Recap ============ */
window.T_Recap = function T_Recap({ p }) {
  return (
    <div style={{ width: '100%', height: '100%', background: p.bg, color: p.ink,
      fontFamily: FB, paddingTop: 60 }}>
      <div style={{ padding: '8px 22px 18px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: p.surface,
          border: `1px solid ${p.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={p.ink} strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
          </svg>
        </div>
      </div>
      <div style={{ padding: '0 22px 28px' }}>
        <Tag color={p.accent}>Trip complete · Mar 15</Tag>
        <h1 style={{ fontFamily: FH, fontSize: 36, fontWeight: 800,
          letterSpacing: '-0.04em', lineHeight: .95, marginTop: 8 }}>
          What a<br/>
          <em style={{ color: p.accent, fontStyle: 'italic' }}>story.</em>
        </h1>

        <div style={{ marginTop: 22, display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { v: '5h 15m', l: 'Time spent' },
            { v: '6', l: 'Stops' },
            { v: '14.2 km', l: 'Walked' },
            { v: '38', l: 'Photos' },
          ].map((s, i) => (
            <div key={i} style={{ background: p.surface, borderRadius: 14, padding: 12,
              border: `1px solid ${p.rule}` }}>
              <div style={{ fontFamily: FN, fontSize: 22, fontWeight: 700,
                letterSpacing: '-0.02em', color: p.accent }}>{s.v}</div>
              <div style={{ fontSize: 10.5, color: p.ink40, fontWeight: 700,
                marginTop: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 5, marginTop: 12, overflowX: 'auto' }}>
          {[24, 42, 220, 140, 280, 60].map((h, i) => (
            <div key={i} style={{ width: 78, height: 100, borderRadius: 10,
              overflow: 'hidden', flexShrink: 0 }}>
              <Photo hue={h}/>
            </div>
          ))}
        </div>

        <div style={{ background: p.ink, color: p.bg, borderRadius: 18,
          padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}>
              <Photo hue={24}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FH, fontSize: 13.5, fontWeight: 800 }}>How was Arjun?</div>
              <div style={{ fontSize: 10.5, opacity: .55 }}>
                Your review helps every traveler after you
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ flex: 1, height: 40, borderRadius: 11,
                background: p.accent, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 20, fontWeight: 700,
                color: p.accentInk }}>★</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {['Storyteller', 'Hidden spots', 'Felt safe', 'Great photog.'].map(t => (
              <span key={t} style={{ padding: '6px 11px', borderRadius: 9999,
                background: `${p.accent}22`, border: `1px solid ${p.accent}40`,
                color: p.accent, fontSize: 11, fontWeight: 600 }}>+ {t}</span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, background: p.surface, borderRadius: 18,
          padding: 14, border: `1px solid ${p.rule}` }}>
          <Tag color={p.ink40}>Optional tip · 100% to Arjun</Tag>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {['₹100', '₹250', '₹500', 'Custom'].map((t, i) => (
              <button key={t} style={{ flex: 1, height: 40, borderRadius: 11,
                background: i === 1 ? p.accent : p.surface,
                color: i === 1 ? p.accentInk : p.ink,
                border: `1px solid ${i === 1 ? p.accent : p.rule}`,
                fontFamily: FN, fontSize: 12, fontWeight: 700 }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <CTA p={p}>Submit & share trip</CTA>
        </div>
      </div>
    </div>
  );
};
