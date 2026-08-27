import { useTheme } from "../context/ThemeContext";

/**
 * Categorical series colors.
 *
 * These are the first three slots of a palette validated for colour-vision
 * deficiency against both surfaces (worst all-pairs deltaE 9.2 light / 9.4 dark).
 * They are not interchangeable with the UI accent: series identity must stay
 * stable whatever the theme, so both modes are explicit steps of the same hues.
 */
const SERIES = {
  light: ["#2a78d6", "#eb6834", "#1baf7a"],
  dark: ["#3987e5", "#d95926", "#199e70"],
};

export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  return {
    series: dark ? SERIES.dark : SERIES.light,
    grid: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    axis: dark ? "#6c7083" : "#8c92a5",
    surface: dark ? "#1a1a24" : "#ffffff",
    border: dark ? "#272734" : "#e2e4eb",
  };
}
