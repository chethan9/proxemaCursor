import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

interface Props {
  size?: number;
  className?: string;
}

export function BrandLoader({ size = 120, className }: Props) {
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/loader.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (!cancel) setData(json); })
      .catch(() => { /* ignore */ });
    return () => { cancel = true; };
  }, []);

  if (!data) {
    return <div style={{ width: size, height: size }} className={className} />;
  }

  return (
    <div style={{ width: size, height: size }} className={className}>
      <Lottie animationData={data} loop autoplay />
    </div>
  );
}