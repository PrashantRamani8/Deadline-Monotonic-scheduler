/* 
=========================================
   DMS Scheduler - JavaScript Logic
   Author: Prashant Ramani
   Description: Core simulation, DMS priority 
                calculations, and metrics tracking.
=========================================
*/

let processQueue = [];
let totalTime = 0;
const unitWidth = 37.8;
let currentTime = 0;
let isSimulationRunning = false;
let simulationInterval = null;
let busySlots = 0;

// Tie-breaker priority comparator for Deadline Monotonic Scheduling (DMS)
// 1. Shorter relative deadline = Higher Priority
// 2. Shorter period = Higher Priority (Tie-breaker 1)
// 3. Alphabetically smaller ID = Higher Priority (Tie-breaker 2)
function comparePriority(a, b) {
    if (a.deadline !== b.deadline) {
        return a.deadline - b.deadline;
    }
    if (a.period !== b.period) {
        return a.period - b.period;
    }
    return a.id.localeCompare(b.id);
}

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}

function lcm(a, b) {
    return (a * b) / gcd(a, b);
}

function calculateLCM() {
    if (processQueue.length === 0) return 0;
    return processQueue.map(p => p.period).reduce((acc, val) => lcm(acc, val));
}

// Calculate theoretical CPU Utilization
function calculateCPUUtilization() {
    if (processQueue.length === 0) return 0;
    const utilization = processQueue.reduce((acc, process) => 
        acc + (process.executionTime / process.period), 0) * 100;
    return Math.min(utilization, 100).toFixed(2);
}

// Calculate analytical Response Time under DMS using recurrence relation
function calculateResponseTime(processIndex) {
    const process = processQueue[processIndex];
    let R = process.executionTime;
    let prevR;
    
    do {
        prevR = R;
        R = process.executionTime;
        for (let j = 0; j < processIndex; j++) {
            const p = processQueue[j];
            R += Math.ceil(prevR / p.period) * p.executionTime;
        }
    } while (R !== prevR && R <= process.deadline);
    
    return R;
}

// Update the Analytical Feasibility Section
function updateResponseTimeAnalysis() {
    const container = document.getElementById('responseTimeAnalysis');
    container.innerHTML = '';
    
    if (processQueue.length === 0) {
        container.innerHTML = `
            <div class="text-sm text-slate-500 italic p-4 text-center border border-dashed border-slate-800/60 rounded-xl">
                Add processes to generate schedule feasibility analysis.
            </div>
        `;
        return;
    }

    processQueue.forEach((process, index) => {
        const responseTime = calculateResponseTime(index);
        const isSchedulable = responseTime <= process.deadline;
        const div = document.createElement('div');
        div.className = `p-3 rounded-xl border flex items-center justify-between text-sm ${
            isSchedulable 
                ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300' 
                : 'bg-rose-500/5 border-rose-500/10 text-rose-300'
        }`;
        div.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-xs">P: ${process.id}</span>
                <span>Analytical Response Time = <span class="font-bold">${responseTime}</span></span>
            </div>
            <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                isSchedulable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }">
                <i class="fas ${isSchedulable ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                ${isSchedulable ? 'Schedulable' : 'Not Schedulable'}
            </span>
        `;
        container.appendChild(div);
    });
}

function addProcess() {
    if (isSimulationRunning) {
        alert("Cannot add processes while simulation is running!");
        return;
    }

    let id = document.getElementById("processId").value.trim();
    let executionTime = parseInt(document.getElementById("executionTime").value);
    let deadline = parseInt(document.getElementById("deadline").value);
    let period = parseInt(document.getElementById("period").value);

    if (!id || isNaN(executionTime) || isNaN(deadline) || isNaN(period)) {
        alert("Enter valid process details!");
        return;
    }
    
    if (processQueue.some(p => p.id === id)) {
        alert("Process ID must be unique!");
        return;
    }

    if (period < deadline) {
        alert("Period must be greater than or equal to Deadline!");
        return;
    }

    if (deadline < executionTime) {
        alert("Deadline must be greater than or equal to Execution Time!");
        return;
    }

    let newProcess = {
        id,
        executionTime,
        deadline,
        period,
        remainingTime: executionTime,
        completed: false,
        jobs: [] // Jobs tracking array for performance metrics
    };
    
    processQueue.push(newProcess);
    processQueue.sort(comparePriority); // Sort strictly by DMS priority rules
    totalTime = calculateLCM();
    
    updateQueueDisplay();
    updateCPUUtilization();
    updateResponseTimeAnalysis();

    // Clear input fields
    document.getElementById("processId").value = "";
    document.getElementById("executionTime").value = "";
    document.getElementById("deadline").value = "";
    document.getElementById("period").value = "";
}

function deleteProcess(id) {
    if (isSimulationRunning) {
        alert("Cannot delete processes while simulation is running!");
        return;
    }

    processQueue = processQueue.filter(p => p.id !== id);
    processQueue.sort(comparePriority); // Keep queue sorted
    totalTime = calculateLCM();
    updateQueueDisplay();
    updateCPUUtilization();
    updateResponseTimeAnalysis();
}

function updateQueueDisplay() {
    let tableBody = document.getElementById("processTableBody");
    tableBody.innerHTML = "";
    
    if (processQueue.length === 0) {
        tableBody.innerHTML = `
            <tr id="emptyQueueMessage">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
                    Queue is empty. Add processes above.
                </td>
            </tr>
        `;
        document.getElementById("lcmDisplay").innerText = "0";
        return;
    }
    
    processQueue.forEach(process => {
        let row = document.createElement("tr");
        row.className = "hover:bg-slate-800/30 transition duration-150";
        
        const status = process.completed ? 'Completed' : 
                      process.remainingTime < process.executionTime ? 'Running' : 'Waiting';
        const statusColor = process.completed ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 
                          process.remainingTime < process.executionTime ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
        
        row.innerHTML = `
            <td class="px-4 py-3 font-semibold font-mono text-white">${process.id}</td>
            <td class="px-4 py-3 font-medium">${process.executionTime}</td>
            <td class="px-4 py-3 font-medium">${process.deadline}</td>
            <td class="px-4 py-3 font-medium">${process.period}</td>
            <td class="px-4 py-3">
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                    <div class="bg-blue-500 h-full rounded-full transition-all duration-300" style="width: ${(process.remainingTime / process.executionTime) * 100}%"></div>
                </div>
                <div class="text-[10px] text-slate-500 font-mono">${process.remainingTime}/${process.executionTime}</div>
            </td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusColor}">
                    ${status}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                <button onclick="deleteProcess('${process.id}')" class="text-red-400 hover:text-red-300 transition duration-150 p-1.5 hover:bg-red-500/10 rounded-lg">
                    <i class="fas fa-trash-can"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    document.getElementById("lcmDisplay").innerText = totalTime;
}

function updateCPUUtilization() {
    const utilization = calculateCPUUtilization();
    const cpuDisplay = document.getElementById("cpuUtilization");
    
    // Check if the actual sum exceeds 100% (overload check)
    const rawUtil = processQueue.reduce((acc, process) => 
        acc + (process.executionTime / process.period), 0) * 100;
    
    cpuDisplay.innerText = `${utilization}%`;
    
    const warnBadge = document.getElementById("cpuWarningBadge");
    if (rawUtil > 100) {
        cpuDisplay.className = "text-3xl font-black mt-1 text-rose-450 transition-colors duration-350";
        warnBadge.classList.remove("hidden");
        warnBadge.innerText = `Overloaded (${rawUtil.toFixed(0)}%)`;
    } else {
        cpuDisplay.className = "text-3xl font-black mt-1 text-emerald-400 transition-colors duration-350";
        warnBadge.classList.add("hidden");
    }
}

function updateGanttChart(process) {
    let ganttChartContainer = document.getElementById("ganttChart");
    
    if (ganttChartContainer.querySelector('.text-slate-500')) {
        ganttChartContainer.innerHTML = '';
    }

    let timeSlot = document.createElement("div");
    timeSlot.className = "gantt-block";
    timeSlot.style.width = `${unitWidth}px`;
    
    if (process) {
        const colorHue = (process.id.charCodeAt(0) * 137) % 360;
        timeSlot.style.backgroundColor = `hsl(${colorHue}, 60%, 40%)`;
        timeSlot.innerText = process.id;
        timeSlot.title = `Time ${currentTime}: Process ${process.id}`;
    } else {
        timeSlot.classList.add("gantt-block-idle");
        timeSlot.innerText = "-";
        timeSlot.title = `Time ${currentTime}: Idle`;
    }
    ganttChartContainer.appendChild(timeSlot);
}

function updateSimulationClock() {
    document.getElementById('simulationClock').innerText = `Time: ${currentTime}`;
}

function startScheduling() {
    if (processQueue.length === 0) {
        alert("No processes to schedule.");
        return;
    }

    if (isSimulationRunning) {
        alert("Simulation is already running!");
        return;
    }

    // Reset simulation states
    currentTime = 0;
    busySlots = 0;
    document.getElementById("ganttChart").innerHTML = "";
    document.getElementById("resultsPanel").classList.add("hidden");
    
    processQueue.forEach(p => {
        p.remainingTime = p.executionTime;
        p.completed = false;
        p.jobs = []; // Clear job histories
    });

    isSimulationRunning = true;
    executeScheduler();
}

function executeScheduler() {
    simulationInterval = setInterval(() => {
        let executingProcess = null;

        // Step 1: Release jobs at period boundaries
        for (let process of processQueue) {
            if (currentTime % process.period === 0) {
                // If a job was active and unfinished, it misses deadline (handled by deadline checker)
                process.remainingTime = process.executionTime;
                process.completed = false;

                // Push new job log
                process.jobs.push({
                    releaseTime: currentTime,
                    executionTime: process.executionTime,
                    remainingTime: process.executionTime,
                    firstExecutionTime: -1,
                    completionTime: -1,
                    deadlineTime: currentTime + process.deadline,
                    missed: false
                });
            }

            // Step 2: Deadline Miss Verification
            const activeJob = process.jobs[process.jobs.length - 1];
            if (activeJob && !process.completed && currentTime === activeJob.deadlineTime) {
                activeJob.missed = true;
            }

            // Step 3: Select ready process with highest priority (first in sorted queue)
            if (!process.completed && !executingProcess) {
                executingProcess = process;
            }
        }

        // Step 4: Execute the selected process
        if (executingProcess) {
            const activeJob = executingProcess.jobs[executingProcess.jobs.length - 1];
            if (activeJob) {
                if (activeJob.firstExecutionTime === -1) {
                    activeJob.firstExecutionTime = currentTime;
                }
                executingProcess.remainingTime--;
                activeJob.remainingTime--;
                
                if (executingProcess.remainingTime === 0) {
                    executingProcess.completed = true;
                    activeJob.completionTime = currentTime + 1; // Job completes at the end of this step
                }
            }
            busySlots++;
            updateGanttChart(executingProcess);
        } else {
            updateGanttChart(null);
        }

        updateQueueDisplay();
        updateSimulationClock();
        currentTime++;

        // Step 5: Check Simulation Completion
        if (currentTime >= totalTime) {
            clearInterval(simulationInterval);
            isSimulationRunning = false;
            
            // Final check on remaining jobs
            processQueue.forEach(p => {
                const activeJob = p.jobs[p.jobs.length - 1];
                if (activeJob && !p.completed && currentTime >= activeJob.deadlineTime) {
                    activeJob.missed = true;
                }
            });

            setTimeout(() => {
                alert("Scheduling simulation completed!");
                displayResults();
            }, 50);
        }
    }, 1000);
}

// Display simulation statistics upon completion
function displayResults() {
    const resultsPanel = document.getElementById("resultsPanel");
    const resultsBody = document.getElementById("resultsTableBody");
    resultsBody.innerHTML = "";

    processQueue.forEach(p => {
        let totalTurnaround = 0;
        let totalWaiting = 0;
        let totalResponse = 0;
        let completedJobs = 0;
        let missedCount = 0;
        let startedJobs = 0;

        p.jobs.forEach(job => {
            // Count misses
            if (job.missed || (job.completionTime === -1 && currentTime >= job.deadlineTime)) {
                missedCount++;
            }
            // Count stats for completed jobs
            if (job.completionTime !== -1) {
                const trT = job.completionTime - job.releaseTime;
                totalTurnaround += trT;
                totalWaiting += (trT - p.executionTime);
                completedJobs++;
            }
            // Response time (time to first execution)
            if (job.firstExecutionTime !== -1) {
                totalResponse += (job.firstExecutionTime - job.releaseTime);
                startedJobs++;
            }
        });

        const avgTurnaround = completedJobs > 0 ? (totalTurnaround / completedJobs).toFixed(2) : "N/A";
        const avgWaiting = completedJobs > 0 ? (totalWaiting / completedJobs).toFixed(2) : "N/A";
        const avgResponse = startedJobs > 0 ? (totalResponse / startedJobs).toFixed(2) : "N/A";

        const row = document.createElement("tr");
        row.className = "border-b border-slate-800 hover:bg-slate-900/30";
        row.innerHTML = `
            <td class="px-4 py-3 font-semibold font-mono text-white">${p.id}</td>
            <td class="px-4 py-3 font-medium">${p.jobs.length}</td>
            <td class="px-4 py-3 font-medium text-emerald-400">${completedJobs}</td>
            <td class="px-4 py-3 font-medium text-rose-450">${missedCount}</td>
            <td class="px-4 py-3 font-medium">${avgResponse}</td>
            <td class="px-4 py-3 font-medium">${avgTurnaround}</td>
            <td class="px-4 py-3 font-medium">${avgWaiting}</td>
        `;
        resultsBody.appendChild(row);
    });

    // Actual Simulation CPU utilization calculation
    const actualUtilization = ((busySlots / totalTime) * 100).toFixed(2);
    document.getElementById("actualCpuUtilization").innerText = `${actualUtilization}%`;

    resultsPanel.classList.remove("hidden");
    resultsPanel.scrollIntoView({ behavior: 'smooth' });
}
