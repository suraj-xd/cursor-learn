import {
  SiTypescript,
  SiJavascript,
  SiPython,
  SiRust,
  SiGo,
  SiCplusplus,
  SiC,
  SiSharp,
  SiPhp,
  SiRuby,
  SiSwift,
  SiKotlin,
  SiDart,
  SiHtml5,
  SiCss3,
  SiSass,
  SiJson,
  SiYaml,
  SiMarkdown,
  SiDocker,
  SiGraphql,
  SiPostgresql,
  SiMysql,
  SiMongodb,
  SiReact,
  SiVuedotjs,
  SiSvelte,
  SiAngular,
  SiNodedotjs,
  SiGnubash,
} from "react-icons/si"
import type { IconType } from "react-icons"
import { cn } from "./utils"

const LANGUAGE_ICONS: Record<string, IconType> = {
  typescript: SiTypescript,
  ts: SiTypescript,
  tsx: SiTypescript,
  javascript: SiJavascript,
  js: SiJavascript,
  jsx: SiJavascript,
  python: SiPython,
  py: SiPython,
  rust: SiRust,
  rs: SiRust,
  go: SiGo,
  golang: SiGo,
  cpp: SiCplusplus,
  "c++": SiCplusplus,
  c: SiC,
  csharp: SiSharp,
  "c#": SiSharp,
  cs: SiSharp,
  php: SiPhp,
  ruby: SiRuby,
  rb: SiRuby,
  swift: SiSwift,
  kotlin: SiKotlin,
  kt: SiKotlin,
  dart: SiDart,
  html: SiHtml5,
  css: SiCss3,
  scss: SiSass,
  sass: SiSass,
  json: SiJson,
  yaml: SiYaml,
  yml: SiYaml,
  markdown: SiMarkdown,
  md: SiMarkdown,
  dockerfile: SiDocker,
  docker: SiDocker,
  graphql: SiGraphql,
  gql: SiGraphql,
  sql: SiPostgresql,
  postgres: SiPostgresql,
  postgresql: SiPostgresql,
  mysql: SiMysql,
  mongodb: SiMongodb,
  react: SiReact,
  vue: SiVuedotjs,
  svelte: SiSvelte,
  angular: SiAngular,
  node: SiNodedotjs,
  bash: SiGnubash,
  sh: SiGnubash,
  shell: SiGnubash,
  zsh: SiGnubash,
}

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: "#3178C6",
  ts: "#3178C6",
  tsx: "#3178C6",
  javascript: "#F7DF1E",
  js: "#F7DF1E",
  jsx: "#F7DF1E",
  python: "#3776AB",
  py: "#3776AB",
  rust: "#000000",
  rs: "#000000",
  go: "#00ADD8",
  golang: "#00ADD8",
  cpp: "#00599C",
  "c++": "#00599C",
  c: "#A8B9CC",
  csharp: "#239120",
  "c#": "#239120",
  cs: "#239120",
  php: "#777BB4",
  ruby: "#CC342D",
  rb: "#CC342D",
  swift: "#FA7343",
  kotlin: "#7F52FF",
  kt: "#7F52FF",
  dart: "#0175C2",
  html: "#E34F26",
  css: "#1572B6",
  scss: "#CC6699",
  sass: "#CC6699",
  json: "#000000",
  yaml: "#CB171E",
  yml: "#CB171E",
  markdown: "#000000",
  md: "#000000",
  dockerfile: "#2496ED",
  docker: "#2496ED",
  graphql: "#E10098",
  gql: "#E10098",
  sql: "#336791",
  postgres: "#336791",
  postgresql: "#336791",
  mysql: "#4479A1",
  mongodb: "#47A248",
  react: "#61DAFB",
  vue: "#4FC08D",
  svelte: "#FF3E00",
  angular: "#DD0031",
  node: "#339933",
  bash: "#4EAA25",
  sh: "#4EAA25",
  shell: "#4EAA25",
  zsh: "#4EAA25",
}

interface LanguageIconProps {
  language: string
  className?: string
  showLabel?: boolean
}

export function LanguageIcon({ language, className, showLabel = false }: LanguageIconProps) {
  const normalizedLang = language.toLowerCase().trim()
  const Icon = LANGUAGE_ICONS[normalizedLang]

  if (!Icon) {
    return null
  }

  const color = LANGUAGE_COLORS[normalizedLang] || "#6B7280"

  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <Icon className={cn("shrink-0", className)} style={{ color, fill: color }} />
      {showLabel && <span className="text-xs text-foreground font-departure uppercase tracking-wider">{language}</span>}
    </span>
  )
}

export function getLanguageIcon(language: string): IconType | null {
  const normalizedLang = language.toLowerCase().trim()
  return LANGUAGE_ICONS[normalizedLang] || null
}

export function hasLanguageIcon(language: string): boolean {
  const normalizedLang = language.toLowerCase().trim()
  return normalizedLang in LANGUAGE_ICONS
}
