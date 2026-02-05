let turnTimerInterval = null;

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
    if (!combat.started || !combat.isActive) return;

    // --- STOP TIMER LOGIC ---
    // Matches: COMBAT UPDATED {turn: 0}
    // If the turn changes to a valid number (0, 1, 2...), it means someone has Activated.
    if (typeof changed.turn === 'number') {
        stopTimer();
        return;
    }

    // --- START TIMER LOGIC ---
    // Matches: COMBAT UPDATED {turn: null}
    // If the turn becomes null, or if the round changes (resetting the cycle), we are in the "Director Phase".
    // We explicitly check for null or round changes.
    if (changed.turn === null || changed.round !== undefined) {
        
        // Double check: If we just started a new round, does the system auto-activate someone? 
        // If the current turn is defined, don't start timer.
        if (combat.turn !== null && combat.turn !== undefined) {
             return;
        }
        
        startTimer();
    }
});

// We keep deleteCombat to clean up if the encounter ends
Hooks.on("deleteCombat", () => {
    stopTimer();
});

function startTimer() {
    stopTimer(); // Ensure we don't have two timers running

    const duration = 30;
    let timeLeft = duration;

    // Create the HUD Container
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

        // Safety check: if element was removed manually, kill logic
        if (!document.getElementById("draw-steel-turn-timer-container")) {
            clearInterval(turnTimerInterval);
            return;
        }

        // Update Number
        numberDisplay.innerText = timeLeft;

        // Update Progress Bar (30s = 100%, 0s = 0%)
        const percentage = (timeLeft / duration) * 100;
        barFill.style.width = `${percentage}%`;

        // Flashy "Panic Mode" for last 10 seconds
        if (timeLeft <= 10) {
            container.classList.add("flashy");
        }

        // Timer hits zero
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