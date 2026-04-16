const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store sessions in memory
// sessions[roomId] = { sharedCode, todos, lastUsed: Date.now() }
const sessions = {};
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Cleanup interval (runs every 1 hour)
setInterval(() => {
    const now = Date.now();
    for (const [roomId, data] of Object.entries(sessions)) {
        if (now - data.lastUsed > EXPIRY_TIME) {
            delete sessions[roomId];
            console.log(`Cleaned up expired session: ${roomId}`);
        }
    }
}, 60 * 60 * 1000);

// Root path redirects to a random new room
app.get('/', (req, res) => {
    const randomId = Math.random().toString(36).substring(2, 8);
    res.redirect(`/${randomId}`);
});

// Serve assets like style.css and app.js correctly for all routes
app.use(express.static(path.join(__dirname, 'public')));

// Any other /:roomId route serves the main application
app.get('/:roomId', (req, res) => {
    // If we request a file that isn't matched by express.static, just send index.html
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io logic
io.on('connection', (socket) => {
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;

        if (!sessions[roomId]) {
            sessions[roomId] = {
                sharedCode: '// Welcome to CollabEditor!\n// Start typing to share code with others in real-time.\n',
                todos: [],
                lastUsed: Date.now()
            };
        } else {
            sessions[roomId].lastUsed = Date.now(); // Update last used time
        }

        // Send current room state to newly connected client
        socket.emit('init', sessions[roomId]);
    });

    socket.on('code_change', (newCode) => {
        const roomId = socket.roomId;
        if (!roomId || !sessions[roomId]) return;
        
        sessions[roomId].sharedCode = newCode;
        sessions[roomId].lastUsed = Date.now();
        socket.to(roomId).emit('code_update', newCode);
    });

    // Handle To-Do list events
    socket.on('add_todo', (todo) => {
        const roomId = socket.roomId;
        if (!roomId || !sessions[roomId]) return;

        sessions[roomId].todos.push(todo);
        sessions[roomId].lastUsed = Date.now();
        io.to(roomId).emit('todo_update', sessions[roomId].todos);
    });

    socket.on('toggle_todo', (id) => {
        const roomId = socket.roomId;
        if (!roomId || !sessions[roomId]) return;

        const todo = sessions[roomId].todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            sessions[roomId].lastUsed = Date.now();
            io.to(roomId).emit('todo_update', sessions[roomId].todos);
        }
    });

    socket.on('remove_todo', (id) => {
        const roomId = socket.roomId;
        if (!roomId || !sessions[roomId]) return;

        sessions[roomId].todos = sessions[roomId].todos.filter(t => t.id !== id);
        sessions[roomId].lastUsed = Date.now();
        io.to(roomId).emit('todo_update', sessions[roomId].todos);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
