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
 * deliberately not the UI's tokens: the interface stays navy-and-white so the
 * one colourful thing on the page is the world the product operates in.
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

      {/* The Western Ghats: two hazed ranges of actual peaks behind the
          green hills, because Kodaikanal sits on a mountain, not a mound. */}
      <path
        d="M0 260 L64 168 L128 232 L196 148 L262 222 L330 158 L398 224 L470 142 L544 214 L612 152 L676 208 L720 164 L720 560 L0 560 Z"
        fill="#c3d6e8"
      />
      <path
        d="M0 292 L86 210 L162 272 L242 196 L318 264 L402 194 L488 262 L566 202 L648 258 L720 208 L720 560 L0 560 Z"
        fill="#a7c3dc"
      />
      <ellipse cx="240" cy="252" rx="90" ry="10" fill="#ffffff" opacity="0.45" />
      <ellipse cx="540" cy="238" rx="80" ry="9" fill="#ffffff" opacity="0.4" />

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

      {/* Destination: the same pin as the logo, in the same navy */}
      <g className="pin">
        <circle cx="648" cy="130" r="15" fill="#122a52" />
        <path d="M648 158 L639 138 L657 138 Z" fill="#122a52" />
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

      {/* Madurai below: a proper Meenakshi-class gopuram — tall, tiered,
          striped with sculpture rows, crowned with a row of kalasam finials.
          The one thing on the page that should look unmistakably like home. */}
      <g>
        {/* Base wall and doorway */}
        <rect x="20" y="482" width="150" height="78" fill="#f0e7d4" />
        <rect x="20" y="474" width="150" height="10" fill="#c94f1d" />
        <path d="M78 560 L78 516 Q95 500 112 516 L112 560 Z" fill="#7a4a26" />
        {/* Six tiers, alternating sculpture rows */}
        <polygon points="30,474 160,474 150,440 40,440" fill="#f26a21" />
        <polygon points="40,440 150,440 141,408 49,408" fill="#f0e7d4" />
        <polygon points="49,408 141,408 133,378 57,378" fill="#f6b73c" />
        <polygon points="57,378 133,378 126,350 64,350" fill="#f0e7d4" />
        <polygon points="64,350 126,350 120,324 70,324" fill="#35836a" />
        <polygon points="70,324 120,324 115,300 75,300" fill="#f26a21" />
        {/* Niche dots — the sculpture rows, suggested not carved */}
        <g fill="#ffffff" opacity="0.85">
          {[52, 72, 92, 112, 132].map((x) => (
            <rect key={`n1-${x}`} x={x} y="452" width="6" height="12" rx="2" />
          ))}
          {[62, 80, 98, 116].map((x) => (
            <rect key={`n2-${x}`} x={x} y="386" width="5" height="11" rx="2" />
          ))}
          {[72, 88, 104].map((x) => (
            <rect key={`n3-${x}`} x={x} y="330" width="5" height="10" rx="2" />
          ))}
        </g>
        {/* Barrel roof and the kalasam row */}
        <ellipse cx="95" cy="296" rx="26" ry="11" fill="#f6b73c" />
        <g fill="#c94f1d">
          {[77, 86, 95, 104, 113].map((x) => (
            <circle key={`k-${x}`} cx={x} cy="284" r="3" />
          ))}
        </g>
        <g stroke="#c94f1d" strokeWidth="2" strokeLinecap="round">
          {[77, 86, 95, 104, 113].map((x) => (
            <line key={`s-${x}`} x1={x} y1="281" x2={x} y2="274" />
          ))}
        </g>
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

/**
 * The Pamban bridge at Rameswaram — the most recognisable road in Toli's
 * launch corridor, drawn as a wide banner. A bus crosses the whole span on a
 * slow loop, gulls drift the other way, the sea keeps moving underneath.
 */
export function PambanScene() {
  return (
    <svg
      className="scene scene-banner"
      viewBox="0 0 720 220"
      role="img"
      aria-label="A bus crossing the Pamban sea bridge to Rameswaram, gulls overhead"
    >
      {/* Sky and a low coastal sun */}
      <rect width="720" height="220" fill="#eaf4fb" />
      <circle cx="96" cy="52" r="20" fill="#f6b73c" />
      <g className="cloud cloud-a" fill="#ffffff">
        <ellipse cx="300" cy="42" rx="40" ry="12" />
        <ellipse cx="330" cy="35" rx="24" ry="10" />
      </g>

      {/* Gulls, drawn as the two strokes every child draws them with */}
      <g className="gull" stroke="#5b6b7d" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M470 60 q9 -9 18 0" />
        <path d="M488 60 q9 -9 18 0" />
      </g>
      <g
        className="gull gull-b"
        stroke="#5b6b7d"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M560 84 q7 -7 14 0" />
        <path d="M574 84 q7 -7 14 0" />
      </g>

      {/* The sea, with two drifting wave lines */}
      <rect y="150" width="720" height="70" fill="#8fc3dd" />
      <g
        className="wave"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      >
        <path d="M-40 176 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" />
      </g>
      <g
        className="wave wave-b"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      >
        <path d="M-60 198 q20 -7 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" />
      </g>

      {/* The bridge: deck, piers, and the truss posts between them */}
      <rect x="0" y="132" width="720" height="10" fill="#33333b" />
      <g fill="#4a4a54">
        {[40, 130, 220, 310, 400, 490, 580, 670].map((x) => (
          <rect key={x} x={x} y="142" width="12" height="70" />
        ))}
      </g>
      <g stroke="#4a4a54" strokeWidth="4" fill="none">
        <path d="M0 132 L720 132" />
        {[85, 175, 265, 355, 445, 535, 625].map((x) => (
          <path key={x} d={`M${x - 39} 132 L${x} 112 L${x + 39} 132`} />
        ))}
        <path d="M46 112 L674 112" strokeWidth="3" />
      </g>

      {/* The bus, crossing the whole span on a slow loop */}
      <g className="pamban-bus">
        <g transform="translate(0 118)">
          <rect x="-46" y="-22" width="92" height="34" rx="7" fill="#ffffff" />
          <rect x="-46" y="-5" width="92" height="7" fill="#f26a21" />
          <rect x="-38" y="-16" width="15" height="10" rx="2" fill="#bcd7ee" />
          <rect x="-19" y="-16" width="15" height="10" rx="2" fill="#bcd7ee" />
          <rect x="0" y="-16" width="15" height="10" rx="2" fill="#bcd7ee" />
          <rect x="21" y="-16" width="19" height="10" rx="2" fill="#9fc4e4" />
          <g className="wheel">
            <circle cx="-26" cy="13" r="8" fill="#1d1d21" />
            <circle cx="-26" cy="13" r="3" fill="#9a9aa2" />
          </g>
          <g className="wheel">
            <circle cx="27" cy="13" r="8" fill="#1d1d21" />
            <circle cx="27" cy="13" r="3" fill="#9a9aa2" />
          </g>
        </g>
      </g>

      {/* Rameswaram at the far shore — drawn after the bus, so each crossing
          ends with it disappearing into temple town rather than off an edge */}
      <g>
        <polygon points="640,220 648,146 720,134 720,220" fill="#e6d8b4" />
        <polygon points="664,140 716,140 710,112 670,112" fill="#f26a21" />
        <polygon points="670,112 710,112 705,90 675,90" fill="#f0e7d4" />
        <polygon points="675,90 705,90 701,72 679,72" fill="#f6b73c" />
        <ellipse cx="690" cy="70" rx="13" ry="6" fill="#c94f1d" />
        <g stroke="#c94f1d" strokeWidth="2" strokeLinecap="round">
          <line x1="683" y1="66" x2="683" y2="60" />
          <line x1="690" y1="66" x2="690" y2="58" />
          <line x1="697" y1="66" x2="697" y2="60" />
        </g>
        {/* A palm on the sand */}
        <path
          d="M652 220 C655 196 651 184 658 168"
          stroke="#7a5230"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M658 168 C674 158 688 162 692 174 C678 170 666 168 658 168" fill="#2f7d5c" />
        <path d="M658 168 C645 156 632 158 626 170 C639 166 650 166 658 168" fill="#2f7d5c" />
        <path d="M658 168 C664 152 678 148 688 154 C676 156 665 162 658 168" fill="#3b9770" />
      </g>
    </svg>
  )
}

/**
 * A sleeper coach on the night leg — the multi-day-tour image. Stars twinkle,
 * the windows are lit, the headlight throws a beam up the road. Everything
 * else holds still, because night does.
 */
export function NightScene() {
  return (
    <svg
      className="scene scene-night"
      viewBox="0 0 440 300"
      role="img"
      aria-label="A sleeper coach driving through the hills at night under a starry sky"
    >
      <rect width="440" height="300" fill="#16233f" />

      {/* Moon, with its one crater */}
      <circle cx="368" cy="58" r="22" fill="#f3e3ac" />
      <circle cx="360" cy="52" r="6" fill="#e2cf90" />

      {/* Stars — each its own element so the twinkle can be staggered */}
      <g fill="#f6f2df">
        {(
          [
            [40, 40, 2.4],
            [96, 76, 1.7],
            [150, 34, 2],
            [208, 88, 1.5],
            [258, 46, 2.2],
            [306, 104, 1.6],
            [122, 128, 1.5],
            [420, 130, 1.8],
            [24, 108, 1.6],
            [188, 24, 1.4],
          ] as const
        ).map(([x, y, r]) => (
          <circle key={`${x}-${y}`} className="star" cx={x} cy={y} r={r} />
        ))}
      </g>

      {/* Hills, darker than the sky */}
      <path
        d="M0 190 C90 150 170 180 260 148 C340 122 400 150 440 132 L440 300 L0 300 Z"
        fill="#101b33"
      />

      {/* Palani: the temple on its hill, lit, the way you actually see it
          from the night bus — a warm glow above a dark ridge */}
      <g>
        <ellipse cx="368" cy="120" rx="34" ry="18" fill="#f6d06a" opacity="0.14" />
        <polygon points="352,136 384,136 380,120 356,120" fill="#22345c" />
        <polygon points="356,120 380,120 377,108 359,108" fill="#22345c" />
        <ellipse cx="368" cy="106" rx="8" ry="4" fill="#22345c" />
        <line
          x1="368"
          y1="103"
          x2="368"
          y2="97"
          stroke="#f6d06a"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="364" y="124" width="8" height="12" rx="2" fill="#f6d06a" />
        <circle cx="358" cy="128" r="1.5" fill="#f6d06a" />
        <circle cx="378" cy="128" r="1.5" fill="#f6d06a" />
        {/* The stepped path up, as a dotted line of lamps */}
        <g fill="#f6d06a" opacity="0.7">
          <circle cx="346" cy="146" r="1.4" />
          <circle cx="338" cy="154" r="1.4" />
          <circle cx="331" cy="162" r="1.4" />
          <circle cx="325" cy="171" r="1.4" />
        </g>
      </g>

      <path d="M0 240 C120 210 260 250 440 208 L440 300 L0 300 Z" fill="#0b1426" />

      {/* The road and its dashes */}
      <path
        className="road"
        d="M-10 288 C120 268 280 262 450 244"
        fill="none"
        stroke="#1d1d29"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <path
        className="road-dash"
        d="M-10 288 C120 268 280 262 450 244"
        fill="none"
        stroke="#8d8da0"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="14 22"
      />

      {/* The sleeper coach. Same wrapper-group trick as the hero bus. */}
      <g transform="translate(200 250) rotate(-3)">
        <g className="bus">
          {/* Headlight beam first, so the body sits over its root */}
          <polygon points="78,-4 190,-26 190,16" fill="#f3e3ac" opacity="0.16" />
          <rect x="-78" y="-34" width="156" height="52" rx="9" fill="#d9d9e2" />
          <rect x="-78" y="-8" width="156" height="9" fill="#f26a21" />
          {/* Two rows of berth windows, lit */}
          {[-66, -44, -22, 0, 22, 44].map((x) => (
            <rect key={`up-${x}`} x={x} y="-28" width="16" height="8" rx="2" fill="#f6d06a" />
          ))}
          {[-66, -44, -22, 0, 22].map((x) => (
            <rect key={`lo-${x}`} x={x} y="-16" width="16" height="6" rx="2" fill="#caa84e" />
          ))}
          <rect x="62" y="-28" width="14" height="18" rx="2" fill="#9fc4e4" />
          <circle cx="76" cy="-2" r="3.5" fill="#f6e7b2" />
          <g className="wheel">
            <circle cx="-44" cy="22" r="11" fill="#0e0e14" />
            <circle cx="-44" cy="22" r="4" fill="#6f6f7c" />
          </g>
          <g className="wheel">
            <circle cx="44" cy="22" r="11" fill="#0e0e14" />
            <circle cx="44" cy="22" r="4" fill="#6f6f7c" />
          </g>
        </g>
      </g>
    </svg>
  )
}
