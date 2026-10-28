/* Lightweight platform metadata. Layout decisions remain CSS-driven. */
(function () {
  const root = document.documentElement;
  const nav = navigator;
  const platform = (nav.userAgentData && nav.userAgentData.platform) || nav.platform || "";
  const ua = nav.userAgent || "";
  const isMobile = window.matchMedia("(max-width: 700px)");
  function detectOS() {
    if (/Windows/i.test(platform + " " + ua)) return "win";
    if (/Macintosh|MacIntel|macOS|iPhone|iPad|iPod/i.test(platform + " " + ua)) return "mac";
    if (/Android/i.test(platform + " " + ua)) return "android";
    if (/Linux/i.test(platform + " " + ua)) return "linux";
    return "other";
  }
  function update() { root.dataset.view = isMobile.matches ? "mobile" : "desktop"; }
  root.dataset.os = detectOS();
  update();
  if (isMobile.addEventListener) isMobile.addEventListener("change", update);
  else if (isMobile.addListener) isMobile.addListener(update);
})();
