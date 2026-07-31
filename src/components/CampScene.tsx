/** SVG: resting horse + animated campfire for the left sidebar. */
export function CampScene() {
  return (
    <div className="camp-scene" aria-hidden="true">
      <div className="camp-scene-glow" />
      <svg
        className="camp-scene-art"
        viewBox="0 0 320 220"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <defs>
          <radialGradient id="fireGlow" cx="50%" cy="55%" r="45%">
            <stop offset="0%" stopColor="#ffb45a" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#c45c26" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0a140f" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="nightGround" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2a22" stopOpacity="0" />
            <stop offset="100%" stopColor="#0a120e" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="horseHide" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a2a1c" />
            <stop offset="100%" stopColor="#1a120c" />
          </linearGradient>
        </defs>

        <ellipse cx="160" cy="175" rx="140" ry="28" fill="url(#nightGround)" />
        <ellipse cx="155" cy="150" rx="70" ry="50" fill="url(#fireGlow)" />

        {/* Resting horse — lying on side, head toward fire */}
        <g className="horse" transform="translate(28 95)">
          <ellipse cx="78" cy="48" rx="72" ry="28" fill="url(#horseHide)" />
          <ellipse cx="18" cy="42" rx="22" ry="16" fill="#2a1c12" />
          <ellipse cx="6" cy="38" rx="10" ry="7" fill="#1a120c" />
          <path
            d="M2 36 Q-6 28 4 24"
            fill="none"
            stroke="#4a3420"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="12" cy="36" r="1.6" fill="#e8c080" opacity="0.7" />
          <path
            d="M40 68 Q48 78 56 70"
            fill="none"
            stroke="#2a1c12"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M70 70 Q78 82 88 72"
            fill="none"
            stroke="#2a1c12"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M100 66 Q112 78 118 64"
            fill="none"
            stroke="#24180f"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M125 52 Q148 40 138 28"
            fill="none"
            stroke="#4a3420"
            strokeWidth="4"
            strokeLinecap="round"
            className="horse-tail"
          />
          <ellipse cx="55" cy="38" rx="18" ry="8" fill="#4a3420" opacity="0.35" />
        </g>

        {/* Campfire logs + flames */}
        <g className="fire" transform="translate(145 118)">
          <rect
            x="-28"
            y="28"
            width="56"
            height="8"
            rx="3"
            fill="#3d2412"
            transform="rotate(-18)"
          />
          <rect
            x="-28"
            y="28"
            width="56"
            height="8"
            rx="3"
            fill="#2c1a0e"
            transform="rotate(18)"
          />
          <ellipse cx="0" cy="32" rx="18" ry="5" fill="#1a1008" opacity="0.5" />

          <g className="flame flame-a">
            <path
              d="M0 30 C-10 10 -6 -8 0 -22 C6 -8 10 10 0 30 Z"
              fill="#e8913a"
            />
          </g>
          <g className="flame flame-b">
            <path
              d="M-4 28 C-14 12 -8 -2 -2 -14 C2 0 4 14 -4 28 Z"
              fill="#ffb45a"
            />
          </g>
          <g className="flame flame-c">
            <path
              d="M4 28 C12 14 10 2 4 -10 C0 4 -2 16 4 28 Z"
              fill="#fff0c0"
              opacity="0.9"
            />
          </g>
          <circle className="ember e1" cx="-8" cy="8" r="1.5" fill="#ffb45a" />
          <circle className="ember e2" cx="6" cy="2" r="1.2" fill="#ffd080" />
          <circle className="ember e3" cx="0" cy="-6" r="1" fill="#ffe0a0" />
        </g>

        {/* Soft silhouettes of people near the fire */}
        <g className="friends" opacity="0.55" fill="#0a120e">
          <ellipse cx="220" cy="155" rx="14" ry="8" />
          <circle cx="220" cy="132" r="9" />
          <path d="M208 155 Q220 120 232 155 Z" />
          <ellipse cx="252" cy="158" rx="12" ry="7" />
          <circle cx="252" cy="138" r="8" />
          <path d="M242 158 Q252 128 262 158 Z" />
        </g>
      </svg>
    </div>
  )
}
