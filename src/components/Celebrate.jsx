import { useEffect, useMemo } from 'react';

// Kort feestje na het bewaren: een vinkje en wat muntjes die wegspringen.
export default function Celebrate({ text, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  const bits = useMemo(
    () => Array.from({ length: 16 }, (_, i) => {
      const a = (Math.PI * (0.1 + 0.8 * (i / 15))) ;
      const d = 90 + (i % 4) * 30;
      return { '--x': `${Math.cos(a) * d * (i % 2 ? 1 : -1)}px`, '--y': `${-Math.sin(a) * d - 40}px`, '--r': `${(i * 47) % 360}deg`, animationDelay: `${(i % 5) * 0.03}s` };
    }),
    []
  );
  return (
    <>
      <div className="burst" aria-hidden="true">{bits.map((s, i) => <i key={i} style={s} />)}</div>
      <div className="toast" role="status">
        <span className="tick">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        {text}
      </div>
    </>
  );
}
