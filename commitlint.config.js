export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat', // New feature
                'fix', // Bug fix
                'docs', // Documentation
                'style', // Code style changes
                'refactor', // Code refactoring
                'perf', // Performance improvements
                'test', // Tests
                'chore', // Maintenance
                'revert', // Revert changes
                'release', // Release version
            ],
        ],
    },
};
