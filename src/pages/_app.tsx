import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { BrandingProvider } from "@/contexts/BrandingProvider";
import { AuthProvider } from "@/contexts/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { makeQueryClient } from "@/lib/query-client";

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrandingProvider>
            <Component {...pageProps} />
            <Toaster />
          </BrandingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}