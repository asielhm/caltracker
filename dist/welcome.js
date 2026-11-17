import { initLanguage } from "./i18n.js";
import { hydrateIcons } from "./ui.js";
hydrateIcons();
initLanguage();
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
if (!reduced.matches) {
  document.querySelector(".hero-copy").animate(
    [
      { opacity: 0, transform: "translateY(16px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.animate(
            [
              { opacity: 0, transform: "translateY(18px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
          observer.unobserve(entry.target);
        }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}
