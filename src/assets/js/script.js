class PomodoroTimer {
    constructor() {
        this.state = {
            mode: 'pomodoro',
            isRunning: false,
            isPaused: false,
            timeLeft: 25 * 60, // 25 minutes in seconds
            totalTime: 25 * 60,
            sessions: 0,
            totalFocusTime: 0,
            settings: {
                pomodoroTime: 25,
                shortBreakTime: 5,
                longBreakTime: 15,
                autoStart: false,
                notifications: true,
                sound: 'bell'
            }
        };

        this.todos = [];
        this.timer = null;
        this.audioContext = null;
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadTodos();
        this.setupEventListeners();
        this.updateDisplay();
        this.updateSessionDots();
        this.loadTotalFocusTime();
        this.updateTodoCount();
        this.renderTodos();
    }

    setupEventListeners() {
        // Mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        if (modeButtons.length > 0) {
            modeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchMode(btn.dataset.mode);
                });
            });
        }

        // Control buttons
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) startBtn.addEventListener('click', () => this.start());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause());
        if (resetBtn) resetBtn.addEventListener('click', () => this.reset());

        // Settings
        const settingsBtn = document.getElementById('settingsBtn');
        const closeSettings = document.getElementById('closeSettings');
        const cancelSettings = document.getElementById('cancelSettings');
        const saveSettings = document.getElementById('saveSettings');
        
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());
        if (closeSettings) closeSettings.addEventListener('click', () => this.closeSettings());
        if (cancelSettings) cancelSettings.addEventListener('click', () => this.closeSettings());
        if (saveSettings) saveSettings.addEventListener('click', () => this.saveSettings());

        // Todo functionality
        const todoToggleBtn = document.getElementById('todoToggleBtn');
        const closeTodoBtn = document.getElementById('closeTodoBtn');
        const addTodoBtn = document.getElementById('addTodoBtn');
        const todoInput = document.getElementById('todoInput');
        
        if (todoToggleBtn) todoToggleBtn.addEventListener('click', () => this.toggleTodoSidebar());
        if (closeTodoBtn) closeTodoBtn.addEventListener('click', () => this.closeTodoSidebar());
        if (addTodoBtn) addTodoBtn.addEventListener('click', () => this.addTodo());
        if (todoInput) {
            todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTodo();
                }
            });
        }

        // Close modal on overlay click
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settingsModal') {
                    this.closeSettings();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts if user is typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }
            
            if (e.code === 'Space') {
                e.preventDefault();
                this.toggleTimer();
            } else if (e.code === 'KeyR') {
                e.preventDefault();
                this.reset();
            } else if (e.code === 'KeyS') {
                e.preventDefault();
                this.openSettings();
            } else if (e.code === 'KeyT') {
                e.preventDefault();
                this.toggleTodoSidebar();
            }
        });

        // Handle page visibility changes for audio context
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    // Todo Sidebar Management
    toggleTodoSidebar() {
        const sidebar = document.getElementById('todoSidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (!sidebar || !mainContent) return;
        
        if (sidebar.classList.contains('open')) {
            this.closeTodoSidebar();
        } else {
            this.openTodoSidebar();
        }
    }

    openTodoSidebar() {
        const sidebar = document.getElementById('todoSidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (!sidebar || !mainContent) return;
        
        sidebar.classList.add('open');
        mainContent.classList.add('shifted');
        
        // Focus on input when opening
        setTimeout(() => {
            const todoInput = document.getElementById('todoInput');
            if (todoInput) todoInput.focus();
        }, 300);
    }

    closeTodoSidebar() {
        const sidebar = document.getElementById('todoSidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (!sidebar || !mainContent) return;
        
        sidebar.classList.remove('open');
        mainContent.classList.remove('shifted');
    }

    // Todo Management
    addTodo() {
        const input = document.getElementById('todoInput');
        if (!input) return;
        
        const text = input.value.trim();
        
        if (text) {
            const todo = {
                id: Date.now(),
                text: text,
                completed: false,
                createdAt: new Date().toISOString()
            };
            
            this.todos.push(todo);
            this.saveTodos();
            this.renderTodos();
            this.updateTodoCount();
            
            input.value = '';
            input.focus();
            
            this.showNotification('Task added!', 'success');
        }
    }

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveTodos();
            this.renderTodos();
            this.updateTodoCount();
        }
    }

    deleteTodo(id) {
        const todoElement = document.querySelector(`[data-todo-id="${id}"]`);
        if (todoElement) {
            todoElement.classList.add('removing');
            setTimeout(() => {
                this.todos = this.todos.filter(t => t.id !== id);
                this.saveTodos();
                this.renderTodos();
                this.updateTodoCount();
            }, 300);
        }
    }

    renderTodos() {
        const todoList = document.getElementById('todoList');
        const completedCount = document.getElementById('completedCount');
        const remainingCount = document.getElementById('remainingCount');
        
        if (!todoList) return;
        
        // Clear existing todos
        todoList.innerHTML = '';
        
        // Render each todo
        this.todos.forEach(todo => {
            const todoElement = this.createTodoElement(todo);
            todoList.appendChild(todoElement);
        });
        
        // Update stats
        const completed = this.todos.filter(t => t.completed).length;
        const remaining = this.todos.length - completed;
        
        if (completedCount) completedCount.textContent = completed;
        if (remainingCount) remainingCount.textContent = remaining;
        
        // Show empty state if no todos
        if (this.todos.length === 0) {
            todoList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <p>No tasks yet. Add your first task above!</p>
                </div>
            `;
        }
    }

    createTodoElement(todo) {
        const todoElement = document.createElement('div');
        todoElement.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        todoElement.dataset.todoId = todo.id;
        
        todoElement.innerHTML = `
            <button class="todo-checkbox" onclick="pomodoroApp.toggleTodo(${todo.id})">
                ${todo.completed ? '<i class="fas fa-check"></i>' : ''}
            </button>
            <span class="todo-text">${this.escapeHtml(todo.text)}</span>
            <button class="todo-delete-btn" onclick="pomodoroApp.deleteTodo(${todo.id})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        return todoElement;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateTodoCount() {
        const countElement = document.getElementById('todoCount');
        if (!countElement) return;
        
        const remainingTodos = this.todos.filter(t => !t.completed).length;
        countElement.textContent = remainingTodos;
        
        // Hide count if no todos
        if (remainingTodos === 0) {
            countElement.style.display = 'none';
        } else {
            countElement.style.display = 'block';
        }
    }

    loadTodos() {
        try {
            const saved = localStorage.getItem('todos');
            if (saved) {
                this.todos = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading todos:', error);
            this.todos = [];
        }
    }

    saveTodos() {
        try {
            localStorage.setItem('todos', JSON.stringify(this.todos));
        } catch (error) {
            console.error('Error saving todos:', error);
        }
    }

    switchMode(mode) {
        // Stop timer if running
        if (this.state.isRunning) {
            this.stopTimer();
            this.state.isRunning = false;
            this.state.isPaused = false;
        }

        this.state.mode = mode;
        this.updateModeButtons();
        this.resetTimer();
        this.updateDisplay();
        this.updateControlButtons();
    }

    updateModeButtons() {
        const modeButtons = document.querySelectorAll('.mode-btn');
        if (modeButtons.length === 0) return;
        
        modeButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeButton = document.querySelector(`[data-mode="${this.state.mode}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    resetTimer() {
        switch (this.state.mode) {
            case 'pomodoro':
                this.state.timeLeft = Math.max(1, this.state.settings.pomodoroTime * 60);
                this.state.totalTime = Math.max(1, this.state.settings.pomodoroTime * 60);
                break;
            case 'shortBreak':
                this.state.timeLeft = Math.max(1, this.state.settings.shortBreakTime * 60);
                this.state.totalTime = Math.max(1, this.state.settings.shortBreakTime * 60);
                break;
            case 'longBreak':
                this.state.timeLeft = Math.max(1, this.state.settings.longBreakTime * 60);
                this.state.totalTime = Math.max(1, this.state.settings.longBreakTime * 60);
                break;
        }
    }

    start() {
        if (!this.state.isRunning) {
            this.state.isRunning = true;
            this.state.isPaused = false;
            this.updateControlButtons();
            this.startTimer();
        }
    }

    pause() {
        if (this.state.isRunning) {
            this.state.isRunning = false;
            this.state.isPaused = true;
            this.updateControlButtons();
            this.stopTimer();
        }
    }

    toggleTimer() {
        if (this.state.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    }

    reset() {
        this.stopTimer();
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.resetTimer();
        this.updateDisplay();
        this.updateControlButtons();
        this.updateProgressRing();
    }

    startTimer() {
        // Clear any existing timer first
        this.stopTimer();
        
        this.timer = setInterval(() => {
            this.state.timeLeft--;
            
            // Ensure time doesn't go negative
            if (this.state.timeLeft < 0) {
                this.state.timeLeft = 0;
            }
            
            this.updateDisplay();
            this.updateProgressRing();

            if (this.state.timeLeft <= 0) {
                this.handleTimerComplete();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    handleTimerComplete() {
        this.stopTimer();
        this.playSound();
        this.showNotification();

        if (this.state.mode === 'pomodoro') {
            this.state.sessions++;
            this.state.totalFocusTime += this.state.settings.pomodoroTime;
            this.saveTotalFocusTime();
            this.updateSessionDots();

            if (this.state.sessions % 4 === 0) {
                this.switchMode('longBreak');
            } else {
                this.switchMode('shortBreak');
            }

            if (this.state.settings.autoStart) {
                setTimeout(() => this.start(), 1000);
            }
        } else {
            this.switchMode('pomodoro');
            if (this.state.settings.autoStart) {
                setTimeout(() => this.start(), 1000);
            }
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.state.timeLeft / 60);
        const seconds = this.state.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timeLeftElement = document.getElementById('timeLeft');
        const totalTimeElement = document.getElementById('totalTime');
        const modeLabelElement = document.getElementById('modeLabel');
        
        if (timeLeftElement) timeLeftElement.textContent = timeString;
        if (totalTimeElement) totalTimeElement.textContent = this.formatTime(this.state.totalFocusTime);
        
        // Update page title
        document.title = `${timeString} - Pomodoro Strike`;

        // Update mode label
        const modeLabels = {
            pomodoro: 'Focus Time',
            shortBreak: 'Short Break',
            longBreak: 'Long Break'
        };
        
        if (modeLabelElement) {
            modeLabelElement.textContent = modeLabels[this.state.mode] || 'Focus Time';
        }
    }

    updateProgressRing() {
        const progressRing = document.querySelector('.progress-ring-fill');
        if (!progressRing) return;
        
        const circumference = 2 * Math.PI * 140;
        const progress = this.state.totalTime > 0 ? 1 - (this.state.timeLeft / this.state.totalTime) : 0;
        const offset = circumference - (progress * circumference);
        
        progressRing.style.strokeDasharray = circumference;
        progressRing.style.strokeDashoffset = offset;
    }

    updateControlButtons() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');

        if (!startBtn || !pauseBtn) return;

        if (this.state.isRunning) {
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'flex';
        } else {
            startBtn.style.display = 'flex';
            pauseBtn.style.display = 'none';
        }
    }

    updateSessionDots() {
        const dots = document.querySelectorAll('.session-dot');
        if (dots.length === 0) return;
        
        dots.forEach((dot, index) => {
            if (index < this.state.sessions) {
                dot.classList.add('completed');
            } else {
                dot.classList.remove('completed');
            }
        });
    }

    openSettings() {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.classList.add('active');
            this.populateSettingsForm();
        }
    }

    closeSettings() {
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.classList.remove('active');
        }
    }

    populateSettingsForm() {
        const pomodoroTimeInput = document.getElementById('pomodoroTime');
        const shortBreakTimeInput = document.getElementById('shortBreakTime');
        const longBreakTimeInput = document.getElementById('longBreakTime');
        const autoStartInput = document.getElementById('autoStart');
        const notificationsInput = document.getElementById('notifications');
        const soundInput = document.getElementById('sound');
        
        if (pomodoroTimeInput) pomodoroTimeInput.value = this.state.settings.pomodoroTime;
        if (shortBreakTimeInput) shortBreakTimeInput.value = this.state.settings.shortBreakTime;
        if (longBreakTimeInput) longBreakTimeInput.value = this.state.settings.longBreakTime;
        if (autoStartInput) autoStartInput.checked = this.state.settings.autoStart;
        if (notificationsInput) notificationsInput.checked = this.state.settings.notifications;
        if (soundInput) soundInput.value = this.state.settings.sound;
    }

    saveSettings() {
        const pomodoroTimeInput = document.getElementById('pomodoroTime');
        const shortBreakTimeInput = document.getElementById('shortBreakTime');
        const longBreakTimeInput = document.getElementById('longBreakTime');
        const autoStartInput = document.getElementById('autoStart');
        const notificationsInput = document.getElementById('notifications');
        const soundInput = document.getElementById('sound');
        
        if (!pomodoroTimeInput || !shortBreakTimeInput || !longBreakTimeInput) {
            this.showNotification('Settings form not found!', 'error');
            return;
        }
        
        // Validate input values
        const pomodoroTime = Math.max(1, Math.min(60, parseInt(pomodoroTimeInput.value) || 25));
        const shortBreakTime = Math.max(1, Math.min(30, parseInt(shortBreakTimeInput.value) || 5));
        const longBreakTime = Math.max(1, Math.min(60, parseInt(longBreakTimeInput.value) || 15));
        
        this.state.settings.pomodoroTime = pomodoroTime;
        this.state.settings.shortBreakTime = shortBreakTime;
        this.state.settings.longBreakTime = longBreakTime;
        this.state.settings.autoStart = autoStartInput ? autoStartInput.checked : false;
        this.state.settings.notifications = notificationsInput ? notificationsInput.checked : true;
        this.state.settings.sound = soundInput ? soundInput.value : 'bell';

        try {
            localStorage.setItem('pomodoroSettings', JSON.stringify(this.state.settings));
            this.resetTimer();
            this.updateDisplay();
            this.closeSettings();
            this.showNotification('Settings saved!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Failed to save settings!', 'error');
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('pomodoroSettings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                this.state.settings = { ...this.state.settings, ...loadedSettings };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    saveTotalFocusTime() {
        try {
            const today = new Date().toDateString();
            const saved = localStorage.getItem('totalFocusTime') || '{}';
            const data = JSON.parse(saved);
            data[today] = this.state.totalFocusTime;
            localStorage.setItem('totalFocusTime', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving total focus time:', error);
        }
    }

    loadTotalFocusTime() {
        try {
            const today = new Date().toDateString();
            const saved = localStorage.getItem('totalFocusTime') || '{}';
            const data = JSON.parse(saved);
            this.state.totalFocusTime = data[today] || 0;
            this.updateDisplay();
        } catch (error) {
            console.error('Error loading total focus time:', error);
            this.state.totalFocusTime = 0;
        }
    }

    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    playSound() {
        if (this.state.settings.sound === 'none') return;

        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Different sounds for different modes
            const frequencies = {
                bell: [800, 1000, 1200],
                chime: [523, 659, 784],
                digital: [440, 880]
            };

            const freq = frequencies[this.state.settings.sound] || frequencies.bell;
            let currentTime = this.audioContext.currentTime;

            freq.forEach((frequency, index) => {
                oscillator.frequency.setValueAtTime(frequency, currentTime + index * 0.1);
                gainNode.gain.setValueAtTime(0.3, currentTime + index * 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + index * 0.1 + 0.2);
            });

            oscillator.start(currentTime);
            oscillator.stop(currentTime + freq.length * 0.1 + 0.2);
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    }

    showNotification(message = null, type = 'timer') {
        if (!this.state.settings.notifications) return;

        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        if (!notification || !notificationText) return;

        const messages = {
            timer: this.state.mode === 'pomodoro' ? 'Focus session complete!' : 'Break time is over!',
            success: 'Settings saved!',
            error: 'Something went wrong!'
        };

        notificationText.textContent = message || messages[type];
        
        // Update notification color based on type
        notification.className = `notification ${type}`;
        
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    cleanup() {
        this.stopTimer();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Initialize the app when DOM is loaded
let pomodoroApp;
document.addEventListener('DOMContentLoaded', () => {
    pomodoroApp = new PomodoroTimer();
});