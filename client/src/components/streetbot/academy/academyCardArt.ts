type CourseLike = {
  id?: string | null;
  title: string;
  category?: string | null;
  description?: string | null;
  level?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

type PathLike = {
  slug?: string | null;
  title: string;
  description?: string | null;
  level?: string | null;
  color?: string | null;
  preferredCategories?: string[];
};

type VisualKind = "career" | "digital" | "housing" | "creative" | "speaking" | "community";

type VisualPalette = {
  top: string;
  bottom: string;
  glow: string;
  accent: string;
  panel: string;
  ground: string;
  detail: string;
};

type CardVisual = {
  src: string;
  fallbackSrc: string;
  eyebrow: string;
  accent: string;
};

const palettes: Record<VisualKind, VisualPalette> = {
  career: {
    top: "#2E1A74",
    bottom: "#7647F7",
    glow: "#FDBA74",
    accent: "#FACC15",
    panel: "#F59E0B",
    ground: "#101827",
    detail: "#F8FAFC",
  },
  digital: {
    top: "#072A49",
    bottom: "#1D82C9",
    glow: "#7DD3FC",
    accent: "#22D3EE",
    panel: "#0EA5E9",
    ground: "#0B1220",
    detail: "#E0F2FE",
  },
  housing: {
    top: "#1F4D3A",
    bottom: "#4FA06F",
    glow: "#FDE68A",
    accent: "#FACC15",
    panel: "#10B981",
    ground: "#11231A",
    detail: "#F0FDF4",
  },
  creative: {
    top: "#4A1651",
    bottom: "#E5529D",
    glow: "#F9A8D4",
    accent: "#F472B6",
    panel: "#EC4899",
    ground: "#231128",
    detail: "#FDF2F8",
  },
  speaking: {
    top: "#5B1C26",
    bottom: "#F97316",
    glow: "#FED7AA",
    accent: "#FB923C",
    panel: "#EA580C",
    ground: "#2A1515",
    detail: "#FFF7ED",
  },
  community: {
    top: "#1F284A",
    bottom: "#7C3AED",
    glow: "#C4B5FD",
    accent: "#A78BFA",
    panel: "#8B5CF6",
    ground: "#161B2F",
    detail: "#F5F3FF",
  },
};

function toDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function pickVisualKind(text: string): VisualKind {
  const value = normalizeText(text);
  if (/(job|career|interview|resume|work|employment|confidence)/.test(value)) {
    return "career";
  }
  if (/(digital|computer|online|email|internet|tech|device)/.test(value)) {
    return "digital";
  }
  if (/(housing|home|tenant|stability|shelter|support)/.test(value)) {
    return "housing";
  }
  if (/(creative|design|media|story|mural|portfolio|arts)/.test(value)) {
    return "creative";
  }
  if (/(speak|voice|advocacy|communication|present|lead)/.test(value)) {
    return "speaking";
  }
  return "community";
}

const photoLibrary: Record<VisualKind, string[]> = {
  career: [
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1470004914212-05527e49370b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1465414829459-d228b58caf6e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&w=1200&q=80",
  ],
  digital: [
    "https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1446776709462-d6b525c57bd3?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1502784444185-1c362ccd89a5?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1500534314209-a26db0f5b38d?auto=format&fit=crop&w=1200&q=80",
  ],
  housing: [
    "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1464146072230-91cabc968266?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1443890923422-7819ed4101c0?auto=format&fit=crop&w=1200&q=80",
  ],
  creative: [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1465189684280-6a8fa9b19a7a?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80",
  ],
  speaking: [
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1441716844721-cc4caa344e5d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1200&q=80",
  ],
  community: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80",
  ],
};

function stringHash(value: string) {
  return Array.from(value).reduce(function (total, character) {
    return (total * 31 + character.charCodeAt(0)) >>> 0;
  }, 7);
}

function getPhotoForKind(kind: VisualKind, seedText: string) {
  const options = photoLibrary[kind];
  return options[stringHash(seedText) % options.length];
}

function buildBaseSvg(kind: VisualKind, label: string) {
  const palette = palettes[kind];
  const body = buildScene(kind, palette);
  return toDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="sky" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${palette.top}" />
          <stop offset="52%" stop-color="${palette.bottom}" />
          <stop offset="100%" stop-color="${palette.ground}" />
        </linearGradient>
        <linearGradient id="sunwash" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.7" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="sun" cx="72%" cy="16%" r="44%">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.98" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="vignette" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stop-color="#000" stop-opacity="0.24" />
          <stop offset="18%" stop-color="#000" stop-opacity="0.06" />
          <stop offset="82%" stop-color="#000" stop-opacity="0.05" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.24" />
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.05" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="1200" height="720" fill="url(#sky)" rx="42" />
      <rect width="1200" height="720" fill="url(#sun)" rx="42" />
      <rect width="1200" height="720" fill="url(#sunwash)" rx="42" />
      ${body}
      <rect width="1200" height="720" fill="url(#vignette)" rx="42" />
      <rect width="1200" height="720" filter="url(#grain)" opacity="0.55" rx="42" />
      <rect x="28" y="28" width="1144" height="664" rx="36" fill="none" stroke="rgba(255,255,255,0.14)" />
    </svg>
  `);
}

function buildScene(kind: VisualKind, palette: VisualPalette) {
  if (kind === "career") {
    return `
      <rect x="0" y="392" width="1200" height="328" fill="${palette.ground}" opacity="0.78" />
      <path d="M0 450 C178 418 298 418 446 444 C594 470 756 476 980 432 C1086 412 1158 404 1200 402 L1200 720 L0 720 Z" fill="#0A1220" opacity="0.68" />
      <path d="M0 468 C154 448 296 452 476 492 C654 532 834 534 1200 466 L1200 720 L0 720 Z" fill="${palette.ground}" opacity="0.92" />
      <path d="M0 324 C140 300 250 304 388 328 C516 352 636 354 828 326 C960 306 1086 296 1200 306 L1200 386 L0 386 Z" fill="${palette.detail}" opacity="0.16" />
      <rect x="748" y="188" width="70" height="238" rx="10" fill="${palette.detail}" opacity="0.18" />
      <rect x="822" y="142" width="78" height="284" rx="10" fill="${palette.detail}" opacity="0.24" />
      <rect x="910" y="206" width="60" height="220" rx="10" fill="${palette.detail}" opacity="0.16" />
      <rect x="988" y="168" width="88" height="258" rx="14" fill="${palette.detail}" opacity="0.22" />
      <path d="M112 552 H464" stroke="${palette.detail}" stroke-width="8" opacity="0.46" stroke-linecap="round" />
      <circle cx="342" cy="522" r="24" fill="#05070D" />
      <path d="M342 544 L342 602" stroke="#05070D" stroke-width="16" stroke-linecap="round" />
      <path d="M342 562 L308 594" stroke="#05070D" stroke-width="12" stroke-linecap="round" />
      <path d="M342 566 L382 584" stroke="#05070D" stroke-width="12" stroke-linecap="round" />
      <path d="M342 602 L314 658" stroke="#05070D" stroke-width="12" stroke-linecap="round" />
      <path d="M342 602 L388 664" stroke="#05070D" stroke-width="12" stroke-linecap="round" />
      <circle cx="220" cy="552" r="38" fill="none" stroke="#05070D" stroke-width="10" />
      <circle cx="290" cy="552" r="38" fill="none" stroke="#05070D" stroke-width="10" />
      <path d="M220 552 L254 518 L286 552" stroke="#05070D" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      <path d="M254 518 L270 470" stroke="#05070D" stroke-width="10" stroke-linecap="round" />
      <path d="M248 494 H284" stroke="#05070D" stroke-width="10" stroke-linecap="round" />
    `;
  }

  if (kind === "digital") {
    return `
      <rect x="0" y="0" width="1200" height="434" fill="rgba(255,255,255,0.1)" />
      <path d="M0 404 C120 378 276 366 468 384 C652 402 856 416 1200 372 L1200 720 L0 720 Z" fill="${palette.ground}" opacity="0.86" />
      <path d="M0 450 C218 426 436 442 614 496 C780 546 964 554 1200 498 L1200 720 L0 720 Z" fill="#0B1220" opacity="0.64" />
      <rect x="174" y="408" width="858" height="220" rx="20" fill="rgba(255,255,255,0.12)" />
      <g opacity="0.88">
        <rect x="174" y="408" width="858" height="220" fill="#2A4D3B" />
        <rect x="174" y="408" width="858" height="220" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="6" />
        <path d="M460 408 V628 M746 408 V628" stroke="rgba(255,255,255,0.24)" stroke-width="4" />
        <path d="M174 472 H1032 M174 564 H1032" stroke="rgba(255,255,255,0.18)" stroke-width="4" />
        <path d="M603 408 V628" stroke="rgba(255,255,255,0.38)" stroke-width="4" />
        <circle cx="603" cy="518" r="78" fill="none" stroke="rgba(255,255,255,0.26)" stroke-width="5" />
      </g>
      <path d="M150 392 L1200 64" stroke="rgba(255,255,255,0.14)" stroke-width="20" opacity="0.4" />
    `;
  }

  if (kind === "housing") {
    return `
      <rect x="0" y="470" width="1200" height="250" fill="#111827" opacity="0.7" />
      <rect x="0" y="120" width="1200" height="350" fill="#F3D081" />
      <rect x="0" y="120" width="1200" height="350" fill="url(#sunwash)" opacity="0.3" />
      <rect x="480" y="206" width="192" height="264" rx="12" fill="#173929" />
      <rect x="508" y="246" width="22" height="224" fill="#244C38" />
      <circle cx="640" cy="346" r="10" fill="#D7CBA7" />
      <rect x="720" y="186" width="220" height="232" rx="12" fill="#F5F5F4" />
      <rect x="746" y="214" width="168" height="176" rx="8" fill="rgba(15,23,42,0.08)" />
      <path d="M830 186 V418 M720 302 H940" stroke="#D6D3D1" stroke-width="8" />
      <rect x="786" y="430" width="86" height="22" rx="10" fill="#2F5D3C" />
      <path d="M800 450 C810 410 836 388 850 372 C866 390 884 412 892 450" fill="#6DAA74" />
      <path d="M774 448 C784 420 800 404 816 392 C834 408 848 430 856 448" fill="#84CC8A" opacity="0.9" />
      <path d="M0 470 H1200" stroke="rgba(0,0,0,0.18)" stroke-width="8" />
      <rect x="0" y="454" width="1200" height="14" fill="rgba(255,255,255,0.16)" />
    `;
  }

  if (kind === "creative") {
    return `
      <path d="M0 402 C160 320 292 308 440 338 C564 362 676 378 818 342 C958 306 1060 300 1200 332 L1200 720 L0 720 Z" fill="#2A364F" opacity="0.64" />
      <path d="M0 446 C154 394 310 390 480 432 C650 474 832 478 1200 410 L1200 720 L0 720 Z" fill="#3D4E63" opacity="0.76" />
      <path d="M198 544 C332 448 442 400 556 382 C706 358 850 384 986 462 C1032 488 1074 516 1120 552" stroke="rgba(255,255,255,0.24)" stroke-width="18" stroke-linecap="round" fill="none" />
      <path d="M126 564 C296 454 432 394 558 378 C714 358 848 388 994 478 C1030 500 1074 530 1126 572" stroke="rgba(255,255,255,0.12)" stroke-width="36" stroke-linecap="round" fill="none" />
      <path d="M0 580 C150 520 330 508 540 560 C758 612 932 612 1200 544 L1200 720 L0 720 Z" fill="#141B2B" opacity="0.86" />
      <rect x="468" y="170" width="112" height="330" fill="#0C1020" />
      <path d="M524 74 L564 170 H484 Z" fill="#0C1020" />
      <path d="M408 500 H640" stroke="#0C1020" stroke-width="12" />
      <path d="M524 238 V612" stroke="#0C1020" stroke-width="10" />
    `;
  }

  if (kind === "speaking") {
    return `
      <rect x="0" y="502" width="1200" height="218" fill="#17141B" opacity="0.94" />
      <path d="M0 434 C172 418 330 424 514 454 C704 486 874 490 1200 430 L1200 720 L0 720 Z" fill="#221A1E" opacity="0.78" />
      <path d="M0 474 C180 446 382 458 600 518 C800 572 996 574 1200 520 L1200 720 L0 720 Z" fill="#130F16" opacity="0.72" />
      <ellipse cx="604" cy="454" rx="206" ry="118" fill="${palette.glow}" opacity="0.34" />
      <path d="M520 530 C560 502 582 470 596 426 C610 468 634 500 684 530 Z" fill="#09070C" />
      <circle cx="596" cy="396" r="24" fill="#09070C" />
      <path d="M596 420 L596 508" stroke="#09070C" stroke-width="16" stroke-linecap="round" />
      <path d="M596 448 L548 492" stroke="#09070C" stroke-width="12" stroke-linecap="round" />
      <path d="M596 452 L644 486" stroke="#09070C" stroke-width="12" stroke-linecap="round" />
      <path d="M596 508 L568 574" stroke="#09070C" stroke-width="12" stroke-linecap="round" />
      <path d="M596 508 L638 576" stroke="#09070C" stroke-width="12" stroke-linecap="round" />
      <path d="M360 556 C412 520 454 508 492 514" stroke="rgba(255,255,255,0.16)" stroke-width="14" stroke-linecap="round" />
      <path d="M700 514 C756 508 808 524 868 562" stroke="rgba(255,255,255,0.16)" stroke-width="14" stroke-linecap="round" />
    `;
  }

  return `
    <path d="M0 392 C110 346 244 334 400 356 C530 374 642 400 830 382 C986 368 1086 350 1200 322 L1200 720 L0 720 Z" fill="#345E49" opacity="0.64" />
    <path d="M0 452 C164 418 334 430 528 490 C704 544 902 556 1200 492 L1200 720 L0 720 Z" fill="#1E3A2E" opacity="0.84" />
    <path d="M0 520 C210 488 432 500 650 560 C830 606 1018 612 1200 578 L1200 720 L0 720 Z" fill="#111827" opacity="0.88" />
    <path d="M286 364 C344 342 410 336 470 352 C528 368 574 404 604 454" stroke="rgba(255,255,255,0.14)" stroke-width="18" stroke-linecap="round" fill="none" />
    <path d="M634 454 C694 392 780 364 884 370 C948 374 1006 392 1058 430" stroke="rgba(255,255,255,0.14)" stroke-width="18" stroke-linecap="round" fill="none" />
    <circle cx="604" cy="456" r="18" fill="rgba(255,255,255,0.8)" />
    <circle cx="1058" cy="430" r="16" fill="rgba(255,255,255,0.76)" />
  `;
}

export function getCourseCardArt(course: CourseLike): CardVisual {
  const searchText = `${course.id ?? course.title} ${course.title} ${course.category ?? ""} ${course.description ?? ""} ${course.level ?? ""}`;
  const kind = pickVisualKind(searchText);
  const fallbackSrc = buildBaseSvg(kind, course.title);

  if (course.thumbnail_url) {
    return {
      src: course.thumbnail_url,
      fallbackSrc,
      eyebrow: course.category || course.level || "Course",
      accent: "#FFD600",
    };
  }
  if (course.image_url) {
    return {
      src: course.image_url,
      fallbackSrc,
      eyebrow: course.category || course.level || "Course",
      accent: "#FFD600",
    };
  }

  return {
    src: getPhotoForKind(kind, searchText),
    fallbackSrc,
    eyebrow: course.category || course.level || "Course",
    accent: palettes[kind].accent,
  };
}

export function getLearningPathCardArt(path: PathLike): CardVisual {
  const searchText = `${path.slug ?? path.title} ${path.title} ${path.description ?? ""} ${(path.preferredCategories || []).join(" ")} ${path.level ?? ""}`;
  const kind = pickVisualKind(searchText);
  const fallbackSrc = buildBaseSvg(kind, path.title);
  return {
    src: getPhotoForKind(kind, searchText),
    fallbackSrc,
    eyebrow: path.level || "Program",
    accent: path.color || palettes[kind].accent,
  };
}
