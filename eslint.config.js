// ESLint (flat config) mit den Expo-Regeln
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".build/*", "supabase/functions/*"] },
]);
