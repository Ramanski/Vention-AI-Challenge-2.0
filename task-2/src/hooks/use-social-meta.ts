import { useEffect } from "react";

type SocialMeta = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  type?: string;
};

function setMeta(selector: string, attr: string, name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Lightweight client-side updater for OG/Twitter social preview tags.
 * Updates on data change and restores previous values on unmount.
 */
export function useSocialMeta({ title, description, image, type = "website" }: SocialMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const entries: Array<[string, string, string, string]> = [];
    if (title) {
      entries.push([`meta[property="og:title"]`, "property", "og:title", title]);
      entries.push([`meta[name="twitter:title"]`, "name", "twitter:title", title]);
    }
    if (description) {
      entries.push([`meta[name="description"]`, "name", "description", description]);
      entries.push([`meta[property="og:description"]`, "property", "og:description", description]);
      entries.push([`meta[name="twitter:description"]`, "name", "twitter:description", description]);
    }
    if (image) {
      entries.push([`meta[property="og:image"]`, "property", "og:image", image]);
      entries.push([`meta[name="twitter:image"]`, "name", "twitter:image", image]);
    }
    entries.push([`meta[property="og:type"]`, "property", "og:type", type]);
    entries.push([`meta[name="twitter:card"]`, "name", "twitter:card", "summary_large_image"]);

    for (const [sel, attr, name, content] of entries) {
      setMeta(sel, attr, name, content);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, image, type]);
}
