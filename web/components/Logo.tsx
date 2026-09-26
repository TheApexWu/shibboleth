// The mark: Proto-Sinaitic ʾalp — the ox head that became Alef (and, rotated, our "A").
// Stroke-drawn like an incised glyph: a tapering head with two horns sweeping up and out.
export const ALEF_PATHS = {
  head: "M20 23 Q32 19 44 23 L38.5 49 Q32 56 25.5 49 Z",
  hornL: "M21 23.5 C13 21 8.5 15 10.5 6.5",
  hornR: "M43 23.5 C51 21 55.5 15 53.5 6.5",
};

export default function Logo({ size = 30, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Shibboleth — ancient Alef, the ox head" role="img">
      <g fill="none" stroke={color} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round">
        <path d={ALEF_PATHS.hornL} />
        <path d={ALEF_PATHS.hornR} />
        <path d={ALEF_PATHS.head} />
      </g>
      <circle cx={27.5} cy={32} r={2.1} fill={color} />
      <circle cx={36.5} cy={32} r={2.1} fill={color} />
    </svg>
  );
}
