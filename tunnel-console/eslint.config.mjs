import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { fixupPluginRules } from "@eslint/compat";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Miroir de frontend/eslint.config.mjs (rétro-compat ESLint 10 — les plugins
// tirés par eslint-config-next utilisent encore les API de contexte dépréciées).
const retroCompatPlugins = (config) =>
  config.map((entry) => {
    if (!entry.plugins) return entry;
    const plugins = Object.fromEntries(
      Object.entries(entry.plugins).map(([name, plugin]) => [name, fixupPluginRules(plugin)])
    );
    return { ...entry, plugins };
  });

const eslintConfig = retroCompatPlugins([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      // Chargement initial d'espace client : le setState au premier rendu est
      // le pattern fetch standard (miroir de la console Hotspot frontend/).
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
      "prefer-const": "off",
      "no-console": "off",
    },
  },
  { ignores: ["node_modules/**", ".next/**", "next-env.d.ts"] },
]);

export default eslintConfig;
