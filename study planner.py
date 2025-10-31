
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Configuration ---
app = Flask(__name__)
# Enable CORS for development so the HTML file can talk to the server
CORS(app) 
DATA_FILE = 'tasks_data.json'

# --- Data Persistence Functions ---

def load_tasks_from_file():
    """Loads tasks from the JSON file, or returns an empty list if the file doesn't exist."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            # If file is empty or corrupted, start fresh
            return []
    return []

def save_tasks_to_file(tasks_list):
    """Saves the current list of tasks back to the JSON file."""
    with open(DATA_FILE, 'w') as f:
        json.dump(tasks_list, f, indent=4)

# Load tasks on startup
tasks = load_tasks_from_file()
next_task_id = max([task['id'] for task in tasks]) + 1 if tasks else 1

# --- Core Logic ---

def calculate_priority(task):
    """
    Calculates the priority score using the Hackathon formula: 
    Priority = (Importance * 5) - (Effort * 3)
    """
    importance_weight = task['importance'] * 5
    effort_penalty = task['effort_hours'] * 3
    return importance_weight - effort_penalty

# --- API Routes ---

@app.route('/tasks', methods=['GET'])
def get_tasks():
    """
    GET request: Retrieves all tasks.
    It calculates the priority for open tasks before sending the response.
    """
    for task in tasks:
        if not task['completed']:
            task['priority'] = calculate_priority(task)
    
    # Sort open tasks by priority (descending) before sending
    sorted_tasks = sorted(
        tasks, 
        key=lambda x: x.get('priority', -float('inf')) if not x['completed'] else float('inf'), 
        reverse=True
    )
    
    return jsonify(sorted_tasks)

@app.route('/tasks', methods=['POST'])
def add_task():
    """
    POST request: Adds a new task based on form data.
    """
    global next_task_id
    data = request.json
    
    new_task = {
        'id': next_task_id,
        'name': data.get('name'),
        'component': data.get('component'),
        'importance': int(data.get('importance', 1)),
        'effort_hours': float(data.get('effort_hours', 0.0)),
        'completed': False,
        'actual_hours_spent': 0.0
    }
    
    tasks.append(new_task)
    save_tasks_to_file(tasks)
    next_task_id += 1
    
    return jsonify({'message': 'Task added', 'task': new_task}), 201

@app.route('/complete_task', methods=['POST'])
def complete_task():
    """
    POST request: Marks a task as complete and logs the actual time spent.
    """
    data = request.json
    task_id = int(data.get('id'))
    actual_time = float(data.get('actual_time_spent', 0.0))
    
    for task in tasks:
        if task['id'] == task_id:
            task['completed'] = True
            task['actual_hours_spent'] = actual_time
            save_tasks_to_file(tasks)
            return jsonify({'message': 'Task completed', 'task': task}), 200
            
    return jsonify({'message': 'Task not found'}), 404

if __name__ == '__main__':
    print("Starting Flask server on http://127.0.0.1:5000")
    print("Ensure 'tasks_data.json' is created for persistence.")
    app.run(debug=True)
