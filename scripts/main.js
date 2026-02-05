let turnTimerInterval = null;

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
    if (!combat.started || !combat.isActive) return;

    // 1. Start Timer on Turn/Round Change
    // This happens when someone clicks "End Turn" in the tracker.
    if (changed.turn !== undefined || changed.round !== undefined) {
        // We only start the timer if the new combatant hasn't already "activated".
        // In Draw Steel, usually moving to a new turn means they are waiting to act.
        startTimer();
    }
});

Hooks.on("updateCombatant", (combatant, changed, options, userId) => {
    // 2. Stop Timer when a Combatant "Activates"
    // We check specifically if the 'activated' flag (used by Draw Steel) turns true.
    // We also check 'hasActed' which some versions use.
    
    // Debugging: If you are unsure what your system uses, you can uncomment the next line to see what changes:
    // console.log("Draw Steel Timer | Combatant Update:", changed);

    const isActivated = 
        changed.flags?.["draw-steel"]?.activated === true || // Standard Draw Steel flag
        changed.flags?.["draw-steel"]?.state === "acted" ||  // Alternate state check
        changed.system?.activated === true;                  // System data check

    if (isActivated) {
        stopTimer();
    }
});

Hooks.on("deleteCombat", () => {
    stopTimer();
});

function startTimer() {
    stopTimer(); // Clear any existing timer

    const duration = 30;
    let timeLeft = duration;

    // Create the container with Number AND Progress Bar
    const container = document.createElement("div");
    container.id = "draw-steel-turn-timer-container";
    container.innerHTML = `
        <div id="draw-steel-turn-timer-number">${timeLeft}</div>
        <div id="draw-steel-timer-bar-bg">
            <div id="draw-steel-timer-bar-fill"></div>
        </div>
    `;
    document.body.appendChild(container);

    const numberDisplay = document.getElementById("draw-steel-turn-timer-number");
    const barFill = document.getElementById("draw-steel-timer-bar-fill");

    turnTimerInterval = setInterval(() => {
        timeLeft--;

        // Sanity check: if element is gone, stop logic
        if (!document.getElementById("draw-steel-turn-timer-container")) {
            clearInterval(turnTimerInterval);
            return;
        }

        // Update Number
        numberDisplay.innerText = timeLeft;

        // Update Progress Bar Width (Shrinking)
        // We calculate percentage. 30s = 100%, 0s = 0%
        const percentage = (timeLeft / duration) * 100;
        barFill.style.width = `${percentage}%`;

        // Flashy Phase (Last 10s)
        if (timeLeft <= 10) {
            container.classList.add("flashy");
        }

        // Time's up
        if (timeLeft <= 0) {
            stopTimer();
        }
    }, 1000);
}

function stopTimer() {
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }
    const container = document.getElementById("draw-steel-turn-timer-container");
    if (container) {
        container.remove();
    }
}