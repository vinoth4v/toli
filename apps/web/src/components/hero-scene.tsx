/**
 * The hero illustration: a tempo traveller climbing the ghat road out of
 * Madurai towards Kodaikanal, in the flat editorial style mobility brands use
 * — except drawn by hand as SVG, so it weighs a few kilobytes, animates in
 * pure CSS, and can never be mistaken for a stock asset another company also
 * bought.
 *
 * The scene is the business: temple town below, hills above, one vehicle on
 * the road between them, and the destination marked with the same pin the
 * logo uses. Clouds drift, wheels turn, the centre line moves, the pin
 * breathes. `prefers-reduced-motion` stills all of it via the global rule.
 *
 * The palette is internal to the artwork — like a photograph's would be — and
 * deliberately not the UI's tokens: the interface stays monochrome so the one
 * colourful thing on the page is the world the product operates in.
 */

export function HeroScene() {
  return (
    <svg
      className="scene"
      viewBox="0 0 720 560"
      role="img"
      aria-label="A tempo traveller on the winding ghat road from Madurai's temple town up to Kodaikanal"
    >
      {/* Sky */}
      <rect width="720" height="560" fill="#e9f1fb" />
      <circle cx="612" cy="74" r="26" fill="#f6b73c" />

      {/* A plane, for the airport transfers */}
      <g className="plane">
        <path d="M0 0 L26 6 L0 12 L6 6 Z" fill="#c9d9ec" transform="translate(80 60)" />
      </g>

      {/* Clouds */}
      <g className="cloud cloud-a" fill="#ffffff">
        <ellipse cx="150" cy="92" rx="42" ry="14" />
        <ellipse cx="182" cy="84" rx="26" ry="11" />
      </g>
      <g className="cloud cloud-b" fill="#ffffff">
        <ellipse cx="430" cy="120" rx="50" ry="15" />
        <ellipse cx="468" cy="110" rx="28" ry="12" />
      </g>

      {/* Hill ranges */}
      <path
        d="M0 322 C120 262 260 302 360 252 C470 202 600 242 720 192 L720 560 L0 560 Z"
        fill="#bcd9c9"
      />
      <path
        d="M0 424 C150 362 300 422 460 342 C560 302 660 332 720 302 L720 560 L0 560 Z"
        fill="#35836a"
      />
      <path d="M0 522 C200 482 500 522 720 472 L720 560 L0 560 Z" fill="#2a6b57" />

      {/* The ghat road, and its moving centre line */}
      <path
        className="road"
        d="M60 532 C260 512 310 432 185 388 C70 348 205 268 385 254 C560 240 606 196 648 152"
        fill="none"
        stroke="#33333b"
        strokeWidth="44"
        strokeLinecap="round"
      />
      <path
        className="road-dash"
        d="M60 532 C260 512 310 432 185 388 C70 348 205 268 385 254 C560 240 606 196 648 152"
        fill="none"
        stroke="#f5f5f5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="18 26"
      />

      {/* Destination: the same pin as the logo */}
      <g className="pin">
        <circle cx="648" cy="130" r="15" fill="#0b0b0b" />
        <path d="M648 158 L639 138 L657 138 Z" fill="#0b0b0b" />
        <circle cx="648" cy="130" r="5.5" fill="#ffffff" />
      </g>

      {/* The tempo traveller. Placement on the outer group, animation on the
          inner one — a CSS transform overrides the placement attribute, and a
          bus bobbing at the SVG origin is a bug you only see once. */}
      <g transform="translate(238 470) rotate(-7)">
        <g className="bus">
          <rect x="-62" y="-30" width="124" height="48" rx="10" fill="#ffffff" />
          <rect x="-62" y="-6" width="124" height="9" fill="#f26a21" />
          <rect x="-50" y="-22" width="20" height="14" rx="3" fill="#bcd7ee" />
          <rect x="-24" y="-22" width="20" height="14" rx="3" fill="#bcd7ee" />
          <rect x="2" y="-22" width="20" height="14" rx="3" fill="#bcd7ee" />
          <rect x="30" y="-22" width="26" height="14" rx="3" fill="#9fc4e4" />
          <rect x="-58" y="-36" width="116" height="8" rx="4" fill="#e3e3e3" />
          <g className="wheel">
            <circle cx="-34" cy="20" r="11" fill="#1d1d21" />
            <circle cx="-34" cy="20" r="4" fill="#9a9aa2" />
          </g>
          <g className="wheel">
            <circle cx="36" cy="20" r="11" fill="#1d1d21" />
            <circle cx="36" cy="20" r="4" fill="#9a9aa2" />
          </g>
        </g>
      </g>

      {/* Madurai below: a gopuram */}
      <g>
        <rect x="28" y="470" width="114" height="90" fill="#e8ddc8" />
        <polygon points="38,470 132,470 122,428 48,428" fill="#f26a21" />
        <polygon points="48,428 122,428 114,394 56,394" fill="#f6b73c" />
        <polygon points="56,394 114,394 108,364 62,364" fill="#35836a" />
        <polygon points="62,364 108,364 100,340 70,340" fill="#e8ddc8" />
        <ellipse cx="85" cy="334" rx="15" ry="8" fill="#f6b73c" />
        <rect x="70" y="500" width="30" height="60" rx="4" fill="#8a5a30" />
      </g>

      {/* A palm, because this is the south */}
      <g>
        <path
          d="M652 556 C658 508 650 486 664 446"
          stroke="#7a5230"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M664 446 C696 428 722 436 730 458 C704 450 682 448 664 446" fill="#2f7d5c" />
        <path d="M664 446 C640 424 616 428 604 448 C628 442 648 442 664 446" fill="#2f7d5c" />
        <path d="M664 446 C676 418 700 410 718 420 C696 424 678 434 664 446" fill="#3b9770" />
        <path d="M664 446 C654 418 632 408 612 414 C634 422 652 432 664 446" fill="#3b9770" />
      </g>
    </svg>
  )
}
