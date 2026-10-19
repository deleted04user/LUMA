import js from "@eslint/js";
import globals from "globals";

export default [
    { ignores: ["dist/**", "coverage/**", "playwright-report/**", "test-results/**", "config.js"] },
    js.configs.recommended,
    {
        files: ["**/*.{js,mjs}"],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        rules: { eqeqeq: "error", "no-var": "error", "prefer-const": "error" },
    },
];
