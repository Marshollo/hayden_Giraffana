const approveSelectors = [
  'button[data-accesskey="Enter"]',
];
const MAX_GAP = 35 * 60 * 1000; //tu liczy czy ktos przekroczyl przerwe pomiedzy eventami 20min

let lastActionTime = Number(localStorage.getItem('workTimerLastAction')) || null;
let workTimeMs = Number(localStorage.getItem('workTimerMs') || 0);

function msToGrafanaHours(ms) {
    const hours = ms / (60 * 60 * 1000);
    return hours.toFixed(2); 
}
function formatGrafanaLabel(ms) {
    const val = msToGrafanaHours(ms);
    return `${val}h`;
}

function renderWorkTimeFloating() {
    let el = document.getElementById("workTimerFloating");
    if (!el) {
        el = document.createElement('div');
        el.id = "workTimerFloating";
        el.style.position = "fixed";
        el.style.top = "12px";
        el.style.right = "18px";
        el.style.zIndex = 99999;
        el.style.background = "transparent";
        el.style.fontSize = "20px";
        el.style.userSelect = "none";
        el.style.fontWeight = "bold";
        document.body.appendChild(el);

        // emoji zegara w prawym gornym rogu
        let emoji = document.createElement("span");
        emoji.textContent = "⏱️";
        emoji.style.cursor = "pointer";
        emoji.style.padding = "0.2em";
        el.appendChild(emoji);

        // timer i reser
        let floatingPanel = document.createElement("span");
        floatingPanel.id = "workTimerPanel";
        floatingPanel.style.display = "none";
        floatingPanel.style.marginLeft = "0.7em";
        floatingPanel.style.background = "#232323";
        floatingPanel.style.color = "#FFD740";
        floatingPanel.style.padding = "8px 20px";
        floatingPanel.style.borderRadius = "7px";
        floatingPanel.style.fontSize = "20px";
        floatingPanel.style.boxShadow = "0 2px 9px #0004";
        floatingPanel.style.verticalAlign = "middle";
        floatingPanel.style.whiteSpace = "nowrap";
        floatingPanel.style.position = "absolute";
        floatingPanel.style.top = "30px";
        floatingPanel.style.right = "0";
        floatingPanel.style.transition = "opacity 0.2s";
        floatingPanel.style.opacity = "0";
        floatingPanel.style.pointerEvents = "none";
        el.appendChild(floatingPanel);

        // reset przycisk
        let resetBtn = document.createElement("button");
        resetBtn.textContent = "Reset";
        resetBtn.style.marginLeft = "1.2em";
        resetBtn.style.border = "none";
        resetBtn.style.background = "#f44336";
        resetBtn.style.color = "#fff";
        resetBtn.style.fontWeight = "bold";
        resetBtn.style.borderRadius = "4px";
        resetBtn.style.cursor = "pointer";
        resetBtn.style.padding = "4px 11px";
        resetBtn.onmousedown = (e) => {
            e.preventDefault();
            localStorage.setItem('workTimerMs', '0');
            localStorage.setItem('workTimerLastAction', '');
            workTimeMs = 0;
            lastActionTime = null;
            renderWorkTimeFloating();
        };
        floatingPanel.appendChild(resetBtn);

        // pokazuje, chowa panel
        let showPanel = () => {
            floatingPanel.style.display = "";
            setTimeout(() => {
                floatingPanel.style.opacity = "1";
                floatingPanel.style.pointerEvents = "";
            }, 5);
        };
        let hidePanel = () => {
            floatingPanel.style.opacity = "0";
            floatingPanel.style.pointerEvents = "none";
            setTimeout(() => {
                floatingPanel.style.display = "none";
            }, 220);
        };
        emoji.addEventListener('mouseenter', showPanel);
        emoji.addEventListener('mouseleave', hidePanel);
        floatingPanel.addEventListener('mouseenter', showPanel);
        floatingPanel.addEventListener('mouseleave', hidePanel);
    }
    // aktualzuje zegar
    let floatingPanel = document.getElementById("workTimerPanel");
    if (floatingPanel) {
        for (const n of Array.from(floatingPanel.childNodes)) {
            if (n.nodeType === 3) floatingPanel.removeChild(n);
        }
        floatingPanel.insertBefore(
            document.createTextNode(" Czas: " + formatGrafanaLabel(workTimeMs) + " "),
            floatingPanel.firstChild
        );
    }
}

// zlicza czas
function handleWorkEvent(sourceDesc) {
    const now = Date.now();
    if (lastActionTime !== null) {
        const diff = now - lastActionTime;
        if (diff <= MAX_GAP) {
            workTimeMs += diff;
            localStorage.setItem('workTimerMs', workTimeMs.toString());
        } else {
            console.log(`[WORK TIMER] Pominięta przerwa ${Math.round(diff/60000)} min - zbyt długa, nie doliczam.`);
        }
        renderWorkTimeFloating();
    }
    lastActionTime = now;
    localStorage.setItem('workTimerLastAction', lastActionTime.toString());
}

function attachApproveListeners() {
  approveSelectors.forEach(sel => {
    const btns = document.querySelectorAll(sel);
    btns.forEach(btn => {
      if (!btn.dataset.timerAttached) {
        btn.addEventListener("click", () => handleWorkEvent('Approve'), true);
        btn.dataset.timerAttached = "1";
      }
    });
  });
}
function attachRejectDropdownListeners() {
    const rejectLinks = document.querySelectorAll('a.item.dropdown-item[role="button"]');
    rejectLinks.forEach(link => {
      if (!link.dataset.timerAttached) {
        link.addEventListener("click", () => handleWorkEvent('Reject/RejectAll (dropdown)'), true);
        link.dataset.timerAttached = "1";
      }
    });
}
const buttonObserver = new MutationObserver(() => {
  attachApproveListeners();
  attachRejectDropdownListeners();
});
buttonObserver.observe(document.body, {subtree: true, childList: true});

attachApproveListeners();
attachRejectDropdownListeners();
renderWorkTimeFloating();
