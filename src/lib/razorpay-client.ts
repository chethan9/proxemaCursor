declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => {
     
...
      ondismiss: opts.onDismiss,
    },
  });
  rzp.open();
}