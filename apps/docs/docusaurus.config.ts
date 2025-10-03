import type {Config} from '@docusaurus/types';
import type {Preset} from '@docusaurus/preset-classic';

const organizationName = 'airnub';      // GitHub org/user
const projectName = 'fresh-comply';     // GitHub repo
const url = `https://${organizationName}.github.io`; // GitHub Pages host
const baseUrl = `/${projectName}/`;     // Project Pages base path

const config: Config = {
  title: 'FreshComply Docs',
  tagline: 'Live, verifiable workflows.',
  url,
  baseUrl,
  favicon: 'img/favicon.svg',
  organizationName,
  projectName,
  // gh-pages defaults:
  deploymentBranch: 'gh-pages',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          // Use root docs/ as content source
          path: '../../docs',
          routeBasePath: '/',               // make docs the homepage
          sidebarPath: './sidebars.ts',
          include: ['**/*.md', '**/*.mdx'],
          editUrl: null
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    navbar: {
      title: 'FreshComply',
      logo: { alt: 'FreshComply', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'autogen', position: 'left', label: 'Docs' },
        { href: 'https://github.com/airnub/fresh-comply', label: 'GitHub', position: 'right' }
      ]
    },
    footer: {
      style: 'dark',
      copyright: `© ${new Date().getFullYear()} Airnub`
    }
  }
};

export default config;
