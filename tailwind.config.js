/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./contexts/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#6366f1',
                secondary: '#0f172a',
                accent: '#fca5a5',
                highlight: '#fef08a',
                background: '#fffbeb',
                surface: '#ffffff',
            },
            boxShadow: {
                'neo': '6px 6px 0px 0px rgba(15, 23, 42, 1)',
                'neo-sm': '3px 3px 0px 0px rgba(15, 23, 42, 1)',
                'neo-lg': '10px 10px 0px 0px rgba(15, 23, 42, 1)',
            },
            borderWidth: {
                '3': '3px',
            }
        },
    },
    plugins: [],
}
