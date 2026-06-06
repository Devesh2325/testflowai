import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Module-level guard so we only initialize AHDjs once per page load.
let ahdInited = false;
let ahdReady = false;
let ahdRef: any = null;

/**
 * Initializes AHDjs once per session, using the authenticated user's id
 * as the visitorId. Re-runs showHighlights on every route change so
 * highlights are scoped to the current pathname.
 */
export default function AHDInit() {
  const { user } = useAuth();
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  // One-time init when the user is known.
  useEffect(() => {
    if (ahdInited || !user?.id) return;
    ahdInited = true;

    (async () => {
      try {
        const mod: any = await import("ahdjs");
        await import("ahdjs/build/css/index.css" as any);
        const AHDjs: any = mod.default ?? mod;

        // AHDjs is a factory: AHDjs(tour, options) returns an instance.
        const instance: any = AHDjs([], {
          applicationId: "6a23e38710adcf3cf33aa974",
          apiHost: "https://pagepilot.fabbuilder.com",
          visitorId: user.id,
          showProgressbar: false,
        });
        // Build the sitemap before showing highlights.
        await instance.initializeSiteMap();
        ahdRef = instance;
        ahdReady = true;
        // Show highlights for the root target page.
        await instance.showHighlights("/", true);
        lastPathRef.current = "/";
      } catch (e) {
        ahdInited = false;
        console.error("AHDjs init failed", e);
      }
    })();
  }, [user?.id]);

  // Re-trigger highlights on route changes.
  useEffect(() => {
    if (!ahdReady || !ahdRef) return;
    if (lastPathRef.current === location.pathname) return;
    lastPathRef.current = location.pathname;
    try {
      ahdRef.showHighlights(window.location.pathname, false);
    } catch (e) {
      console.error("AHDjs showHighlights failed", e);
    }
  }, [location.pathname]);

  return null;
}
