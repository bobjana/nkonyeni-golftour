"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-fetches the server-rendered tally every `seconds` while the page is visible. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [ago, setAgo] = useState(0);
  useEffect(() => {
    let last = Date.now();
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last >= seconds * 1000) {
        router.refresh();
        last = Date.now();
      }
      setAgo(Math.round((Date.now() - last) / 1000));
    }, 1000);
    const onFocus = () => {
      router.refresh();
      last = Date.now();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, seconds]);
  return <span className="text-xs text-muted">Updated {ago < 3 ? "just now" : `${ago}s ago`}</span>;
}
