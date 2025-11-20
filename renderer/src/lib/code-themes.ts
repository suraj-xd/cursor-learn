"use client"

import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { nightOwl } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { materialOceanic } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { duotoneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { solarizedDarkAtom } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ghcolors } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { synthwave84 } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { coldarkDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export const codeThemeStyles = {
  vscDarkPlus,
  nightOwl,
  dracula,
  atomDark,
  materialDark,
  materialOceanic,
  materialLight,
  oneDark,
  oneLight,
  duotoneLight,
  duotoneDark,
  solarizedlight,
  solarizedDarkAtom,
  ghcolors,
  nord,
  synthwave84,
  vs,
  a11yDark,
  coldarkDark,
} as const

export type CodeThemeId = keyof typeof codeThemeStyles

const themeMeta: Record<CodeThemeId, { label: string; preview: string[] }> = {
  vscDarkPlus: {
    label: "VS Code Dark",
    preview: ["#1e1e1e", "#569cd6", "#dcdcaa"],
  },
  nightOwl: {
    label: "Night Owl",
    preview: ["#011627", "#c792ea", "#7fdbca"],
  },
  dracula: {
    label: "Dracula",
    preview: ["#282a36", "#bd93f9", "#50fa7b"],
  },
  atomDark: {
    label: "Atom Dark",
    preview: ["#282c34", "#61dafb", "#e06c75"],
  },
  materialDark: {
    label: "Material Dark",
    preview: ["#263238", "#80cbc4", "#ff5370"],
  },
  materialOceanic: {
    label: "Material Oceanic",
    preview: ["#263238", "#c3e88d", "#82aaff"],
  },
  materialLight: {
    label: "Material Light",
    preview: ["#fafafa", "#7c4dff", "#ff5370"],
  },
  oneDark: {
    label: "One Dark",
    preview: ["#282c34", "#c678dd", "#98c379"],
  },
  oneLight: {
    label: "One Light",
    preview: ["#fafafa", "#d19a66", "#4078f2"],
  },
  duotoneLight: {
    label: "Duotone Light",
    preview: ["#faf8f5", "#b29762", "#567983"],
  },
  duotoneDark: {
    label: "Duotone Dark",
    preview: ["#2a2734", "#ffcc99", "#7fe7d0"],
  },
  solarizedlight: {
    label: "Solarized Light",
    preview: ["#fdf6e3", "#268bd2", "#859900"],
  },
  solarizedDarkAtom: {
    label: "Solarized Dark",
    preview: ["#0f1419", "#268bd2", "#b58900"],
  },
  ghcolors: {
    label: "GitHub",
    preview: ["#f6f8fa", "#005cc5", "#d73a49"],
  },
  nord: {
    label: "Nord",
    preview: ["#2e3440", "#88c0d0", "#bf616a"],
  },
  synthwave84: {
    label: "Synthwave '84",
    preview: ["#262335", "#f97e72", "#36f9f6"],
  },
  vs: {
    label: "VS Light",
    preview: ["#ffffff", "#0000ff", "#a31515"],
  },
  a11yDark: {
    label: "A11y Dark",
    preview: ["#2b2b2b", "#f08d49", "#ffcc99"],
  },
  coldarkDark: {
    label: "Coldark Dark",
    preview: ["#111b27", "#6ae9fa", "#c5c5ff"],
  },
}

export const codeThemeOptions = Object.keys(codeThemeStyles).map((id) => ({
  id: id as CodeThemeId,
  label: themeMeta[id as CodeThemeId].label,
  preview: themeMeta[id as CodeThemeId].preview,
}))

