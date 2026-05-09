import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Proxima Cursor Help',
  tagline: 'User guides for managing WooCommerce stores in Proxima Cursor',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://wiki-pi-blue.vercel.app',
  baseUrl: '/',

  organizationName: 'chethan9',
  projectName: 'proxemaCursor',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/chethan9/proxemaCursor/edit/main/documentation/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo.svg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Proxima Cursor',
      logo: {
        alt: 'Proxima Cursor',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Help Center',
        },
        {
          href: 'https://github.com/chethan9/proxemaCursor',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Help',
          items: [
            {
              label: 'Get started',
              to: '/docs/getting-started',
            },
            {
              label: 'Troubleshooting',
              to: '/docs/troubleshooting',
            },
          ],
        },
        {
          title: 'Repository',
          items: [
            {
              label: 'Proxima Cursor on GitHub',
              href: 'https://github.com/chethan9/proxemaCursor',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Proxima Cursor. Documentation for end users.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
