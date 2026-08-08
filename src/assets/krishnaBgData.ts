// Lord Krishna Divine Sunset Background Asset
export const KRISHNA_BACKGROUND_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%232c2c54"/>
      <stop offset="35%" stop-color="%23474787"/>
      <stop offset="65%" stop-color="%23aaa69d"/>
      <stop offset="85%" stop-color="%23f7b731"/>
      <stop offset="100%" stop-color="%23fa8231"/>
    </linearGradient>
    <linearGradient id="seaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%231e3799"/>
      <stop offset="100%" stop-color="%230c2461"/>
    </linearGradient>
    <linearGradient id="krishnaSkin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%2382ccdd"/>
      <stop offset="50%" stop-color="%2360a3bc"/>
      <stop offset="100%" stop-color="%233c6382"/>
    </linearGradient>
    <linearGradient id="yellowDrape" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%23f6b93b"/>
      <stop offset="50%" stop-color="%23e58e26"/>
      <stop offset="100%" stop-color="%23b71540"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="12" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Sky -->
  <rect width="1080" height="1350" fill="url(%23skyGrad)"/>

  <!-- Sun Glow -->
  <circle cx="540" cy="1150" r="380" fill="%23f7b731" opacity="0.45" filter="url(%23glow)"/>
  <circle cx="540" cy="1150" r="200" fill="%23ffffff" opacity="0.75" filter="url(%23glow)"/>

  <!-- Sea and Horizon -->
  <rect y="1300" width="1080" height="620" fill="url(%23seaGrad)"/>
  <path d="M0,1300 Q270,1280 540,1300 T1080,1290 L1080,1920 L0,1920 Z" fill="%230c2461" opacity="0.8"/>

  <!-- Lord Krishna Divine Figure -->
  <g transform="translate(0, 120)">
    <!-- Aura / Divine Light -->
    <circle cx="540" cy="700" r="340" fill="%23f7b731" opacity="0.25" filter="url(%23glow)"/>

    <!-- Yellow Silk Drape (Shawl) -->
    <path d="M100,1350 C240,1080 320,1000 400,1060 C480,1120 600,1120 680,1060 C760,1000 840,1080 980,1350 L1080,1820 L0,1820 Z" fill="url(%23yellowDrape)"/>

    <!-- Torso -->
    <path d="M220,1380 C260,1150 380,1040 540,1040 C700,1040 820,1150 860,1380 C800,1600 280,1600 220,1380 Z" fill="url(%23krishnaSkin)"/>

    <!-- Neck -->
    <path d="M460,940 L540,1010 L620,940 L600,870 L480,870 Z" fill="url(%23krishnaSkin)"/>

    <!-- Face -->
    <path d="M380,670 C380,510 440,470 540,470 C640,470 700,510 700,670 C700,830 630,910 540,910 C450,910 380,830 380,670 Z" fill="url(%23krishnaSkin)"/>

    <!-- Gentle Smile -->
    <path d="M470,770 Q540,830 610,770 Q540,800 470,770 Z" fill="%23b71540"/>
    <path d="M478,775 Q540,815 602,775" fill="%23ffffff" opacity="0.95"/>

    <!-- Closed Eyes in Serene Joy -->
    <path d="M430,670 Q480,620 510,670" stroke="%230c2461" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M570,670 Q600,620 650,670" stroke="%230c2461" stroke-width="8" stroke-linecap="round" fill="none"/>

    <!-- Tilak on Forehead -->
    <path d="M525,540 C525,510 540,490 540,490 C540,490 555,510 555,540 C555,570 540,600 540,600 C540,600 525,570 525,540 Z" fill="%23ffffff"/>
    <path d="M532,550 C532,530 540,510 540,510 C540,510 548,530 548,550 C548,570 540,590 540,590 C540,590 532,570 532,550 Z" fill="%23f7b731"/>
    <circle cx="540" cy="615" r="8" fill="%23f7b731"/>

    <!-- Wavy Hair -->
    <path d="M340,610 C310,540 330,440 410,400 C470,370 590,370 650,400 C730,440 750,540 720,610 C700,490 650,420 540,420 C430,420 380,490 340,610 Z" fill="%231e272e"/>

    <!-- Peacock Feather (Mor Pankh) -->
    <g transform="translate(410, 200) rotate(-18)">
      <path d="M50,220 Q80,120 120,20" stroke="%2378e08f" stroke-width="7" fill="none"/>
      <ellipse cx="120" cy="25" rx="50" ry="65" fill="%2338ada9" filter="url(%23glow)"/>
      <ellipse cx="120" cy="25" rx="32" ry="45" fill="%23079992"/>
      <ellipse cx="120" cy="30" rx="20" ry="28" fill="%23f8c291"/>
      <ellipse cx="120" cy="35" rx="12" ry="16" fill="%230c2461"/>
    </g>

    <!-- Golden Jewelry -->
    <path d="M400,970 Q540,1110 680,970" stroke="%23f7b731" stroke-width="14" fill="none" filter="url(%23glow)"/>
    <path d="M370,1030 Q540,1210 710,1030" stroke="%23e58e26" stroke-width="8" stroke-dasharray="12,8" fill="none"/>
    <path d="M340,1090 Q540,1310 740,1090" stroke="%23f7b731" stroke-width="10" fill="none"/>

    <circle cx="350" cy="730" r="22" fill="%23f7b731" filter="url(%23glow)"/>
    <circle cx="730" cy="730" r="22" fill="%23f7b731" filter="url(%23glow)"/>
  </g>
</svg>`;
