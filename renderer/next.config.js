/** @type {import('next').NextConfig} */
const nextConfig = {
  // Using middleware; disable static export
  distDir: process.env.NODE_ENV === 'production' ? '../app' : '.next',
  reactStrictMode: false,
}

module.exports = nextConfig
