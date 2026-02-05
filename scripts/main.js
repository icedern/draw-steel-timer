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
            // Safety: Don't start if we just loaded into a valid turn (someone is active)
            if (combat.turn !== null && combat.turn !== undefined) return;
            
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

// FIX 3: Re-added Delete Hook to remove timer when combat ends
Hooks.on("deleteCombat", (combat) => {
    removeTimer();
});

Hooks.on("canvasReady", () => {
    if (game.combat) renderTimerFromFlags(game.combat);
});

function renderTimerFromFlags(combat) {
    const status = combat.getFlag("draw-steel-timer", "status");
    const storedTime = combat.getFlag("draw-steel-timer", "timeLeft"); 
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
    createTimerDOM(combat); 

    turnTimerInterval = setInterval(() => {
        localTimeLeft--;
        updateDisplay(localTimeLeft, combat);

        // AUDIO CUE: Tick sound (False = do not loop)
        if (localTimeLeft <= 5 && localTimeLeft > 0) {
            AudioHelper.play({src: "sounds/lock.wav", volume: 0.5}, false); 
        }

        if (localTimeLeft <= 0) {
            clearInterval(turnTimerInterval);
            
            // GM ONLY: Handle Timeout Logic
            if (game.user.isGM) {
                // FIX 1: Set loop to FALSE for the Gong sound
                AudioHelper.play({src: "sounds/notify.wav", volume: 0.8}, false);

                if (game.settings.get('draw-steel-timer', 'chatMessage')) {
                    ChatMessage.create({
                        content: "<h3>⏳ Time's Up!</h3><p>The Director takes the initiative.</p>",
                        speaker: { alias: "Turn Timer" }
                    });
                }
                
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

    // FIX 2: Attach Listeners using global game.combat to prevent stale references
    if (game.user.isGM) {
        document.getElementById("dst-pause").addEventListener("click", async () => {
            if(!game.combat) return;
            await game.combat.setFlag("draw-steel-timer", "timeLeft", localTimeLeft);
            await game.combat.setFlag("draw-steel-timer", "status", "paused");
        });
        document.getElementById("dst-play").addEventListener("click", async () => {
             if(!game.combat) return;
             await game.combat.setFlag("draw-steel-timer", "status", "running");
        });
        document.getElementById("dst-restart").addEventListener("click", async () => {
            if(!game.combat) return;
            const duration = game.settings.get('draw-steel-timer', 'defaultDuration');
            await game.combat.setFlag("draw-steel-timer", "timeLeft", duration);
            await game.combat.setFlag("draw-steel-timer", "status", "running");
            // Force local restart for snappiness
            startLocalTimer(duration, game.combat);
        });
        document.getElementById("dst-stop").addEventListener("click", async () => {
            if(!game.combat) return;
            await game.combat.setFlag("draw-steel-timer", "status", "stopped");
        });
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