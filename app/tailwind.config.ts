import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "selector", // key to making manual toggle work
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                gold: "var(--brand-gold)",
                "gold-light": "var(--brand-gold-light)",
                "gold-dark": "var(--brand-gold-dark)",
                metal: "var(--brand-metal)",
                "metal-dark": "var(--brand-metal-dark)",
            },
        },
    },
    plugins: [],
};
export default config;
