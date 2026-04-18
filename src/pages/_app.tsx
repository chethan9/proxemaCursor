import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { BrandingProvider } from "@/contexts/BrandingProvider";
import { AuthProvider } from "@/contexts/AuthProvider";
import { AppShell } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/toaster";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAuthPage = router.pathname.startsWith("/auth/");
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrandingProvider>
          {isAuthPage ? (
            <Component {...pageProps} />
          ) : (
            <AppShell>
              <Component {...pageProps} />
            </AppShell>
          )}
          <Toaster />
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}