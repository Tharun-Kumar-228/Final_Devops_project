const http = require('http');
const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://127.0.0.1:3000';
let passCount = 0;
let failCount = 0;

// ANSI Colors for neat console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function logTest(name, success, errorMsg = '') {
    if (success) {
        console.log(`${colors.green}✔ [PASS]${colors.reset} ${name}`);
        passCount++;
    } else {
        console.log(`${colors.red}✖ [FAIL]${colors.reset} ${name}`);
        if(errorMsg) console.log(`   ${colors.yellow}↳ ${errorMsg}${colors.reset}`);
        failCount++;
    }
}

async function runTests() {
    console.log(`${colors.cyan}--- Starting API & WebSocket Tests ---${colors.reset}\n`);

    // 1. Test GET / (Redirects to random room)
    await new Promise((resolve) => {
        http.get(SERVER_URL + '/', (res) => {
            try {
                assert.strictEqual(res.statusCode, 302, 'Expected status code 302 for redirect');
                assert.ok(res.headers.location, 'Expected location header for redirect');
                logTest('GET / should redirect to a random room code', true);
            } catch (err) {
                logTest('GET / should redirect to a random room code', false, err.message);
            }
            resolve();
        }).on('error', (err) => {
            logTest('GET / should redirect to a random room code', false, err.message);
            resolve();
        });
    });

    // 2. Test GET /:roomId (Serves index.html)
    const testRoom = 'automated_test_room';
    
    await new Promise((resolve) => {
        http.get(SERVER_URL + '/' + testRoom, (res) => {
            try {
                assert.strictEqual(res.statusCode, 200, 'Expected status code 200');
                assert.ok(res.headers['content-type'].includes('text/html'), 'Expected content-type to be HTML');
                logTest(`GET /${testRoom} should serve the TaskCode web application`, true);
            } catch (err) {
                logTest(`GET /${testRoom} should serve the TaskCode web application`, false, err.message);
            }
            resolve();
        }).on('error', (err) => {
            logTest(`GET /${testRoom} should serve the TaskCode web application`, false, err.message);
            resolve();
        });
    });

    // 3. Test WebSockets
    console.log(`\n${colors.cyan}--- Starting WebSocket Logic Tests ---${colors.reset}\n`);
    
    const client1 = io(SERVER_URL);
    const client2 = io(SERVER_URL);
    
    // Wait for both to connect
    await Promise.all([
        new Promise(r => client1.on('connect', r)),
        new Promise(r => client2.on('connect', r))
    ]);
    
    logTest('Socket connected successfully', true);

    // Test joining room and receiving init event
    await new Promise((resolve) => {
        client1.emit('join_room', testRoom);
        client1.once('init', (data) => {
            try {
                assert.ok(data.sharedCode, 'Missing sharedCode in init data');
                assert.ok(Array.isArray(data.todos), 'todos should be an array');
                logTest('Client 1 joined room and received initial session state', true);
            } catch (err) {
                logTest('Client 1 joined room and received initial session state', false, err.message);
            }
            resolve();
        });
    });

    // Have second client join the exact same room
    await new Promise((resolve) => {
        client2.emit('join_room', testRoom);
        // Using setTimeout to give client2 enough time to establish room context server-side
        setTimeout(resolve, 300); 
    });

    // Test code update mechanism
    await new Promise((resolve) => {
        const testCode = 'console.log("automated test executed successfully.");';
        
        client2.once('code_update', (newCode) => {
            try {
                assert.strictEqual(newCode, testCode, 'Received code completely mismatched');
                logTest('Broadcast "code_update" to other active clients in the session successfully', true);
            } catch(e) {
                logTest('Broadcast "code_update" to other active clients in the session successfully', false, e.message);
            }
            resolve();
        });
        
        // Client1 emits a code change
        client1.emit('code_change', testCode);
        
        // Fallback Timeout if event is not received
        setTimeout(() => { 
            logTest('Broadcast "code_update" to other active clients in the session successfully', false, 'Event timeout reached');
            resolve(); 
        }, 1500);
    });

    // Test add_todo mechanism
    let createdTodoId;
    await new Promise((resolve) => {
        const fakeTodo = { id: 'todo123', text: 'Test automation script task', completed: false, createdAt: new Date().toISOString() };
        createdTodoId = fakeTodo.id;
        
        client2.once('todo_update', (todos) => {
            try {
                const found = todos.find(t => t.id === fakeTodo.id);
                assert.ok(found, 'New todo missing in broadcasted list segment');
                logTest('Broadcast "add_todo" newly added task in real-time successfully', true);
            } catch(e) {
                logTest('Broadcast "add_todo" newly added task in real-time successfully', false, e.message);
            }
            resolve();
        });
        
        client1.emit('add_todo', fakeTodo);
        setTimeout(() => { resolve(); }, 1500);
    });
    
    // Test toggle_todo mechanism
    await new Promise((resolve) => {
        client2.once('todo_update', (todos) => {
            try {
                const found = todos.find(t => t.id === createdTodoId);
                assert.strictEqual(found.completed, true, 'Task completed status not fully toggled');
                logTest('Broadcast "toggle_todo" task status updates successfully', true);
            } catch(e) {
                logTest('Broadcast "toggle_todo" task status updates successfully', false, e.message);
            }
            resolve();
        });
        
        client1.emit('toggle_todo', createdTodoId);
        setTimeout(() => { resolve(); }, 1500);
    });

    // Test remove_todo mechanism
    await new Promise((resolve) => {
        client2.once('todo_update', (todos) => {
             try {
                const found = todos.find(t => t.id === createdTodoId);
                assert.ok(!found, 'Task was not fully removed from the broadcast list');
                logTest('Broadcast "remove_todo" deleted task events to everyone seamlessly', true);
            } catch(e) {
                logTest('Broadcast "remove_todo" deleted task events to everyone seamlessly', false, e.message);
            }
            resolve();
        });
        
        client1.emit('remove_todo', createdTodoId);
        setTimeout(() => { resolve(); }, 1500);
    });

    // Teardown
    client1.disconnect();
    client2.disconnect();

    console.log(`\n${colors.cyan}--- Summary ---${colors.reset}`);
    if(failCount === 0) {
        console.log(`${colors.green}Awesome! All ${passCount} tests passed successfully without a hitch.${colors.reset}\n`);
    } else {
        console.log(`${colors.red}Found ${failCount} failing tests. (${passCount} passed)${colors.reset}\n`);
    }
    
    process.exit(failCount > 0 ? 1 : 0);
}

runTests();
