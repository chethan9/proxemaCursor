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
    "Your structure is getting smarter 🧠",
    "Everything is finally where it belongs ✅",
  ],
  tags: [
    "Tagging everything with care 🏷️",
    "Labels are lining up nicely ✨",
    "Every tag gets a proper home 📂",
    "Turning tags into a tidy taxonomy 🧠",
    "Your structure is getting smarter 🧠",
  ],
  coupons: [
    "Rounding up your coupons and discounts 🎟️",
    "Making sure every deal is accounted for 💸",
    "Your promotions are syncing up ✨",
    "Deals are falling into place nicely 📦",
    "Still faster than doing it manually 😄",
  ],
  general: [
    "Feeding the hamsters powering Proxima 🐹",
    "Brewing coffee for your data ☕",
    "This is the part where magic happens ✨",
    "Still faster than doing it manually 😄",
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