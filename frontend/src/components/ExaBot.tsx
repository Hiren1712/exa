interface ExaBotProps {
  size?: number;
  className?: string;
}

export function ExaBot({ size = 32, className }: ExaBotProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      shapeRendering="crispEdges"
      focusable="false"
    >
      <path d="M13 1h6v2h2v5h5v3h3v14h-3v3H6v-3H3V11h3V8h5V3h2z" fill="#09152F" />
      <path d="M15 3h2v5h-2z" fill="#48D7F2" />
      <path d="M14 0h4v3h-4z" fill="#F5B84B" />
      <path d="M2 13h3v8H2zm25 0h3v8h-3z" fill="#48D7F2" />
      <path d="M8 10h16v13H8zM10 23h12v2H10z" fill="#B8F4FF" />
      <path d="M11 14h3v4h-3zm7 0h3v4h-3z" fill="#1260A5" />
      <path d="M14 20h4v2h-4z" fill="#1260A5" />
      <path d="M8 8h3v2H8zm13 0h3v2h-3z" fill="#48D7F2" />
      <path d="M7 25h3v2H7zm15 0h3v2h-3z" fill="#526DFF" />
      <path d="M9 19h2v2H9zm12 0h2v2h-2z" fill="#F5B84B" />
    </svg>
  );
}
