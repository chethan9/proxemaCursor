declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

let loadP: Promise<void> | null = null;

export function loadRazorpaySDK(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Razorpay) return Promise.resolve();
  if (loadP) return loadP;
  loadP = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("Razorpay SDK failed"));
    document.head.appendChild(s);
  });
  return loadP;
}

export interface RzpOpts {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { email: string; name?: string; contact?: string };
  onSuccess: (r: Record<string, string>) => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(opts: RzpOpts) {
  await loadRazorpaySDK();
  const rzp = new window.Razorpay!({
    key: opts.keyId,
    order_id: opts.orderId,
    amount: opts.amount,
    currency: opts.currency,
    name: opts.name,
    description: opts.description,
    prefill: opts.prefill,
    theme: { color: "#3b82f6" },
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  });
  rzp.open();
}