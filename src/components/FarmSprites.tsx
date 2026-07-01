/* Pixel-art SVG sprites for the D2 farm scene. crispEdges = no smoothing. */

export function FenceTop() {
  return (
    <svg
      width="100%"
      height="22"
      viewBox="0 0 1280 22"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x="0" y="0" width="1280" height="6" fill="#8a6134" />
      <rect x="0" y="6" width="1280" height="2" fill="#5a3818" />
      <rect x="0" y="14" width="1280" height="6" fill="#8a6134" />
      <rect x="0" y="20" width="1280" height="2" fill="#5a3818" />
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={i} x={i * 80 + 20} y="0" width="6" height="22" fill="#7a5328" />
      ))}
    </svg>
  );
}

export function FenceBottom() {
  return (
    <svg
      width="100%"
      height="14"
      viewBox="0 0 1280 14"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x="0" y="0" width="1280" height="6" fill="#8a6134" />
      <rect x="0" y="6" width="1280" height="2" fill="#5a3818" />
      <rect x="0" y="8" width="1280" height="6" fill="#7a5328" />
    </svg>
  );
}

export function GrassTuft() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" shapeRendering="crispEdges" aria-hidden>
      <rect x="2" y="6" width="2" height="6" fill="#6a9548" />
      <rect x="4" y="4" width="2" height="8" fill="#8cb867" />
      <rect x="6" y="2" width="2" height="10" fill="#6a9548" />
      <rect x="8" y="4" width="2" height="8" fill="#8cb867" />
      <rect x="10" y="6" width="2" height="6" fill="#6a9548" />
      <rect x="12" y="3" width="2" height="9" fill="#8cb867" />
      <rect x="14" y="5" width="2" height="7" fill="#6a9548" />
      <rect x="16" y="7" width="2" height="5" fill="#8cb867" />
    </svg>
  );
}

export function Stone() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="4" width="12" height="8" fill="#9a8472" />
      <rect x="2" y="6" width="14" height="4" fill="#a89683" />
      <rect x="4" y="3" width="10" height="2" fill="#a89683" />
      <rect x="5" y="5" width="3" height="2" fill="#bfa896" />
      <rect x="3" y="11" width="12" height="2" fill="#7a6555" />
    </svg>
  );
}

export function Scarecrow() {
  return (
    <svg width="40" height="60" viewBox="-2 -2 44 64" shapeRendering="crispEdges" aria-hidden>
      {/* post */}
      <rect x="18" y="34" width="4" height="26" fill="#5a3818" />
      {/* crossbar (arms) */}
      <rect x="6" y="30" width="28" height="3" fill="#7a5328" />
      {/* head (straw) */}
      <rect x="12" y="6" width="16" height="14" fill="#e8c878" />
      <rect x="12" y="6" width="16" height="2" fill="#d6a858" />
      <rect x="12" y="18" width="16" height="2" fill="#a87838" />
      {/* hat */}
      <rect x="8" y="2" width="24" height="3" fill="#7a5328" />
      <rect x="14" y="-2" width="12" height="6" fill="#7a5328" />
      <rect x="14" y="2" width="12" height="2" fill="#a87838" />
      {/* face */}
      <rect x="16" y="11" width="2" height="2" fill="#3a2408" />
      <rect x="22" y="11" width="2" height="2" fill="#3a2408" />
      <rect x="16" y="15" width="8" height="1" fill="#3a2408" />
      {/* shirt */}
      <rect x="14" y="20" width="12" height="14" fill="#6a8aa8" />
      <rect x="14" y="20" width="12" height="2" fill="#8aaac8" />
      <rect x="14" y="32" width="12" height="2" fill="#4a6a88" />
      {/* straw out of sleeves */}
      <rect x="4" y="32" width="3" height="3" fill="#e8c878" />
      <rect x="33" y="32" width="3" height="3" fill="#e8c878" />
    </svg>
  );
}

export function Bush({ small = false }: { small?: boolean }) {
  const s = small ? 0.7 : 1;
  return (
    <svg
      width={50 * s}
      height={36 * s}
      viewBox="0 0 50 36"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <ellipse cx="25" cy="22" rx="22" ry="12" fill="#5a7b3a" />
      <ellipse cx="18" cy="18" rx="10" ry="8" fill="#6f9a4a" />
      <ellipse cx="32" cy="16" rx="10" ry="8" fill="#6f9a4a" />
      <ellipse cx="25" cy="14" rx="9" ry="7" fill="#7faa55" />
      <ellipse cx="20" cy="14" rx="3" ry="2" fill="#8fba65" />
      <ellipse cx="30" cy="18" rx="3" ry="2" fill="#8fba65" />
    </svg>
  );
}
