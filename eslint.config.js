const globals = require('globals');
const pluginJs = require('@eslint/js');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['042_reference/', '**/node_modules/']
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        L: 'readonly',
        leafletMap: 'writable',
        leafletGeoJsonLayer: 'writable',
        leafletHeatLayer: 'writable',
        currentMapMode: 'writable',
        leafletBaseLayer: 'writable',
        updateLeafletMapPoints: 'writable',
        setMapTime: 'writable'
      },
      ecmaVersion: 12,
      sourceType: 'module'
    }
  },
  pluginJs.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'warn',
      'no-useless-escape': 'off'
    }
  }
];
