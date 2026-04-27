import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LEGACY_OUT_DIR = join(process.cwd(), "public", "images", "recipes");
const REAL_OUT_DIR = join(LEGACY_OUT_DIR, "real");
const AI_OUT_DIR = join(LEGACY_OUT_DIR, "ai");
const REGISTRY_PATH = join(process.cwd(), "lib", "recipe-image-assets.json");
const LEGACY_STAGED_COUNT = 48;

const researchReferences = [
  {
    label: "Pexels License",
    url: "https://www.pexels.com/license/",
    note: "Reusable commercial stock source. Direct curl access was blocked by Cloudflare during this pass, so no Pexels files were imported."
  },
  {
    label: "Unsplash License",
    url: "https://unsplash.com/license",
    note: "Reusable commercial stock source. Search results were useful for visual direction, but exact dish matches were not selected for this batch."
  },
  {
    label: "Wikimedia Commons Reuse",
    url: "https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/en",
    note: "Open media source with per-file attribution requirements. Search results were mostly raw fish/generic fillet imagery, not final KosherTable dish assets."
  }
];

const palettes = {
  fish: {
    background: "#f3eee2",
    table: "#d8c7ab",
    plate: "#fff8ea",
    base: "#ead8ab",
    protein: "#f6efe4",
    proteinDark: "#d7b98a",
    garnish: "#45745c",
    accent: "#f1c85d",
    shadow: "#253a35"
  },
  salmon: {
    background: "#f1eadf",
    table: "#d7bf9f",
    plate: "#fff9ec",
    base: "#dccd9e",
    protein: "#d97858",
    proteinDark: "#a95445",
    garnish: "#496f55",
    accent: "#f0cf67",
    shadow: "#2e3a35"
  },
  chicken: {
    background: "#f4ecdc",
    table: "#d2b894",
    plate: "#fff7e7",
    base: "#e7d6a7",
    protein: "#b46a3f",
    proteinDark: "#815035",
    garnish: "#557753",
    accent: "#e5b14d",
    shadow: "#342e25"
  },
  meat: {
    background: "#eee2d2",
    table: "#c7a987",
    plate: "#fff7e9",
    base: "#dbc391",
    protein: "#8a4f3d",
    proteinDark: "#5d372e",
    garnish: "#52714b",
    accent: "#e2a94c",
    shadow: "#332821"
  },
  eggs: {
    background: "#f5efe1",
    table: "#d3c2a4",
    plate: "#fff9ec",
    base: "#ead7aa",
    protein: "#fff6df",
    proteinDark: "#e0a93e",
    garnish: "#59805b",
    accent: "#f1ca61",
    shadow: "#2d342b"
  },
  soy: {
    background: "#eef0df",
    table: "#c7c39d",
    plate: "#fff9ed",
    base: "#dfd0a0",
    protein: "#eee0bd",
    proteinDark: "#b99b6e",
    garnish: "#496f52",
    accent: "#d7a84d",
    shadow: "#29352b"
  },
  legume: {
    background: "#f1ead8",
    table: "#cdb896",
    plate: "#fff8ec",
    base: "#e5d19b",
    protein: "#c5894d",
    proteinDark: "#8b6038",
    garnish: "#56764f",
    accent: "#deb04d",
    shadow: "#322d24"
  },
  vegetable: {
    background: "#eef0dc",
    table: "#c2c29a",
    plate: "#fff9ec",
    base: "#ded0a2",
    protein: "#d37b45",
    proteinDark: "#7c6f3f",
    garnish: "#426f50",
    accent: "#e7b84c",
    shadow: "#273529"
  },
  dairy: {
    background: "#f4ecdf",
    table: "#d0bfa5",
    plate: "#fffaf0",
    base: "#dfcca0",
    protein: "#f2ead8",
    proteinDark: "#b9a67e",
    garnish: "#4e7459",
    accent: "#d9aa56",
    shadow: "#303229"
  },
  nuts: {
    background: "#efe5d3",
    table: "#c8ad87",
    plate: "#fff8eb",
    base: "#deca99",
    protein: "#b8844a",
    proteinDark: "#754e2e",
    garnish: "#536f4c",
    accent: "#d7a24a",
    shadow: "#33291f"
  }
};

const imageGroups = [
  {
    prefix: "walleye-passover",
    count: 12,
    family: "fish",
    palette: "fish",
    mainMatches: ["walleye"],
    baseMatches: ["matzo farfel", "quinoa", "cauliflower"],
    flavorMatches: ["lemon", "dill", "parsley", "garlic", "ginger", "cumin"],
    passoverSafe: true,
    aiPriorityCount: 8,
    subject: "walleye fillets with kosher for Passover sides",
    variants: [
      "lemon dill matzo farfel",
      "parsley quinoa carrots",
      "garlic cauliflower crumble",
      "ginger carrots zucchini",
      "cumin coriander quinoa",
      "rosemary cauliflower herbs"
    ]
  },
  {
    prefix: "walleye-weeknight",
    count: 10,
    family: "fish",
    palette: "fish",
    mainMatches: ["walleye"],
    baseMatches: ["rice", "quinoa", "couscous", "pasta"],
    flavorMatches: ["lemon", "dill", "sumac", "mint", "oregano"],
    passoverSafe: false,
    aiPriorityCount: 4,
    subject: "walleye fillets with weeknight grains",
    variants: ["lemon rice", "dill quinoa", "sumac couscous", "mint greens", "garlic pasta"]
  },
  {
    prefix: "salmon",
    count: 8,
    family: "fish",
    palette: "salmon",
    mainMatches: ["salmon"],
    baseMatches: ["quinoa", "rice", "greens"],
    flavorMatches: ["lemon", "dill", "mint", "oregano"],
    passoverSafe: true,
    aiPriorityCount: 2,
    subject: "salmon fillets with herbs and grains",
    variants: ["lemon quinoa", "dill carrots", "mint greens", "oregano rice"]
  },
  {
    prefix: "white-fish",
    count: 8,
    family: "fish",
    palette: "fish",
    mainMatches: ["cod", "trout", "tuna"],
    baseMatches: ["quinoa", "rice", "cauliflower", "greens"],
    flavorMatches: ["lemon", "parsley", "garlic", "dill"],
    passoverSafe: true,
    aiPriorityCount: 2,
    subject: "white fish fillets with clean herb sides",
    variants: ["cod lemon", "trout herbs", "tuna greens", "cod cauliflower"]
  },
  {
    prefix: "chicken-thighs",
    count: 8,
    family: "meat",
    palette: "chicken",
    mainMatches: ["chicken thighs"],
    baseMatches: ["quinoa", "rice", "matzo farfel", "cauliflower"],
    flavorMatches: ["lemon", "rosemary", "sumac", "garlic"],
    passoverSafe: true,
    aiPriorityCount: 2,
    subject: "kosher chicken thighs with carrots and herbs",
    variants: ["lemon quinoa", "rosemary carrots", "sumac cauliflower", "matzo farfel"]
  },
  {
    prefix: "chicken-breast",
    count: 6,
    family: "meat",
    palette: "chicken",
    mainMatches: ["chicken breast"],
    baseMatches: ["rice", "quinoa", "greens"],
    flavorMatches: ["garlic", "thyme", "parsley"],
    passoverSafe: true,
    aiPriorityCount: 1,
    subject: "kosher chicken breast slices with vegetables",
    variants: ["garlic quinoa", "thyme carrots", "parsley greens"]
  },
  {
    prefix: "beef",
    count: 8,
    family: "meat",
    palette: "meat",
    mainMatches: ["ground beef", "beef stew"],
    baseMatches: ["rice", "quinoa", "cauliflower"],
    flavorMatches: ["cumin", "garlic", "coriander"],
    passoverSafe: true,
    aiPriorityCount: 1,
    subject: "kosher beef with vegetables and grains",
    variants: ["ground beef quinoa", "beef stew carrots", "cumin cauliflower", "garlic rice"]
  },
  {
    prefix: "lamb-duck",
    count: 6,
    family: "meat",
    palette: "meat",
    mainMatches: ["lamb", "duck"],
    baseMatches: ["quinoa", "rice", "greens"],
    flavorMatches: ["mint", "rosemary", "cinnamon"],
    passoverSafe: true,
    aiPriorityCount: 0,
    subject: "kosher lamb or duck with herbs",
    variants: ["lamb mint", "duck rosemary", "lamb cinnamon"]
  },
  {
    prefix: "eggs",
    count: 8,
    family: "eggs",
    palette: "eggs",
    mainMatches: ["eggs"],
    baseMatches: ["greens", "quinoa", "cauliflower"],
    flavorMatches: ["dill", "parsley", "garlic"],
    passoverSafe: true,
    aiPriorityCount: 1,
    subject: "egg-based kosher meal with herbs",
    variants: ["dill eggs", "parsley greens", "quinoa eggs", "cauliflower eggs"]
  },
  {
    prefix: "tofu",
    count: 6,
    family: "soy",
    palette: "soy",
    mainMatches: ["tofu"],
    baseMatches: ["rice", "quinoa", "greens"],
    flavorMatches: ["ginger", "garlic", "mint"],
    passoverSafe: false,
    aiPriorityCount: 0,
    subject: "tofu with herbs and vegetables",
    variants: ["ginger rice", "garlic quinoa", "mint greens"]
  },
  {
    prefix: "legumes",
    count: 8,
    family: "legume",
    palette: "legume",
    mainMatches: ["lentils", "chickpeas"],
    baseMatches: ["rice", "quinoa", "pita", "greens"],
    flavorMatches: ["cumin", "coriander", "lemon"],
    passoverSafe: false,
    aiPriorityCount: 0,
    subject: "legume bowls with warm spices",
    variants: ["lentil quinoa", "chickpea rice", "cumin greens", "chickpea pita"]
  },
  {
    prefix: "mushroom-vegetable",
    count: 8,
    family: "vegetable",
    palette: "vegetable",
    mainMatches: ["mushrooms", "seasonal vegetables"],
    baseMatches: ["quinoa", "rice", "cauliflower"],
    flavorMatches: ["garlic", "thyme", "parsley"],
    passoverSafe: true,
    aiPriorityCount: 1,
    subject: "mushrooms and vegetables with grains",
    variants: ["mushroom quinoa", "garlic cauliflower", "thyme vegetables", "parsley rice"]
  },
  {
    prefix: "dairy-nuts",
    count: 8,
    family: "dairy",
    palette: "dairy",
    mainMatches: ["feta", "yogurt", "almonds"],
    baseMatches: ["quinoa", "greens", "pita"],
    flavorMatches: ["mint", "lemon", "parsley"],
    passoverSafe: true,
    aiPriorityCount: 1,
    subject: "dairy and nut kosher plates",
    variants: ["feta quinoa", "yogurt herbs", "almond greens", "feta pita"]
  },
  {
    prefix: "sweet-potato",
    count: 4,
    family: "vegetable",
    palette: "vegetable",
    mainMatches: ["sweet potatoes"],
    baseMatches: ["quinoa", "greens"],
    flavorMatches: ["cinnamon", "ginger", "parsley"],
    passoverSafe: true,
    aiPriorityCount: 1,
    subject: "sweet potatoes with herbs",
    variants: ["ginger quinoa", "cinnamon carrots"]
  }
];

const externalPhotoAssets = [
  {
    key: "photo-white-fish-fillet-cc-by",
    path: "/images/recipes/real/photos/white-fish-fillet-cc-by.jpg",
    sourceType: "wikimedia",
    mainMatches: ["walleye", "cod", "trout"],
    familyMatches: ["fish"],
    baseMatches: ["matzo farfel", "quinoa", "cauliflower", "rice", "greens"],
    flavorMatches: ["lemon", "dill", "parsley", "garlic", "ginger", "cumin"],
    passoverSafe: true,
    subject: "white fish fillet close-up",
    prompt: "Sourced Wikimedia photo used as a local fish-fillet visual fallback for white fish and walleye recipes.",
    attribution: "Photo by François Nguyen",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Grilled_fish_fillet_(2).jpg",
    license: "CC BY 2.0"
  },
  {
    key: "photo-grilled-cod-fillet-cc-by",
    path: "/images/recipes/real/photos/grilled-cod-fillet-cc-by.jpg",
    sourceType: "wikimedia",
    mainMatches: ["walleye", "cod", "trout"],
    familyMatches: ["fish"],
    baseMatches: ["matzo farfel", "quinoa", "cauliflower", "rice", "greens"],
    flavorMatches: ["lemon", "dill", "parsley", "garlic", "ginger", "cumin"],
    passoverSafe: true,
    subject: "grilled cod-style white fish fillet",
    prompt: "Sourced Wikimedia photo used as a local white-fish visual for cod, trout, and walleye recipes.",
    attribution: "Photo by François Nguyen",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Grilled_deep_sea_cod_fillet.jpg",
    license: "CC BY 2.0"
  },
  {
    key: "photo-salmon-fillet-cc0",
    path: "/images/recipes/real/photos/salmon-fillet-cc0.jpg",
    sourceType: "wikimedia",
    mainMatches: ["salmon"],
    familyMatches: ["fish"],
    baseMatches: ["quinoa", "rice", "greens", "cauliflower"],
    flavorMatches: ["lemon", "dill", "mint", "oregano", "parsley"],
    passoverSafe: true,
    subject: "salmon fillet with herbs",
    prompt: "Sourced Wikimedia/Pixabay CC0 photo used as a local salmon recipe visual.",
    attribution: "Photo by NjoyHarmony via Pixabay",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:SalmonFillet.jpg",
    license: "CC0"
  },
  {
    key: "photo-mushroom-quinoa-cc",
    path: "/images/recipes/real/photos/mushroom-quinoa-cc.jpg",
    sourceType: "wikimedia",
    mainMatches: ["mushrooms", "seasonal vegetables"],
    familyMatches: ["vegetable"],
    baseMatches: ["quinoa"],
    flavorMatches: ["garlic", "thyme", "parsley"],
    passoverSafe: true,
    subject: "kale and mushroom quinoa bowl",
    prompt: "Sourced Wikimedia photo used as a local mushroom and quinoa recipe visual.",
    attribution: "Photo by Jennifer from Vancouver, Canada",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kale_and_Mushroom_Quinoa_(4257979482).jpg",
    license: "CC BY 2.0"
  }
];

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function imageAssets() {
  return imageGroups.flatMap((group) =>
    Array.from({ length: group.count }, (_, index) => {
      const variant = group.variants[index % group.variants.length];
      const key = `${group.prefix}-${String(index + 1).padStart(2, "0")}-${slug(variant)}`;
      const aiPriority = index < (group.aiPriorityCount ?? 0);
      const directory = aiPriority ? "ai" : "real";
      return {
        key,
        path: `/images/recipes/${directory}/${key}.svg`,
        sourceType: "generated",
        mainMatches: group.mainMatches,
        familyMatches: [group.family],
        baseMatches: group.baseMatches,
        flavorMatches: group.flavorMatches,
        passoverSafe: group.passoverSafe,
        subject: group.subject,
        prompt: [
          `Photorealistic editorial food image of ${group.subject}, ${variant}.`,
          "Plated for two in warm natural light, Jewish home-cooking aesthetic.",
          "No tomatoes, peppers, white potatoes, eggplant, paprika, cayenne, pork, shellfish, text, logos, or people.",
          "Kosher-safe plating, 4:3 card crop, clean table setting."
        ].join(" "),
        attribution: null,
        sourceUrl: null,
        license: null,
        palette: group.palette,
        variant
      };
    })
  );
}

function legacySvg(index) {
  const id = String(index + 1).padStart(4, "0");
  const legacyPalettes = [
    ["#f6efe2", "#a94e34", "#23443b", "#e0a84f"],
    ["#f3ead7", "#d07a45", "#253f54", "#6ca36f"],
    ["#eee3cc", "#7d4b35", "#1d4f4a", "#c2a24b"],
    ["#f7f0e5", "#4d7d78", "#553f2e", "#d99559"]
  ];
  const [bg, accent, dark, gold] = legacyPalettes[index % legacyPalettes.length];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 675" role="img" aria-label="Kosher recipe fallback ${id}">
  <rect width="900" height="675" fill="${bg}"/>
  <ellipse cx="450" cy="365" rx="290" ry="190" fill="#fff8ec"/>
  <ellipse cx="450" cy="365" rx="225" ry="132" fill="#f8f1e3"/>
  <ellipse cx="372" cy="312" rx="92" ry="58" fill="${accent}"/>
  <ellipse cx="520" cy="330" rx="112" ry="66" fill="${dark}"/>
  <ellipse cx="430" cy="420" rx="180" ry="58" fill="${gold}" opacity=".85"/>
  <g fill="#5f8d61">
    <ellipse cx="310" cy="250" rx="38" ry="12" transform="rotate(-22 310 250)"/>
    <ellipse cx="500" cy="252" rx="33" ry="11" transform="rotate(18 500 252)"/>
    <ellipse cx="590" cy="440" rx="31" ry="10" transform="rotate(-14 590 440)"/>
  </g>
</svg>`;
}

function proteinLayer(asset, palette, seed) {
  const family = asset.familyMatches[0];
  const fish = asset.mainMatches.some((match) => ["walleye", "salmon", "cod", "trout", "tuna"].includes(match));
  const isSalmon = asset.mainMatches.includes("salmon");

  if (fish) {
    const fill = isSalmon ? palettes.salmon.protein : palette.protein;
    const dark = isSalmon ? palettes.salmon.proteinDark : palette.proteinDark;
    return `
  <g filter="url(#soft-shadow)">
    <path d="M260 318c88-78 262-90 378-28 38 20 46 66 12 95-98 84-300 94-415 20-39-25-31-59 25-87z" fill="${fill}"/>
    <path d="M280 329c83 40 227 40 336 4" fill="none" stroke="${dark}" stroke-width="12" stroke-linecap="round" opacity=".45"/>
    <path d="M308 377c88 34 205 31 300-8" fill="none" stroke="#fffaf1" stroke-width="9" stroke-linecap="round" opacity=".65"/>
    <circle cx="${520 + (seed % 36)}" cy="${300 + (seed % 24)}" r="16" fill="${palette.accent}" opacity=".95"/>
  </g>`;
  }

  if (family === "meat") {
    return `
  <g filter="url(#soft-shadow)" fill="${palette.protein}">
    <ellipse cx="330" cy="330" rx="86" ry="54" transform="rotate(-18 330 330)"/>
    <ellipse cx="465" cy="316" rx="95" ry="58" transform="rotate(10 465 316)"/>
    <ellipse cx="560" cy="398" rx="86" ry="50" transform="rotate(-10 560 398)"/>
    <path d="M280 360c78 35 196 38 320 5" fill="none" stroke="${palette.proteinDark}" stroke-width="11" stroke-linecap="round" opacity=".45"/>
  </g>`;
  }

  if (family === "eggs") {
    return `
  <g filter="url(#soft-shadow)">
    <ellipse cx="345" cy="330" rx="82" ry="62" fill="${palette.protein}"/>
    <circle cx="355" cy="330" r="30" fill="${palette.proteinDark}"/>
    <ellipse cx="515" cy="350" rx="88" ry="64" fill="${palette.protein}"/>
    <circle cx="505" cy="350" r="31" fill="${palette.proteinDark}"/>
    <path d="M274 423c84 23 258 19 370-12" fill="none" stroke="${palette.accent}" stroke-width="18" stroke-linecap="round" opacity=".5"/>
  </g>`;
  }

  if (family === "soy") {
    return `
  <g filter="url(#soft-shadow)" fill="${palette.protein}">
    <rect x="300" y="288" width="96" height="70" rx="14" transform="rotate(-9 348 323)"/>
    <rect x="432" y="302" width="98" height="72" rx="14" transform="rotate(8 481 338)"/>
    <rect x="532" y="382" width="86" height="62" rx="13" transform="rotate(-12 575 413)"/>
    <path d="M300 380c88 44 210 40 310-7" fill="none" stroke="${palette.proteinDark}" stroke-width="10" stroke-linecap="round" opacity=".42"/>
  </g>`;
  }

  if (family === "legume") {
    return `
  <g filter="url(#soft-shadow)" fill="${palette.protein}">
    ${Array.from({ length: 22 }, (_, index) => {
      const x = 300 + ((index * 47 + seed) % 310);
      const y = 295 + ((index * 31 + seed) % 160);
      const r = 13 + ((index + seed) % 9);
      return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
    }).join("")}
  </g>`;
  }

  if (family === "dairy") {
    return `
  <g filter="url(#soft-shadow)">
    <path d="M270 332c88-42 254-53 374-14 38 12 39 51 3 70-112 58-299 61-403 7-34-18-24-45 26-63z" fill="${palette.protein}"/>
    ${Array.from({ length: 16 }, (_, index) => {
      const x = 300 + ((index * 53 + seed) % 300);
      const y = 305 + ((index * 37 + seed) % 125);
      return `<rect x="${x}" y="${y}" width="28" height="18" rx="5" fill="${index % 3 === 0 ? palette.proteinDark : "#fffaf0"}" transform="rotate(${(index % 5) * 12 - 24} ${x} ${y})"/>`;
    }).join("")}
  </g>`;
  }

  return `
  <g filter="url(#soft-shadow)" fill="${palette.protein}">
    <path d="M310 306c70-22 170-17 246 13 42 17 50 55 14 83-84 66-253 62-323-7-31-30-12-68 63-89z"/>
    <path d="M302 390c92 41 236 35 325-17" fill="none" stroke="${palette.proteinDark}" stroke-width="14" stroke-linecap="round" opacity=".5"/>
  </g>`;
}

function publicAsset(asset) {
  const cleanAsset = { ...asset };
  delete cleanAsset.palette;
  delete cleanAsset.variant;
  return cleanAsset;
}

function garnishLayer(palette, seed) {
  const herbs = Array.from({ length: 13 }, (_, index) => {
    const x = 245 + ((seed + index * 67) % 405);
    const y = 210 + ((seed + index * 41) % 250);
    const rotation = -34 + ((seed + index * 23) % 68);
    return `<ellipse cx="${x}" cy="${y}" rx="${20 + (index % 3) * 5}" ry="8" fill="${palette.garnish}" transform="rotate(${rotation} ${x} ${y})" opacity=".9"/>`;
  }).join("");

  const carrots = Array.from({ length: 7 }, (_, index) => {
    const x = 270 + ((seed + index * 71) % 370);
    const y = 270 + ((seed + index * 53) % 180);
    return `<rect x="${x}" y="${y}" width="58" height="14" rx="7" fill="#dc8543" transform="rotate(${(index % 5) * 15 - 26} ${x} ${y})" opacity=".82"/>`;
  }).join("");

  const zucchini = Array.from({ length: 6 }, (_, index) => {
    const x = 285 + ((seed + index * 61) % 350);
    const y = 285 + ((seed + index * 47) % 170);
    return `<ellipse cx="${x}" cy="${y}" rx="31" ry="11" fill="#7aa36d" transform="rotate(${(index % 4) * 18 - 24} ${x} ${y})" opacity=".75"/>`;
  }).join("");

  return `<g>${carrots}${zucchini}${herbs}</g>`;
}

function realSvg(asset, index) {
  const palette = palettes[asset.palette] ?? palettes.fish;
  const seed = (index + 1) * 97;
  const baseDots = Array.from({ length: 44 }, (_, dot) => {
    const x = 248 + ((seed + dot * 41) % 410);
    const y = 280 + ((seed + dot * 29) % 185);
    const r = 4 + ((seed + dot) % 7);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${dot % 3 === 0 ? "#f4e6bd" : palette.base}" opacity=".82"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 675" role="img" aria-label="${asset.subject}">
  <defs>
    <radialGradient id="plate-glow" cx="50%" cy="46%" r="62%">
      <stop offset="0" stop-color="#fffdf4"/>
      <stop offset="1" stop-color="${palette.plate}"/>
    </radialGradient>
    <linearGradient id="table" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.background}"/>
      <stop offset="1" stop-color="${palette.table}"/>
    </linearGradient>
    <filter id="soft-shadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="15" flood-color="${palette.shadow}" flood-opacity=".28"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}" result="noise"/>
      <feColorMatrix type="saturate" values=".12"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .12"/>
      </feComponentTransfer>
      <feBlend mode="multiply" in2="SourceGraphic"/>
    </filter>
  </defs>
  <rect width="900" height="675" fill="url(#table)"/>
  <rect width="900" height="675" filter="url(#grain)" opacity=".34"/>
  <ellipse cx="450" cy="365" rx="332" ry="222" fill="#5d4b3c" opacity=".12"/>
  <ellipse cx="450" cy="350" rx="318" ry="214" fill="url(#plate-glow)"/>
  <ellipse cx="450" cy="350" rx="260" ry="164" fill="#f6ead4"/>
  <g>${baseDots}</g>
  ${proteinLayer(asset, palette, seed)}
  ${garnishLayer(palette, seed)}
  <g opacity=".95">
    <circle cx="${610 - (seed % 80)}" cy="${235 + (seed % 40)}" r="22" fill="${palette.accent}"/>
    <path d="M${610 - (seed % 80)} ${214 + (seed % 40)}a22 22 0 0 1 0 44" fill="#fff3b0" opacity=".72"/>
  </g>
</svg>`;
}

mkdirSync(LEGACY_OUT_DIR, { recursive: true });
mkdirSync(REAL_OUT_DIR, { recursive: true });
mkdirSync(AI_OUT_DIR, { recursive: true });

for (let index = 0; index < LEGACY_STAGED_COUNT; index += 1) {
  const id = String(index + 1).padStart(4, "0");
  writeFileSync(join(LEGACY_OUT_DIR, `catalog-${id}.svg`), legacySvg(index));
}

const assets = [...externalPhotoAssets, ...imageAssets()];
for (const [index, asset] of assets.entries()) {
  if (asset.sourceType === "generated") {
    const outDir = asset.path.startsWith("/images/recipes/ai/") ? AI_OUT_DIR : REAL_OUT_DIR;
    writeFileSync(join(outDir, `${asset.key}.svg`), realSvg(asset, index));
  }
}

const publicManifest = {
  generatedAt: "2026-04-27T00:00:00.000Z",
  format: "svg",
  assetCount: assets.length,
  sourcePolicy: "local generated/AI-ready dish assets first, sourced photos as reviewed fallback, no hotlinked images",
  researchReferences,
  assets: assets.map(publicAsset)
};

const registry = assets.map(publicAsset);

writeFileSync(join(REAL_OUT_DIR, "manifest.json"), `${JSON.stringify(publicManifest, null, 2)}\n`);
writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
writeFileSync(
  join(LEGACY_OUT_DIR, "manifest.json"),
  `${JSON.stringify(
    {
      generatedAt: "2026-04-27T00:00:00.000Z",
      legacyFallbackCount: LEGACY_STAGED_COUNT,
      dishAwareAssetCount: assets.length,
      dishAwareManifest: "/images/recipes/real/manifest.json"
    },
    null,
    2
  )}\n`
);
