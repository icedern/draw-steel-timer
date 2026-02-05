let turnTimerInterval = null;
let localTimeLeft = 30;

// 1. REGISTER SETTINGS
Hooks.once('init', () => {
    game.settings.register('draw-steel-timer', 'defaultDuration', {
        name: "Default Timer Duration",
        hint: "How many seconds should the timer last?",
        scope: "world",
        config: true,
        type: Number,
        default: 30
    });

    game.settings.register('draw-steel-timer', 'chatMessage', {
        name: "Post Chat Message on Timeout",
        hint: "Should the module post a message when time runs out?",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });
});

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
    if (!combat.started || !combat.isActive) return;

    // GM LOGIC: Manage the State
    if (game.user.isGM) {
        // Start Timer if Turn becomes Null (Director Phase)
        if (changed.turn === null || changed.round !== undefined) {
            if (combat.turn !== null && combat.turn !== undefined) return;
            
            // Get the duration from settings
            const duration = game.settings.get('draw-steel-timer', 'defaultDuration');
            
            await combat.setFlag("draw-steel-timer", "status", "running");
            await combat.setFlag("draw-steel-timer", "timeLeft", duration);
        }
        
        // Stop Timer if someone activates
        if (typeof changed.turn === 'number') {
            await combat.setFlag("draw-steel-timer", "status", "stopped");
        }
    }

    renderTimerFromFlags(combat);
});

Hooks.on("canvasReady", () => {
    if (game.combat) renderTimerFromFlags(game.combat);
});

function renderTimerFromFlags(combat) {
    const status = combat.getFlag("draw-steel-timer", "status");
    const storedTime = combat.getFlag("draw-steel-timer", "timeLeft"); 
    // Default to settings if flag is missing, otherwise use flag
    const duration = storedTime !== undefined ? storedTime : game.settings.get('draw-steel-timer', 'defaultDuration');

    if (status === "running") {
        if (!document.getElementById("draw-steel-turn-timer-container")) {
            startLocalTimer(duration, combat);
        } else if (turnTimerInterval === null) {
             startLocalTimer(localTimeLeft, combat);
        }
    } else if (status === "paused") {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
        localTimeLeft = duration;
        updateDisplay(localTimeLeft, combat);
    } else {
        removeTimer();
    }
}

function startLocalTimer(startTime, combat) {
    removeTimer(); 
    localTimeLeft = startTime;
    createTimerDOM(combat); // Pass combat to get max duration for bar calculation

    turnTimerInterval = setInterval(() => {
        localTimeLeft--;
        updateDisplay(localTimeLeft, combat);

        // AUDIO CUE: Play a tick sound for last 5 seconds (Client side)
        if (localTimeLeft <= 10 && localTimeLeft > 0) {
            AudioHelper.play({src: "sounds/drums.wav", volume: 0.5}, false); // Uses default Foundry UI sound
        }

        if (localTimeLeft <= 0) {
            clearInterval(turnTimerInterval);
            
            // GM ONLY: Handle Timeout Logic
            if (game.user.isGM) {
                // Play "Time's Up" Sound globally
                AudioHelper.play({src: "sounds/notify.wav", volume: 0.8}, true);

                // Post Chat Message
                if (game.settings.get('draw-steel-timer', 'chatMessage')) {
                    ChatMessage.create({
                        content: "<h3>⏳ Time's Up!</h3><p>The Director picks the combatant.</p>",
                        speaker: { alias: "Turn Timer" }
                    });
                }
                
                // Auto-stop via flag so it disappears for everyone
                combat.setFlag("draw-steel-timer", "status", "stopped");
            }
        }
    }, 1000);
}

function updateDisplay(val, combat) {
    const container = document.getElementById("draw-steel-turn-timer-container");
    if (!container) return;

    const num = document.getElementById("draw-steel-turn-timer-number");
    const bar = document.getElementById("draw-steel-timer-bar-fill");
    
    // Get max duration for percentage math
    const maxDuration = game.settings.get('draw-steel-timer', 'defaultDuration');

    if (num) num.innerText = val;
    if (bar) bar.style.width = `${Math.max(0, (val / maxDuration) * 100)}%`;

    if (val <= 10) container.classList.add("flashy");
    else container.classList.remove("flashy");
}

function createTimerDOM(combat) {
    if (document.getElementById("draw-steel-turn-timer-container")) return;

    const container = document.createElement("div");
    container.id = "draw-steel-turn-timer-container";
    
    // Buttons (GM Only)
    const controls = game.user.isGM ? `
        <div id="draw-steel-timer-controls">
            <div class="timer-btn" id="dst-pause" title="Pause"><i class="fas fa-pause"></i></div>
            <div class="timer-btn" id="dst-play" title="Resume"><i class="fas fa-play"></i></div>
            <div class="timer-btn" id="dst-restart" title="Restart"><i class="fas fa-redo"></i></div>
            <div class="timer-btn" id="dst-stop" title="Stop & Remove"><i class="fas fa-stop"></i></div>
        </div>
    ` : '';

    container.innerHTML = `
        <div id="draw-steel-turn-timer-number">${localTimeLeft}</div>
        <div id="draw-steel-timer-bar-bg">
            <div id="draw-steel-timer-bar-fill"></div>
        </div>
        ${controls}
    `;
    document.body.appendChild(container);

    // Attach Listeners (GM Only)
    if (game.user.isGM) {
        document.getElementById("dst-pause").onclick = async () => {
            await combat.setFlag("draw-steel-timer", "timeLeft", localTimeLeft);
            await combat.setFlag("draw-steel-timer", "status", "paused");
        };
        document.getElementById("dst-play").onclick = async () => {
             await combat.setFlag("draw-steel-timer", "status", "running");
        };
        document.getElementById("dst-restart").onclick = async () => {
            const duration = game.settings.get('draw-steel-timer', 'defaultDuration');
            await combat.setFlag("draw-steel-timer", "timeLeft", duration);
            await combat.setFlag("draw-steel-timer", "status", "running");
            startLocalTimer(duration, combat);
        };
        document.getElementById("dst-stop").onclick = async () => {
            await combat.setFlag("draw-steel-timer", "status", "stopped");
        };
    }
}

function removeTimer() {
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }
    const el = document.getElementById("draw-steel-turn-timer-container");
    if (el) el.remove();
}