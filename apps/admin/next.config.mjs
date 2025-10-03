import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    turbo: {
      rules: {
        "*.json": ["@vercel/turbo-json/parse"],
      },
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withNextIntl(config);
