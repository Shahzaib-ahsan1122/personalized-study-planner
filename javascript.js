// java script

// --- Configuration (Update the API_URL if running on a different port/host) ---
const API_URL = 'http://127.0.0.1:5000';
const TOTAL_TIME_BUDGET_HOURS = 10.0;
let tasks = [];
let taskToComplete = null; 

// --- API Interaction Functions ---

/**
 * Fetches all tasks from the Python backend and updates the global tasks array.
 */
async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks from backend.');
        
        tasks = await response.json();
        renderSchedule();
    } catch (error) { 
        console.error("Error communicating with Python Backend:", error);
        // Display a user-friendly message if the backend is down
        document.getElementById('schedule-list').innerHTML = `
            <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                <p class="font-bold">Backend Connection Failed</p>
                <p>Please ensure the Flask app (app.py) is running on ${API_URL}.</p>
            </div>
        `;
    }
}

/**
 * Sends a new task to the Python backend.
 */
async function addTaskToBackend(taskData) {
    try {
        const response = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        if (!response.ok) throw new Error('Failed to add task.');
        
        // Refetch all data to update the schedule with the correct priority calculation
        await fetchTasks();
        return true;
    } catch (error) {
        console.error("Error adding task:", error);
        return false;
    }
}

/**
 * Sends completion status and actual time to the Python backend.
 */
async function completeTaskInBackend(taskId, actualTimeSpent) {
    try {
        const response = await fetch(`${API_URL}/complete_task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taskId, actual_time_spent: actualTimeSpent })
        });
        if (!response.ok) throw new Error('Failed to mark task complete.');
        
        await fetchTasks();
        return true;
    } catch (error) {
        console.error("Error completing task:", error);
        return false;
    }
}

// --- Core Utility Functions ---

/**
 * Calculates key time metrics using the currently loaded tasks.
 * The priority calculation is done entirely on the backend.
 * @returns {Object} {timeSpent, estimatedOpenEffort, budgetRemaining}
 */
function getTimeMetrics() {
    const timeSpent = tasks.reduce((sum, task) => sum + (task.actual_hours_spent || 0), 0);
    const estimatedOpenEffort = tasks.filter(t => !t.completed).reduce((sum, task) => sum + task.effort_hours, 0);
    const budgetRemaining = TOTAL_TIME_BUDGET_HOURS - timeSpent;
    return { timeSpent, estimatedOpenEffort, budgetRemaining };
}

// --- UI Rendering Functions ---

/**
 * Renders the prioritized schedule list.
 */
function renderSchedule() {
    const scheduleList = document.getElementById('schedule-list');
    const noTasksMessage = document.getElementById('no-tasks-message');
    
    const openTasks = tasks.filter(t => !t.completed);

    if (openTasks.length === 0) {
        scheduleList.innerHTML = '';
        noTasksMessage.classList.remove('hidden');
        renderBudgetStatus();
        renderStats();
        return;
    }

    noTasksMessage.classList.add('hidden');

    // The tasks array is already sorted by priority from the Python backend
    const sortedTasks = openTasks;

    // 3. Render HTML
    scheduleList.innerHTML = sortedTasks.map((task, index) => {
        // Use the priority score calculated by the backend
        const priorityScore = task.priority || 0; 

        const priorityColor = index === 0 ? 'bg-red-500 text-white font-bold' : 'bg-indigo-100 text-indigo-700';
        
        // Determine if the task is a major time sink (over 3 hours)
        const effortWarning = task.effort_hours > 3 ? 'text-red-600 font-semibold' : 'text-gray-700';
        
        return `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow transition duration-150 hover:bg-gray-100 border-l-4 border-indigo-500">
                <div class="flex items-center space-x-4 flex-grow min-w-0">
                    <!-- Priority Rank -->
                    <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${priorityColor}">
                        ${index + 1}
                    </div>
                    
                    <!-- Task Details -->
                    <div class="min-w-0 flex-grow">
                        <p class="text-lg font-semibold truncate text-gray-900">${task.name}</p>
                        <div class="text-xs text-gray-500">
                            <span class="font-medium">${task.component}</span> 
                            <span class="mx-2">•</span> 
                            Priority Score: ${priorityScore.toFixed(1)}
                        </div>
                    </div>
                </div>

                <!-- Effort and Action Button -->
                <div class="flex-shrink-0 text-right space-x-4">
                    <p class="text-sm ${effortWarning}">${task.effort_hours.toFixed(1)} hrs (Est)</p>
                    <button data-task-id="${task.id}" class="complete-btn mt-1 py-1 px-3 bg-green-500 text-white text-xs font-medium rounded-full hover:bg-green-600 transition duration-150">
                        Done? Log Time
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Re-attach event listeners after rendering
    document.querySelectorAll('.complete-btn').forEach(button => {
        button.addEventListener('click', showCompleteModal);
    });

    renderBudgetStatus();
    renderStats();
}

/**
 * Renders the budget and effort status in the header.
 */
function renderBudgetStatus() {
    const { timeSpent, estimatedOpenEffort, budgetRemaining } = getTimeMetrics();

    const budgetElement = document.getElementById('remaining-budget');
    const effortElement = document.getElementById('effort-remaining');

    budgetElement.textContent = budgetRemaining.toFixed(1);
    budgetElement.classList.remove('text-green-600', 'text-yellow-500', 'text-red-600');
    
    if (budgetRemaining >= 3) {
        budgetElement.classList.add('text-green-600');
    } else if (budgetRemaining > 0) {
        budgetElement.classList.add('text-yellow-500');
    } else {
        budgetElement.classList.add('text-red-600');
    }

    effortElement.textContent = `Estimated Open Effort: ${estimatedOpenEffort.toFixed(1)} hours`;

    // Display a warning if open effort exceeds remaining budget
    if (estimatedOpenEffort > budgetRemaining) {
        effortElement.classList.add('text-red-300', 'font-bold');
    } else {
        effortElement.classList.remove('text-red-300', 'font-bold');
    }
}

/**
 * Renders the statistics area.
 */
function renderStats() {
    const completedTasks = tasks.filter(t => t.completed);
    const totalEstimatedDone = completedTasks.reduce((sum, task) => sum + task.effort_hours, 0);
    const totalActualDone = completedTasks.reduce((sum, task) => sum + (task.actual_hours_spent || 0), 0);
    const variance = totalActualDone - totalEstimatedDone;

    document.getElementById('stat-completed').textContent = completedTasks.length;
    document.getElementById('stat-actual-time').textContent = totalActualDone.toFixed(1) + 'h';
    document.getElementById('stat-variance').textContent = (variance > 0 ? '+' : '') + variance.toFixed(1) + 'h';
    
    const varianceTip = document.getElementById('variance-tip');
    varianceTip.classList.remove('text-green-600', 'text-red-600', 'text-gray-500');

    if (variance > 0) {
        varianceTip.textContent = `You consistently under-estimate time! Adjust future bids.`;
        document.getElementById('stat-variance').classList.add('text-red-500');
        varianceTip.classList.add('text-red-600');
    } else if (variance < 0) {
        varianceTip.textContent = `Great buffer building! You over-estimate slightly.`;
        document.getElementById('stat-variance').classList.add('text-green-500');
        varianceTip.classList.add('text-green-600');
    } else {
        varianceTip.textContent = `Perfectly accurate estimates. Keep it up!`;
        document.getElementById('stat-variance').classList.remove('text-red-500', 'text-green-500');
        varianceTip.classList.add('text-gray-500');
    }
}


// --- Event Handlers (Updated for Async/Await) ---

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('add-task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('task-name').value.trim();
        const component = document.getElementById('task-component').value.trim();
        const effort = parseFloat(document.getElementById('task-effort').value);
        const importance = parseInt(document.getElementById('task-importance').value, 10);

        if (!name || !component || isNaN(effort) || isNaN(importance)) {
            console.error('Validation failed. Please fill out all fields correctly.'); 
            return;
        }
        
        const newTaskData = {
            name: name,
            component: component,
            importance: importance,
            effort_hours: effort
        };

        const success = await addTaskToBackend(newTaskData);
        if (success) {
            e.target.reset(); // Clear form only on successful submission
        }
    });

    document.getElementById('cancel-completion').addEventListener('click', () => {
        document.getElementById('complete-modal').classList.add('hidden');
        document.getElementById('complete-modal').classList.remove('flex');
        taskToComplete = null;
    });

    document.getElementById('confirm-completion').addEventListener('click', async () => {
        const actualTimeInput = document.getElementById('actual-time-input');
        const actualTime = parseFloat(actualTimeInput.value);

        if (isNaN(actualTime) || actualTime < 0) {
            console.error('Invalid input. Please enter a valid time spent (0 or greater).');
            return;
        }

        if (taskToComplete) {
            const taskId = taskToComplete.id;
            
            const success = await completeTaskInBackend(taskId, actualTime);

            if (success) {
                // Hide modal
                document.getElementById('complete-modal').classList.add('hidden');
                document.getElementById('complete-modal').classList.remove('flex');
                taskToComplete = null;
            }
        }
    });

    fetchTasks(); // Initial load of tasks
});


function showCompleteModal(e) {
    const taskId = parseInt(e.currentTarget.dataset.taskId, 10);
    // Find task in the globally loaded tasks array
    taskToComplete = tasks.find(t => t.id === taskId); 

    if (taskToComplete) {
        document.getElementById('modal-task-name').textContent = taskToComplete.name;
        document.getElementById('modal-task-effort').textContent = taskToComplete.effort_hours.toFixed(1);
        document.getElementById('actual-time-input').value = taskToComplete.effort_hours.toFixed(1);
        
        // Show modal
        document.getElementById('complete-modal').classList.remove('hidden');
        document.getElementById('complete-modal').classList.add('flex');
    }
}

function createEvevnt() {
    const button = document.querySelector('#button')
    console.log(button);
    
    button.addEventListener('click', () => {
        console.log('asdfasd');
        
        
    })
}

createEvevnt()