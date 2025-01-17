import { AvLog } from '../../dist/av-log';

// Create a logger with all features enabled
const log = new AvLog({ logLevel: 1, logTime: true, logWithType: true });

// Basic logging
function demoBasicLogging() {
    log.tfi('demoBasicLogging');

    log.tf('Basic log message');
    log.tfc('Custom log message');
    log.tfw('Warning message');
    log.tfe('Error message');

    const data = [
        { type: 'users', value: ['Alice', 'Bob'] },
        { type: 'count', value: 2 },
    ];
    log.tft(data);

    log.tfo('demoBasicLogging');
}

// Async operation demo
async function demoAsyncOperations() {
    const opId = log.tfia('demoAsyncOperations');

    // Simulate some async work
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Nested async operation
    const nestedOpId = log.tfia('fetchUserData', { userId: 123 });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    log.tfoa('fetchUserData', nestedOpId, { name: 'Alice', age: 30 });

    // Complete outer operation
    log.tfoa('demoAsyncOperations', opId, 'All operations completed');
}

// Function call tracking
function demoNestedFunctions(depth: number = 3) {
    log.tfi('demoNestedFunctions', depth);

    if (depth > 0) {
        demoNestedFunctions(depth - 1);
    }

    log.tfo('demoNestedFunctions');
}

// Concurrent async operations
async function demoConcurrentOperations() {
    const operations = ['op1', 'op2', 'op3'].map(async (op) => {
        const opId = log.tfia('asyncOperation', op);
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000));
        log.tfoa('asyncOperation', opId, `${op} completed`);
    });

    await Promise.all(operations);
}

// Run all demos
async function runDemos() {
    log.tfi('runDemos');

    log.tf('Starting demos at ' + new Date().toLocaleString());

    // Run basic logging demo
    demoBasicLogging();

    // Run async demos
    await demoAsyncOperations();
    await demoConcurrentOperations();

    // Run nested functions demo
    demoNestedFunctions();

    // Check for any unclosed functions
    log.checkUnclosedFunctions();

    log.tfo('runDemos');
}

// Start the demos
runDemos().catch((error) => {
    log.tfe('Demo failed:', error);
});
