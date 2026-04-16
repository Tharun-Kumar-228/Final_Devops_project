// Initialize CodeMirror Editor
const editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
    mode: 'javascript',
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 4,
    lineWrapping: true
});

// Initialize Socket.io
const socket = io();
const roomId = window.location.pathname.substring(1) || 'default';

// UI Elements
const connectionStatus = document.getElementById('connectionStatus');
const connectionText = document.getElementById('connectionText');
const todoInput = document.getElementById('todoInput');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoList = document.getElementById('todoList');

// Connection Status
socket.on('connect', () => {
    socket.emit('join_room', roomId);
    connectionStatus.classList.add('connected');
    connectionText.textContent = 'Connected (/' + roomId + ')';
});

socket.on('disconnect', () => {
    connectionStatus.classList.remove('connected');
    connectionText.textContent = 'Disconnected';
});

// Avoid infinite loops by tracking if we are updating from server
let isApplyingServerChange = false;

// Socket Events
socket.on('init', (data) => {
    isApplyingServerChange = true;
    editor.setValue(data.sharedCode);
    isApplyingServerChange = false;
    renderTodos(data.todos);
});

socket.on('code_update', (newCode) => {
    // Only update if it's different to prevent resetting cursor unnecessarily
    if (editor.getValue() !== newCode) {
        isApplyingServerChange = true;
        const cursor = editor.getCursor(); 
        editor.setValue(newCode);
        editor.setCursor(cursor); // Try to maintain cursor position
        isApplyingServerChange = false;
    }
});

socket.on('todo_update', (todos) => {
    renderTodos(todos);
});

// Editor Change Event
editor.on('change', (instance, changeObj) => {
    // If the change came from the user (not from socket update), emit it!
    if (!isApplyingServerChange && changeObj.origin !== 'setValue') {
        socket.emit('code_change', instance.getValue());
    }
});

// To-Do Logic
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function handleAddTodo() {
    const text = todoInput.value.trim();
    if (text) {
        const newTodo = {
            id: generateId(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };
        socket.emit('add_todo', newTodo);
        todoInput.value = '';
    }
}

addTodoBtn.addEventListener('click', handleAddTodo);

todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAddTodo();
    }
});

// Render logic
function renderTodos(todos) {
    todoList.innerHTML = '';
    
    if (todos.length === 0) {
        todoList.innerHTML = '<li style="text-align:center; color: var(--text-muted); padding: 1rem;">No tasks yet. Add one above!</li>';
        return;
    }
    
    // Sort so completed are at the bottom
    const sortedTodos = [...todos].sort((a, b) => {
        if (a.completed === b.completed) return new Date(b.createdAt) - new Date(a.createdAt);
        return a.completed ? 1 : -1;
    });

    sortedTodos.forEach(todo => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <div class="todo-content" onclick="toggleTodo('${todo.id}')">
                <div class="checkbox"></div>
                <span class="todo-text">${escapeHtml(todo.text)}</span>
            </div>
            <button class="delete-btn" onclick="removeTodo('${todo.id}')" title="Delete task">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
        `;
        todoList.appendChild(li);
    });
}

// Global functions for inline onclick handlers
window.toggleTodo = (id) => {
    socket.emit('toggle_todo', id);
};

window.removeTodo = (id) => {
    socket.emit('remove_todo', id);
};

// Utils
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
