// Eigen illustraties, getekend in SVG zodat ze scherp blijven en mee bewegen.

export function PiggyIllustration({ width = 180 }) {
  return (
    <svg className="illu" width={width} viewBox="0 0 200 150" role="img" aria-label="Spaarvarken met muntjes">
      <ellipse cx="100" cy="136" rx="62" ry="7" fill="#16202A" opacity="0.07" />
      <g className="float2">
        <circle cx="150" cy="30" r="13" fill="#F2B63C" />
        <circle cx="150" cy="30" r="8.5" fill="none" stroke="#C98A12" strokeWidth="2.5" />
      </g>
      <g className="float">
        <circle cx="48" cy="40" r="10" fill="#F2B63C" />
        <circle cx="48" cy="40" r="6" fill="none" stroke="#C98A12" strokeWidth="2" />
      </g>
      <g>
        <ellipse cx="100" cy="88" rx="56" ry="42" fill="#F5A3B5" />
        <ellipse cx="88" cy="74" rx="26" ry="14" fill="#FBC8D3" opacity="0.8" />
        <path d="M68 52l-6-20 22 12z" fill="#E7849A" />
        <rect x="70" y="118" width="14" height="16" rx="6" fill="#E7849A" />
        <rect x="114" y="118" width="14" height="16" rx="6" fill="#E7849A" />
        <ellipse cx="152" cy="90" rx="13" ry="15" fill="#E7849A" />
        <circle cx="148" cy="88" r="2.6" fill="#9C3B53" />
        <circle cx="156" cy="88" r="2.6" fill="#9C3B53" />
        <circle cx="128" cy="72" r="4.5" fill="#16202A" />
        <circle cx="129.5" cy="70.5" r="1.4" fill="#fff" />
        <rect x="88" y="45" width="26" height="6" rx="3" fill="#9C3B53" />
        <path d="M45 86c-10-2-14 6-8 10s6-6-2-8" fill="none" stroke="#E7849A" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className="spin" style={{ transformOrigin: '101px 22px' }}>
        <circle cx="101" cy="22" r="11" fill="#F2B63C" />
        <text x="101" y="27" textAnchor="middle" fontSize="13" fontWeight="800" fill="#8A5D00">€</text>
      </g>
    </svg>
  );
}

export function HomeIllustration({ width = 240 }) {
  return (
    <svg className="illu" width={width} viewBox="0 0 260 170" role="img" aria-label="Huisje met een gezin en muntjes">
      <circle cx="200" cy="40" r="22" fill="#F7B27A" opacity="0.9" />
      <ellipse cx="130" cy="158" rx="110" ry="8" fill="#16202A" opacity="0.07" />
      <path d="M60 80l70-52 70 52v74H60z" fill="#FFFFFF" stroke="#16202A" strokeWidth="3" strokeLinejoin="round" />
      <path d="M48 88l82-62 82 62" fill="none" stroke="#0B7A5E" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="115" y="110" width="30" height="44" rx="4" fill="#0B7A5E" />
      <circle cx="139" cy="133" r="2.5" fill="#F2B63C" />
      <rect x="76" y="98" width="26" height="22" rx="4" fill="#DDF1F6" stroke="#16202A" strokeWidth="2.5" />
      <rect x="158" y="98" width="26" height="22" rx="4" fill="#DDF1F6" stroke="#16202A" strokeWidth="2.5" />
      <g className="float">
        <circle cx="34" cy="60" r="12" fill="#F2B63C" />
        <text x="34" y="65" textAnchor="middle" fontSize="13" fontWeight="800" fill="#8A5D00">€</text>
      </g>
      <g className="float2">
        <circle cx="232" cy="96" r="10" fill="#F2B63C" />
        <text x="232" y="100.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#8A5D00">€</text>
      </g>
      <g>
        <circle cx="36" cy="120" r="9" fill="#2856A6" />
        <rect x="26" y="130" width="20" height="26" rx="9" fill="#2856A6" />
        <circle cx="224" cy="124" r="8" fill="#C24E14" />
        <rect x="215" y="133" width="18" height="23" rx="8" fill="#C24E14" />
        <circle cx="206" cy="136" r="6" fill="#B32C68" />
        <rect x="199" y="143" width="14" height="13" rx="6" fill="#B32C68" />
      </g>
    </svg>
  );
}

export function CoinStack() {
  return (
    <svg className="coins" width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
      <g className="c1">
        <ellipse cx="40" cy="40" rx="18" ry="7" fill="#F2B63C" />
        <rect x="22" y="30" width="36" height="10" fill="#F2B63C" />
        <ellipse cx="40" cy="30" rx="18" ry="7" fill="#F8CF6A" />
        <rect x="22" y="20" width="36" height="10" fill="#F2B63C" />
        <ellipse cx="40" cy="20" rx="18" ry="7" fill="#FBDD8E" />
      </g>
      <g className="c2">
        <circle cx="14" cy="18" r="10" fill="#FBDD8E" />
        <text x="14" y="22.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#8A5D00">€</text>
      </g>
    </svg>
  );
}
