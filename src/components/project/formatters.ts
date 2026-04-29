export const formatDuration = (start: string, end: string | null) => {
  if (!end) return "Running...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const formatDate = (dateString: string | null, locale?: string | null) => {
  if (!dateString) return "-";
  const lang = locale && locale.startsWith("ar") ? "ar-u-nu-latn" : (locale || "en-US");
  return new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

export const formatRelativeTime = (dateString: string | null) => {
  if (!dateString) return "Never";
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const formatCurrency = (amount: number | null, currency = "USD", locale?: string | null) => {
  if (amount === null) return "-";
  const lang = locale && locale.startsWith("ar") ? "ar-u-nu-latn" : (locale || "en-US");
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency,
  }).format(amount);
};