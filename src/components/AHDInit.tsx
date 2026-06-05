import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Module-level guard so we only initialize AHDjs once per page load,
// even if the component remounts (e.g. React StrictMode / route changes).
let ahdInited = false;

/**
 * Initializes AHDjs once per session, using the authenticated user's id
 * as the visitorId so highlights are tied to the current user.
 *
 * NOTE: ahdjs is imported dynamically inside the effect to avoid pulling
 * its bundled React copy into the initial module graph, which was causing
 * "Cannot read properties of null (reading 'useRef')" (duplicate React).
 */
export default function AHDInit() {
  const { user } = useAuth();

  useEffect(() => {
    if (ahdInited || !user?.id) return;
    ahdInited = true;

    (async () => {
      try {
        const mod: any = await import("ahdjs");
        await import("ahdjs/build/css/index.css" as any);
        const AHDjs: any = mod.default ?? mod;

        AHDjs.config({
          applicationId: "6a19b18e9e47067dfe4f554f",
          apiHost: "https://pagepilot.fabbuilder.com",
          visitorId: user.id,
          showProgressbar: false,
        });
        AHDjs.initializeSiteMap();
        AHDjs.showHighlights("target-page", true);
      } catch (e) {
        ahdInited = false;
        console.error("AHDjs init failed", e);
      }
    })();
  }, [user?.id]);

  return null;
}
