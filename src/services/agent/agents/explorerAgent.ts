/**
 * Explorer Agent: Discovers pages, navigation links, forms, and interactive DOM elements
 * to build a persistent Application Map.
 */

import { ApplicationMap, DiscoveredPage, DiscoveredElement, DiscoveredForm, MissionConfig } from "../types";
import { browserBridge } from "../browserBridge";
import { agentMemory } from "../memory";

export class ExplorerAgent {
  public static async explore(config: MissionConfig): Promise<ApplicationMap> {
    const navResult = await browserBridge.navigate(config.targetUrl);
    const pages: DiscoveredPage[] = [];

    // Parse returned HTML or DOM elements
    const html = navResult.data?.html || "";
    const pageTitle = navResult.data?.title || "Home Page";

    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const elements: DiscoveredElement[] = [];
      const forms: DiscoveredForm[] = [];
      const links: string[] = [];

      // Extract Interactive Elements
      doc.querySelectorAll("button, input, select, textarea, a[href]").forEach((el, index) => {
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute("type") || undefined;
        const name = el.getAttribute("name") || undefined;
        const label = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent?.trim().slice(0, 30) || undefined;
        const selector = el.id ? `#${el.id}` : name ? `${tag}[name="${name}"]` : `${tag}:nth-of-type(${index + 1})`;

        elements.push({
          id: `elem_${index}`,
          tag,
          type,
          name,
          label,
          selector,
          text: el.textContent?.trim().slice(0, 40) || undefined,
          role: el.getAttribute("role") || tag,
          isInteractive: true,
          attributes: Array.from(el.attributes).reduce((acc, a) => ({ ...acc, [a.name]: a.value }), {}),
        });

        if (tag === "a") {
          const href = el.getAttribute("href");
          if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
            try {
              const absUrl = new URL(href, config.targetUrl).toString();
              if (absUrl.startsWith(config.targetUrl) && !links.includes(absUrl)) {
                links.push(absUrl);
              }
            } catch {}
          }
        }
      });

      // Extract Forms
      doc.querySelectorAll("form").forEach((formEl, fIdx) => {
        const formInputs: DiscoveredElement[] = [];
        let submitBtn: DiscoveredElement | undefined;

        formEl.querySelectorAll("input, select, textarea").forEach((inp, iIdx) => {
          const tag = inp.tagName.toLowerCase();
          const name = inp.getAttribute("name") || undefined;
          formInputs.push({
            id: `form_${fIdx}_inp_${iIdx}`,
            tag,
            type: inp.getAttribute("type") || "text",
            name,
            label: inp.getAttribute("aria-label") || inp.getAttribute("placeholder") || undefined,
            selector: inp.id ? `#${inp.id}` : `${tag}[name="${name || ""}"]`,
            isInteractive: true,
            attributes: {},
          });
        });

        const btn = formEl.querySelector('button[type="submit"], input[type="submit"], button');
        if (btn) {
          submitBtn = {
            id: `form_${fIdx}_submit`,
            tag: "button",
            selector: btn.id ? `#${btn.id}` : 'button[type="submit"]',
            label: btn.textContent?.trim() || "Submit",
            isInteractive: true,
            attributes: {},
          };
        }

        forms.push({
          id: `form_${fIdx}`,
          action: formEl.getAttribute("action") || undefined,
          method: formEl.getAttribute("method") || "POST",
          inputs: formInputs,
          submitButton: submitBtn,
        });
      });

      pages.push({
        url: config.targetUrl,
        title: pageTitle,
        path: new URL(config.targetUrl).pathname || "/",
        elements,
        forms,
        links: links.slice(0, 10),
        discoveredAt: new Date().toISOString(),
      });
    } else {
      // Minimal page descriptor when runner is waiting or CORS restricted
      pages.push({
        url: config.targetUrl,
        title: "Target Application",
        path: "/",
        elements: [],
        forms: [],
        links: [],
        discoveredAt: new Date().toISOString(),
      });
    }

    const appMap: ApplicationMap = {
      missionId: config.id,
      baseUrl: config.targetUrl,
      pages,
      workflows: [
        {
          id: "wf_primary",
          name: "Primary User Flow",
          startingPage: config.targetUrl,
          steps: ["Open Application", "Locate Key Controls", "Execute User Action", "Verify State Transition"],
          criticality: "high",
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    // Store in Project Memory for future missions
    if (config.projectId) {
      const projMem = agentMemory.getProjectMemory(config.projectId);
      projMem.applicationMap = appMap;
      projMem.knownWorkflows = appMap.workflows.map((w) => w.name);
      agentMemory.saveProjectMemory(projMem);
    }

    return appMap;
  }
}
