export function NoProductsIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <circle cx="100" cy="100" r="80" fill="hsl(var(--muted))" />
      <path d="M70 80 L70 75 Q70 65 80 65 L120 65 Q130 65 130 75 L130 80" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M60 82 L140 82 L135 140 Q135 145 130 145 L70 145 Q65 145 65 140 Z" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="85" cy="100" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
      <circle cx="100" cy="100" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
      <circle cx="115" cy="100" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
      <circle cx="155" cy="55" r="3" fill="hsl(var(--primary))" opacity="0.35" />
      <circle cx="45" cy="150" r="2" fill="hsl(var(--primary))" opacity="0.25" />
      <path d="M150 70 L154 70 M152 68 L152 72" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

export function NoOrdersIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <circle cx="100" cy="100" r="80" fill="hsl(var(--muted))" />
      <rect x="70" y="55" width="60" height="100" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" />
      <path d="M70 75 L130 75" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.3" />
      <path d="M80 90 L120 90 M80 100 L115 100 M80 110 L120 110 M80 120 L110 120" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M70 155 L75 148 L80 155 L85 148 L90 155 L95 148 L100 155 L105 148 L110 155 L115 148 L120 155 L125 148 L130 155" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="50" cy="60" r="2.5" fill="hsl(var(--primary))" opacity="0.3" />
      <circle cx="155" cy="130" r="3" fill="hsl(var(--primary))" opacity="0.25" />
    </svg>
  );
}

export function NoCustomersIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <circle cx="100" cy="100" r="80" fill="hsl(var(--muted))" />
      <circle cx="100" cy="85" r="18" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" />
      <path d="M68 145 Q68 115 100 115 Q132 115 132 145 Z" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="70" cy="82" r="11" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2.5" opacity="0.55" />
      <circle cx="130" cy="82" r="11" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2.5" opacity="0.55" />
      <circle cx="155" cy="60" r="2.5" fill="hsl(var(--primary))" opacity="0.3" />
      <circle cx="45" cy="145" r="2" fill="hsl(var(--primary))" opacity="0.25" />
    </svg>
  );
}

export function NoDataIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <circle cx="100" cy="100" r="80" fill="hsl(var(--muted))" />
      <rect x="60" y="120" width="16" height="28" rx="2" fill="hsl(var(--primary))" opacity="0.3" />
      <rect x="82" y="105" width="16" height="43" rx="2" fill="hsl(var(--primary))" opacity="0.45" />
      <rect x="104" y="85" width="16" height="63" rx="2" fill="hsl(var(--primary))" opacity="0.6" />
      <rect x="126" y="95" width="16" height="53" rx="2" fill="hsl(var(--primary))" opacity="0.45" />
      <path d="M55 75 L75 70 L95 80 L115 65 L135 72 L155 62" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" opacity="0.5" />
      <circle cx="75" cy="70" r="3" fill="hsl(var(--primary))" opacity="0.7" />
      <circle cx="115" cy="65" r="3" fill="hsl(var(--primary))" opacity="0.7" />
      <circle cx="155" cy="62" r="3" fill="hsl(var(--primary))" opacity="0.7" />
    </svg>
  );
}

export function NoSearchResultsIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <circle cx="100" cy="100" r="80" fill="hsl(var(--muted))" />
      <circle cx="90" cy="90" r="28" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" />
      <path d="M112 112 L138 138" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" />
      <path d="M82 82 L98 98 M98 82 L82 98" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <circle cx="155" cy="55" r="2.5" fill="hsl(var(--primary))" opacity="0.3" />
      <circle cx="50" cy="155" r="2" fill="hsl(var(--primary))" opacity="0.25" />
    </svg>
  );
}