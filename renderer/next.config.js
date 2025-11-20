/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',
  reactStrictMode: false,
}

module.exports = nextConfig
