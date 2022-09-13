import { defineConfig } from 'vitepress'

const nav = [
  {
    text: 'Editor Support',
    items: [
      {
        text: 'CoC Neovim',
        link: 'https://github.com/yaegassy/coc-volar',
      },
      {
        text: 'Neovim LSP',
        link: 'https://github.com/neovim/nvim-lspconfig',
      },
      {
        text: 'Vim LSP',
        link: 'https://github.com/mattn/vim-lsp-settings',
      },
      {
        text: 'Sublime',
        link: 'https://github.com/sublimelsp/LSP-volar',
      },
      {
        text: 'Atom',
        link: 'https://github.com/kabiaa/atom-ide-volar',
      },
      {
        text: 'Emacs',
        link: 'https://github.com/emacs-lsp/lsp-mode',
      },
      {
        text: 'Nova',
        link: 'https://github.com/tommasongr/nova-vue',
      },
      {
        text: 'Monaco',
        link: 'https://github.com/Kingwl/monaco-volar',
      },
    ],
  },
  {
    text: 'Sponsors',
    link: '/sponsors',
  },
  {
    text: 'Credits',
    link: '/credits',
  },
]

const sidebar = [
  {
    text: 'Vue',
    items: [
      { text: 'Installation', link: '/installation' },
      { text: 'Features', link: '/features' },
      { text: 'Takeover Mode', link: '/takeover-mode' },
      { text: 'Troubleshooting', link: '/troubleshooting' },
    ],
  }
]

export default defineConfig({
  title: 'Volar',
  lang: 'en-US',
  head: [['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]],
  description: 'Volar - Explore high-performance tooling for Vue',
  lastUpdated: true,
  themeConfig: {
    logo: '/logo.png',
    nav,
    sidebar,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/johnsoncodehk/volar' },
      { icon: 'discord', link: 'https://discord.com/invite/5bnSSSSBbK' },
    ],
    editLink: {
      pattern: 'https://github.com/johnsoncodehk/volar/blob/master/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
