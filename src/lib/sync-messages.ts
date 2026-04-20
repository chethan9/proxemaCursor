export const SYNC_MESSAGES: Record<string, string[]> = {
  products: [
    "Lining up your products like a well-run storefront 🏬",
    "Making your products look smarter already 🧠",
    "Teaching Proxima what you sell (it's impressed) 🤖",
    "Polishing product data to perfection ✨",
    "Your catalog is getting a glow-up ✨",
  ],
  orders: [
    "Replaying your order history (the good parts 😄) 📜",
    "Organizing orders like a pro accountant 🧾",
    "Connecting every order to its story 🔗",
    "Making sense of who bought what 🧠",
    "Your orders are falling into place nicely 📦",
  ],
  customers: [
    "Getting to know your customers (politely) 👋",
    "Organizing your customer universe 🌍",
    "No customer left behind—syncing all 🚀",
    "Putting faces to purchases (metaphorically 😄) 👥",
    "Your audience is taking shape 🎯",
  ],
  categories: [
    "Putting everything in its right place 📂",
    "Turning chaos into neat categories 🗂️",
    "Sorting like a perfectionist 🎯",
  ],
  tags: [
    "Tagging everything with care 🏷️",
    "Labels are lining up nicely ✨",
    "Every tag gets a proper home 📂",
  ],
  coupons: [
    "Rounding up your coupons and discounts 🎟️",
    "Making sure every deal is accounted for 💸",
    "Your promotions are syncing up ✨",
  ],
  variations: [
    "Polishing up your product variations 🎨",
    "Matching every size, color, and option 🧩",
    "Backfilling variations in the background 🔄",
    "Fine-tuning variant details ⚙️",
  ],
  secondary: [
    "Backfilling variations quietly 🎨",
    "Tagging things up in the background 🏷️",
    "Adding coupon codes without slowing you down 🎟️",
    "Wrapping up the finishing touches ✨",
  ],
  general: [
    "Feeding the hamsters powering Proxima 🐹",
    "Brewing coffee for your data ☕",
    "This is the part where magic happens ✨",
    "Still faster than doing it manually 😄",
    "Your structure is getting smarter 🧠",
    "Almost there — hang tight 🚀",
  ],
  progress: [
    "Getting things ready…",
    "Warming things up…",
    "We're on it…",
    "Making good progress…",
    "Halfway there…",
    "Picking up speed…",
    "Putting things together…",
    "Almost in place…",
    "Just a few more moments…",
    "Wrapping things up…",
    "Finishing touches…",
    "Nearly there…",
    "Almost ready…",
    "Just about done…",
    "Ready any second now…",
  ],
};

export const ALL_MESSAGES: string[] = [
  ...SYNC_MESSAGES.products,
  ...SYNC_MESSAGES.orders,
  ...SYNC_MESSAGES.customers,
  ...SYNC_MESSAGES.categories,
  ...SYNC_MESSAGES.tags,
  ...SYNC_MESSAGES.coupons,
  ...SYNC_MESSAGES.general,
];

export function pickAnyMessage(tick: number): string {
  return ALL_MESSAGES[tick % ALL_MESSAGES.length];
}

export function pickMessage(aspect: string | null, tick: number): string {
  const pool = tick % 4 === 3
    ? SYNC_MESSAGES.general
    : SYNC_MESSAGES[aspect || "general"] || SYNC_MESSAGES.general;
  return pool[tick % pool.length];
}

export function pickProgressMessage(tick: number): string {
  const pool = SYNC_MESSAGES.progress;
  return pool[tick % pool.length];
}

export function pickSecondaryMessage(tick: number): string {
  const pool = SYNC_MESSAGES.secondary;
  return pool[tick % pool.length];
}