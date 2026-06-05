import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
// @ts-ignore - ahdjs has no bundled types
import AHDjsImport from "ahdjs";
const AHDjs: any = AHDjsImport;
import "ahdjs/build/css/index.css";

/**
 * Initializes AHDjs once per session, using the authenticated user's id
 * as the visitorId so highlights are tied to the current user.
 */
export default function AHDInit() {
  const { user } = useAuth();
  const initedRef = useRef(false);

  useEffect(() => {
    // Wait until we have a user id; only initialize once.
    if (initedRef.current || !user?.id) return;
    initedRef.current = true;

    try {
      // Configure AHDjs with the provided application credentials.
      AHDjs.config({
        applicationId: "6a19b18e9e47067dfe4f554f",
        apiHost: "https://pagepilot.fabbuilder.com",
        visitorId: user.id, // map visitor id to current authenticated user id
        showProgressbar: false,
      });

      // Build the in-memory site map of available guides/highlights.
      AHDjs.initializeSiteMap();

      // Show highlights for the target page (replace "target-page" as needed).
      AHDjs.showHighlights("target-page", true);
    } catch (e) {
      console.error("AHDjs init failed", e);
    }
  }, [user?.id]);

  return null;
}
