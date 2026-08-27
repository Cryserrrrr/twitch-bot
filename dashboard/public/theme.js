// Applied before first paint so the page never flashes the wrong theme.
// Kept in its own file rather than inline: the dashboard sends a strict
// content security policy, and an inline script would be refused.
try {
  var stored = localStorage.getItem("theme");
  var dark = stored ? stored === "dark" : true;
  document.documentElement.classList.toggle("dark", dark);
} catch (error) {
  // Storage unavailable: the default dark class on <html> stands.
}
