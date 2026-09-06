// @ts-check

import configs from "@jiminp/eslint-config";
export default [
    ...configs,
    {
        files: ['static/assets/*.js'],
        languageOptions: {
            globals: {
                document: 'readonly', location: 'readonly', fetch: 'readonly',
                URL: 'readonly', AbortController: 'readonly',
            },
        },
    },
];
