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

export function BasketIllustration({ width = 170 }) {
  return (
    <svg className="illu" width={width} viewBox="0 0 200 150" role="img" aria-label="Boodschappenmand">
      <ellipse cx="100" cy="138" rx="64" ry="7" fill="#16202A" opacity="0.07" />
      <g className="float">
        <rect x="58" y="34" width="22" height="40" rx="6" fill="#FFFFFF" stroke="#5B9BD5" strokeWidth="3" />
        <rect x="58" y="34" width="22" height="12" rx="5" fill="#5B9BD5" />
      </g>
      <g className="float2">
        <path d="M104 56c0-14 10-22 20-22s20 8 20 22z" fill="#F2B63C" />
        <path d="M114 44c3-4 7-5 10-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
      </g>
      <g className="spin" style={{ transformOrigin: '92px 52px' }}>
        <circle cx="92" cy="52" r="11" fill="#E5533D" />
        <path d="M92 41c1-5 4-7 7-7" stroke="#0B7A5E" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      <path d="M40 70h120l-12 58a8 8 0 0 1-8 6H60a8 8 0 0 1-8-6z" fill="#0B7A5E" />
      <path d="M40 70h120" stroke="#075A45" strokeWidth="6" strokeLinecap="round" />
      <path d="M70 84v36M90 84v36M110 84v36M130 84v36" stroke="#4FD1A5" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <path d="M62 70c0-26 16-40 38-40s38 14 38 40" fill="none" stroke="#075A45" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function PotIllustration({ width = 170 }) {
  return (
    <svg className="illu" width={width} viewBox="0 0 200 150" role="img" aria-label="Kookpot met stoom">
      <ellipse cx="100" cy="138" rx="66" ry="7" fill="#16202A" opacity="0.07" />
      <g className="float" opacity="0.6">
        <path d="M78 46c-8-8 8-14 0-24" stroke="#9AA6B2" strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
      <g className="float2" opacity="0.6">
        <path d="M100 42c-8-8 8-14 0-26" stroke="#9AA6B2" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M122 46c-8-8 8-14 0-24" stroke="#9AA6B2" strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
      <rect x="44" y="60" width="112" height="14" rx="7" fill="#9C3B53" />
      <rect x="90" y="50" width="20" height="12" rx="5" fill="#9C3B53" />
      <path d="M50 74h100v40a18 18 0 0 1-18 18H68a18 18 0 0 1-18-18z" fill="#E5533D" />
      <path d="M62 88h40" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      <rect x="28" y="82" width="22" height="9" rx="4.5" fill="#9C3B53" />
      <rect x="150" y="82" width="22" height="9" rx="4.5" fill="#9C3B53" />
    </svg>
  );
}

export function CalendarIllustration({ width = 160 }) {
  return (
    <svg className="illu" width={width} viewBox="0 0 200 150" role="img" aria-label="Kalender">
      <ellipse cx="100" cy="138" rx="60" ry="7" fill="#16202A" opacity="0.07" />
      <rect x="46" y="28" width="108" height="104" rx="14" fill="#fff" stroke="#E3E7EB" strokeWidth="3" />
      <path d="M46 42a14 14 0 0 1 14-14h80a14 14 0 0 1 14 14v12H46z" fill="#2856A6" />
      <rect x="70" y="18" width="8" height="22" rx="4" fill="#16202A" />
      <rect x="122" y="18" width="8" height="22" rx="4" fill="#16202A" />
      {[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) => (
        <rect key={c + '-' + r} x={60 + c * 22} y={66 + r * 20} width="14" height="12" rx="3" fill={c === 2 && r === 1 ? '#C24E14' : '#E6EDF8'} />
      )))}
      <g className="float2">
        <circle cx="150" cy="112" r="20" fill="#0B7A5E" />
        <path d="M141 112l6 6 12-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

export function ToolboxIllustration({ width = 170 }) {
  return (
    <svg className="illu" width={width} viewBox="0 0 200 150" role="img" aria-label="Gereedschapskist">
      <ellipse cx="100" cy="138" rx="66" ry="7" fill="#16202A" opacity="0.07" />
      <path d="M78 52V40a8 8 0 0 1 8-8h28a8 8 0 0 1 8 8v12" fill="none" stroke="#16202A" strokeWidth="7" strokeLinecap="round" />
      <rect x="36" y="52" width="128" height="78" rx="14" fill="#C24E14" />
      <rect x="36" y="52" width="128" height="26" rx="12" fill="#E06A2C" />
      <rect x="88" y="70" width="24" height="16" rx="4" fill="#FFE1CF" />
      <path d="M50 96h100" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.25" />
      <g className="float2">
        <circle cx="156" cy="44" r="20" fill="#0B7A5E" />
        <path d="M147 44l6 6 12-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}
