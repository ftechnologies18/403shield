import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { fixupPluginRules } from "@eslint/compat";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ESLint 10 a supprimé les API de contexte dépréciées (context.getFilename(),
// context.getScope(), …) que certains plugins tirés transitivement par
// eslint-config-next (react, import, jsx-a11y, …) utilisent encore.
// fixupPluginRules (@eslint/compat, outil officiel de l'équipe ESLint) les
// rétro-compatibilise de façon transparente — pass-through pur pour les
// plugins déjà conformes (typescript-eslint 8.69 supporte nativement ^10).
const retroCompatPlugins = (config) =>
  config.map((entry) => {
    if (!entry.plugins) return entry;
    const plugins = Object.fromEntries(
      Object.entries(entry.plugins).map(([name, plugin]) => [
        name,
        fixupPluginRules(plugin),
      ])
    );
    return { ...entry, plugins };
  });

const eslintConfig = retroCompatPlugins([...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    // eslint-config-next 16.4 active trois règles React Compiler supplémentaires
    // (set-state-in-effect, refs, immutability) qui flaggent d'un coup 14 sites
    // PRÉEXISTANTS (dont carousel.tsx et use-mobile.ts générés par shadcn/ui —
    // l'amont n'est pas conforme non plus). Opt-out en « warn » : la dette reste
    // visible à chaque lint sans bloquer les mises à jour de dépendances ;
    // répertoire exact et suivi consignés au CHANGELOG N°335-B.
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/refs": "warn",
    "react-hooks/immutability": "warn",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}]);

export default eslintConfig;
