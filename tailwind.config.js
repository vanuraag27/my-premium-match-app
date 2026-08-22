/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vk: {
          bg: '#090D24', surface: '#11152F', elevated: '#171C3B',
          primary: '#6C3CFF', primaryHover: '#8059FF', cyan: '#00D4FF',
          pink: '#FF3CAC', lavender: '#EEF0FF', muted: '#B8BED8', white: '#FFFFFF', textSecondary: '#EEF0FF', textMuted: '#B8BED8',
          success: '#22C55E', warning: '#F59E0B', error: '#EF4444', border: '#2A3155'
        }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { 'vk-sm':'8px','vk-md':'12px','vk-lg':'16px','vk-xl':'24px','vk-pill':'9999px' },
      boxShadow: {
        'vk-sm':'0 2px 8px rgba(0,0,0,.18)', 'vk-md':'0 8px 24px rgba(0,0,0,.24)',
        'vk-lg':'0 16px 48px rgba(0,0,0,.30)', 'vk-glow-cyan':'0 0 24px rgba(0,212,255,.22)',
        'vk-glow-purple':'0 0 28px rgba(108,60,255,.24)'
      },
      backgroundImage: {
        'vk-aurora':'linear-gradient(135deg,#00D4FF 0%,#6C3CFF 50%,#FF3CAC 100%)',
        'vk-purple-cyan':'linear-gradient(90deg,#6C3CFF 0%,#00D4FF 100%)',
        'vk-pink-purple':'linear-gradient(90deg,#FF3CAC 0%,#6C3CFF 100%)'
      }
    }
  },
  plugins: [],
};
