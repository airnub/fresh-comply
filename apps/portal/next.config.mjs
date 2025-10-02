import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    typedRoutes: true
  }
};

export default withNextIntl(config);
