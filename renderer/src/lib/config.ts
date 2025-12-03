export const APP_CONFIG = {
  name: "Cursor Learn",
  version: "0.1.0",
  description: "An agentic coding companion built to help you learn and explore AI-assisted development. Designed with simplicity and extensibility in mind.",
  logo: "⁕",
  tagline: "Made with ❤️ for the curious",
  techStack: ["Next.js", "Electron", "TypeScript", "Tailwind CSS", "Zustand"],
} as const

export const getVersionString = () => `${APP_CONFIG.name} v${APP_CONFIG.version}`
export const getShortVersionString = () => `v${APP_CONFIG.version}`
