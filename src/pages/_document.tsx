import { cn } from "@/lib/utils";
import { Html, Head, Main, NextScript } from "next/document";
import { SEOElements } from "@/components/SEO";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <SEOElements />
        {/* No-flash theme preset: must run before paint. Reads cached preset and applies it to <html> so CSS variables are correct on first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('woosync-theme-preset');if(p==='modern'||p==='classic'){document.documentElement.dataset.themePreset=p;}else{document.documentElement.dataset.themePreset='modern';}}catch(e){document.documentElement.dataset.themePreset='modern';}})();`,
          }}
        />
        {/* No-flash locale dir: read NEXT_LOCALE cookie and set lang+dir before paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|;)\\s*NEXT_LOCALE=([^;]+)/);var l=m?decodeURIComponent(m[1]):'en';document.documentElement.lang=l;document.documentElement.dir=(l==='ar')?'rtl':'ltr';}catch(e){}})();`,
          }}
        />
        {/*
          CRITICAL: DO NOT REMOVE THIS SCRIPT
          The Softgen AI monitoring script is essential for core app functionality.
          The application will not function without it.
        */}
        <script
          src="https://cdn.softgen.ai/script.js"
          async
          data-softgen-monitoring="true"
        />
      </Head>
      <body
        className={cn(
          "min-h-screen w-full scroll-smooth bg-background text-foreground antialiased"
        )}
      >
        <Main />
        <NextScript />

        {/* Visual Editor Script */}
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://cdn.softgen.dev/visual-editor.min.js"
            async
            data-softgen-visual-editor="true"
          />
        )}
      </body>
    </Html>
  );
}
