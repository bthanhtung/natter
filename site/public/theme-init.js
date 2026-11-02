/* Runs before first paint (see index.html). Sets the stored theme and, for Vietnamese, the language flag. */
(function () {
  var root = document.documentElement;
  var theme = null;
  var lang = null;
  try { theme = localStorage.getItem("theme"); } catch (e) { /* system default */ }
  try { lang = localStorage.getItem("lang"); } catch (e) { /* browser language */ }
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  if (lang !== "vi" && lang !== "en") lang = /^vi/i.test(navigator.language || "") ? "vi" : "en";
  root.setAttribute("data-js", "");
  if (lang === "vi") {
    root.setAttribute("data-lang", "vi");
    root.lang = "vi";
  }
})();
