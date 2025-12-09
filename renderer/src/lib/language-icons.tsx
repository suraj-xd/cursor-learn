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

interface LanguageIconProps {
  language: string
  className?: string
  showLabel?: boolean
}

export function LanguageIcon({ language, className, showLabel = false }: LanguageIconProps) {
  const normalizedLang = language.toLowerCase().trim()
  const Icon = LANGUAGE_ICONS[normalizedLang]

  if (Icon) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon className={className} />
        {showLabel && <span>{language}</span>}
      </span>
    )
  }

  return <span className={className}>{language}</span>
}

export function getLanguageIcon(language: string): IconType | null {
  const normalizedLang = language.toLowerCase().trim()
  return LANGUAGE_ICONS[normalizedLang] || null
}

export function hasLanguageIcon(language: string): boolean {
  const normalizedLang = language.toLowerCase().trim()
  return normalizedLang in LANGUAGE_ICONS
}
