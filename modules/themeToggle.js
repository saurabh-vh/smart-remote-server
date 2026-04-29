const LIGHT_THEME = "light";
const DARK_THEME = "dark";
const THEME_STORAGE_KEY = "smart-remote-theme";

function setTheme(theme, { persist = true } = {}) {
  const isDark = theme === DARK_THEME;
  const toggleBtn = document.getElementById("themeToggleBtn");
  const toggleLabel = toggleBtn?.querySelector(".theme-toggle-label");
  const toggleIcon = toggleBtn?.querySelector("i");

  document.documentElement.setAttribute("data-theme", theme);
  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  if (!toggleBtn || !toggleLabel || !toggleIcon) return;

  toggleBtn.setAttribute("aria-pressed", String(isDark));
  toggleBtn.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode",
  );
  toggleLabel.textContent = isDark ? "Dark" : "Light";
  toggleIcon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

export function initThemeToggle() {
  const toggleBtn = document.getElementById("themeToggleBtn");
  if (!toggleBtn) return;

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme =
    savedTheme === DARK_THEME || savedTheme === LIGHT_THEME
      ? savedTheme
      : LIGHT_THEME;

  // Default light unless user previously selected and saved a theme.
  setTheme(initialTheme, { persist: false });

  toggleBtn.addEventListener("click", () => {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || LIGHT_THEME;
    const nextTheme = currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
    setTheme(nextTheme);
  });
}
