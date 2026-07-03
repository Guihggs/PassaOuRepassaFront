/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta extraída da identidade "Semana Demá PR²"
        night: "#0A1730",            // fundo principal (azul quase preto)
        panel: "rgba(16, 32, 68, 0.78)", // cartões translúcidos (deixam o logo de fundo aparecer)
        volt: "#DC1E2A",             // vermelho da marca (ação/destaque principal)
        cyan: "#3E7BFF",             // azul da marca (destaque secundário)
        magenta: "#FF4D6D",          // acento extra (rosa/vermelho vivo)
        brandBlue: "#0D3F94",
        brandBlueLight: "#3E7BFF",
        brandRed: "#DC1E2A",
        brandRedLight: "#FF4D5E",
      },
      fontFamily: {
        display: ["'Baloo 2'", "'Fredoka'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      backgroundImage: {
        "brand-radial": "radial-gradient(circle at 20% -10%, #123B85 0%, #0A1730 55%)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0px 0px rgba(220,30,42,0.5)" },
          "50%": { boxShadow: "0 0 40px 12px rgba(220,30,42,0.5)" },
        },
        popIn: {
          "0%": { transform: "scale(0.7)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 1.4s ease-in-out infinite",
        popIn: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
};
