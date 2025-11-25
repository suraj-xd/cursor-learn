export const UI_THEMES = [
  {
    id: "retro-boy",
    name: "8 Bit Retro Boy",
    preview: ["#D9FF52", "#00FF00", "#173C0B"],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    preview: ["#007b86", "#32b9c6", "#FCFCF9"],
  },
  {
    id: "mono",
    name: "Mono",
    preview: ["#737373", "#0a0a0a", "#ffffff"],
  },
] as const

export type UiThemeId = (typeof UI_THEMES)[number]["id"]

export const COLOR_MODES = ["light", "dark", "system"] as const
export type ColorMode = (typeof COLOR_MODES)[number]

