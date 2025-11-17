const approveSelectors = ['button[data-accesskey="Enter"]'];
const MAX_GAP = 25 * 60 * 1000;

const REJECT_ALL_BTN_XPATH = '//*[@id="root"]/div[2]/div/main/div/div/div[2]/div[1]/div[1]/div[3]/button[2]';

let lastActionTime = null;
let workTimeMs = 0;
let totalReviewedImages = 0;
let currentDayName = null;


let suppressApproveUntil = 0;        
const SUPPRESS_MS = 1500;            

function $x(xpath, root = document) {
  const res = document.evaluate(xpath, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const out = [];
  for (let i = 0; i < res.snapshotLength; i++) out.push(res.snapshotItem(i));
  return out;
}

function msToGrafanaHours(ms) { return (ms / (60 * 60 * 1000)).toFixed(2); }
function formatGrafanaLabel(ms) { return `${msToGrafanaHours(ms)}h`; }
function getTodayName() { return new Date().toLocaleDateString('en-US', { weekday: 'long' }); }

function hoursFromMs(ms) { return ms / (60 * 60 * 1000); }
function eventsPerHour(timeMs, events) {
  const h = hoursFromMs(timeMs);
  if (!h || !isFinite(h) || events <= 0) return "0.0";
  return (events / h).toFixed(1);
}

function isRejectMenuOpenNear(el) {
  const expanded = el.getAttribute && el.getAttribute('aria-expanded');
  if (expanded === 'true') return true;

  const menuSelectors = [
    '.menu.transition.visible',
    '.ui.dropdown.visible .menu',
    '[role="menu"][data-state="open"]',
    '[role="listbox"][data-state="open"]'
  ];
  let scope = el.closest?.('.ui.dropdown') || document;
  for (const sel of menuSelectors) {
    const m = scope.querySelector(sel) || document.querySelector(sel);
    if (m && m.offsetParent !== null) return true;
  }
  return false;
}

async function loadStoredData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['migrationDone', 'workTimerLastAction', 'workTimerMs', 'reviewedImageCount', 'weeklyData', 'storedDayName'],
      (data) => {
        if (!data.migrationDone) {
          const migrated = {};
          const keysToMigrate = ['workTimerLastAction', 'workTimerMs', 'reviewedImageCount', 'weeklyData'];
          let hasAny = false;
          keysToMigrate.forEach(key => {
            const val = localStorage.getItem(key);
            if (val !== null) {
              try { migrated[key] = JSON.parse(val); } catch { migrated[key] = val; }
              hasAny = true;
            }
          });
          if (hasAny) {
            migrated.migrationDone = true;
            chrome.storage.local.set(migrated, () => {
              console.log("[WORK TIMER] Migracja zakończona.");
              localStorage.clear();
              loadStoredData().then(resolve);
            });
            return;
          } else {
            chrome.storage.local.set({ migrationDone: true });
          }
        }

        lastActionTime = data.workTimerLastAction || null;
        currentDayName = data.storedDayName || getTodayName();
        const today = getTodayName();
        const weekly = data.weeklyData || {};

        if (today !== currentDayName) {
          if (!weekly[currentDayName]) {
            weekly[currentDayName] = { timeMs: workTimeMs, events: totalReviewedImages };
          }
          workTimeMs = 0;
          totalReviewedImages = 0;
          currentDayName = today;
        } else {
          if (weekly[today]) {
            workTimeMs = weekly[today].timeMs || 0;
            totalReviewedImages = weekly[today].events || 0;
          }
        }

        chrome.storage.local.set({
          weeklyData: weekly,
          workTimerMs: workTimeMs,
          reviewedImageCount: totalReviewedImages,
          storedDayName: currentDayName
        }, resolve);
      }
    );
  });
}

function saveData() {
  chrome.storage.local.get(['weeklyData'], (data) => {
    const weekly = data.weeklyData || {};
    weekly[currentDayName] = { timeMs: workTimeMs, events: totalReviewedImages };
    chrome.storage.local.set({
      weeklyData: weekly,
      workTimerLastAction: lastActionTime,
      workTimerMs: workTimeMs,
      reviewedImageCount: totalReviewedImages,
      storedDayName: currentDayName
    });
  });
}

function checkDayChange() {
  const today = getTodayName();
  if (today !== currentDayName) {
    chrome.storage.local.get(['weeklyData'], (data) => {
      const weekly = data.weeklyData || {};
      weekly[currentDayName] = { timeMs: workTimeMs, events: totalReviewedImages };
      currentDayName = today;
      workTimeMs = 0;
      totalReviewedImages = 0;
      chrome.storage.local.set({
        weeklyData: weekly,
        workTimerMs: 0,
        reviewedImageCount: 0,
        storedDayName: today
      });
    });
  }
}

function countValidEventDivs() {
  const eventsGrid = document.querySelector('[data-test="events-grid"]');
  if (!eventsGrid) return 0;
  const directDivs = Array.from(eventsGrid.children).filter(child => child.tagName === "DIV");
  return Math.max(directDivs.length - 1, 0);
}

function injectFloatStyles() {
  if (document.getElementById('wt-styles')) return;
  const css = `
  .wtf-card {
    position: fixed; z-index: 99999;
    display: grid; gap: 8px; min-width: 280px; max-width: 340px;
    background: rgba(18,18,20,0.6);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    backdrop-filter: blur(10px);
    padding: 10px 12px;
    color: #F8F9FA; font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;

    /* domyślnie ukryty — pokazujemy klasą .wt-visible */
    opacity: 0; transform: translateY(-4px);
    pointer-events: none;
    transition: opacity .15s ease, transform .15s ease;
  }
  .wtf-card.wt-visible { opacity: 1; transform: translateY(0); pointer-events: auto; }

  .wtf-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; user-select: none; cursor: default; }
  .wtf-header-left { display:flex; align-items:center; gap:8px; }
  .wtf-icon { width: 28px; height: 28px; border-radius: 8px; }
  .wtf-title { font-weight: 700; letter-spacing: .2px; font-size: 14px; opacity: .95; }
  .wtf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .wtf-chip {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px; padding: 8px 10px; line-height: 1.15;
  }
  .wtf-chip span { display: block; font-size: 11px; opacity: .75; }
  .wtf-chip strong { display: block; font-feature-settings: "tnum" on, "lnum" on; font-variant-numeric: tabular-nums; }
  .wtf-actions { display: flex; align-items: center; gap: 8px; }
  .wtf-btn {
    appearance: none; border: 1px solid rgba(255,255,255,0.12); background: transparent;
    color: #EDEDED; border-radius: 10px; padding: 6px 10px; font-weight: 600; font-size: 13px; cursor: pointer;
  }
  .wtf-btn:hover { background: rgba(255,255,255,0.08); }
  .wtf-btn.primary { border-color: #2196F3; color: #E7F3FF; }
  .wtf-btn.primary:hover { background: rgba(33,150,243,.18); }
  .wtf-btn.danger { border-color: #F44336; color: #FFE8E6; }
  .wtf-btn.danger:hover { background: rgba(244,67,54,.18); }
  .wtf-details summary {
    color:#B0B8C0; cursor:pointer; list-style:none; margin-top:4px; font-size:12px;
  }
  .wtf-details summary::-webkit-details-marker { display:none; }
  .wtf-week { margin:6px 0 0; font-size:12px; color:#EDEDED; white-space:pre-wrap; }

  /* Launcher (okrągła ikonka) */
  .wt-launcher {
  position: fixed; top: 12px; right: 18px; z-index: 99998;
  /* brak kółka */
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;

  /* wygodny, ale niewidoczny obszar klikalny */
  padding: 6px;
  border-radius: 8px;

  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  appearance: none; -webkit-appearance: none; outline: none;
}
.wt-launcher img { width: 36px; height: 48px; border-radius: 10px; }

  `;
  const style = document.createElement('style');
  style.id = 'wt-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

function positionCardTopRight(cardEl, top = 12, right = 18) {
  cardEl.style.top = `${top}px`;
  cardEl.style.right = `${right}px`;
  cardEl.style.left = 'auto';
}


function enableDrag(cardEl, handleEl, storageKey = 'workTimerFloatingPos') {
  let startX=0, startY=0, origX=0, origY=0, dragging=false;

  const savePos = (x,y) => chrome.storage.local.set({ [storageKey]: { x, y }});
  const loadPos = () => new Promise(resolve => {
    chrome.storage.local.get([storageKey], data => resolve(data[storageKey] || null));
  });

  handleEl.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    const rect = cardEl.getBoundingClientRect();
    origX = rect.left; origY = rect.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    cardEl.style.left = `${origX + dx}px`;
    cardEl.style.top  = `${origY + dy}px`;
    cardEl.style.right = 'auto';
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    const rect = cardEl.getBoundingClientRect();
    savePos(rect.left, rect.top);
  });

  // apply saved pos
  loadPos().then(pos => {
    if (!pos) return;
    cardEl.style.left = `${pos.x}px`;
    cardEl.style.top  = `${pos.y}px`;
    cardEl.style.right = 'auto';
  });
}

function getCollapsed() {
  return new Promise(resolve => {
    chrome.storage.local.get(['wtCollapsed'], d => resolve(d.wtCollapsed !== false));
  });
}
function setCollapsed(v) {
  chrome.storage.local.set({ wtCollapsed: !!v });
}


function renderWorkTimeFloating() {
  injectFloatStyles();

  let launcher = document.getElementById('wt-launcher');
  if (!launcher) {
    launcher = document.createElement('button');
    launcher.id = 'wt-launcher';
    launcher.className = 'wt-launcher';
    const li = document.createElement('img');
    li.src = chrome.runtime.getURL('icon48.png');
    launcher.appendChild(li);
    document.body.appendChild(launcher);
  }

  let card = document.getElementById("workTimerFloating");
  if (!card) {
    card = document.createElement('div');
    card.id = "workTimerFloating";
    card.className = "wtf-card";
    document.body.appendChild(card);

    const header = document.createElement('div');
    header.className = 'wtf-header';
    const left = document.createElement('div');
    left.className = 'wtf-header-left';

    const icon = document.createElement('img');
    icon.className = 'wtf-icon';
    icon.src = chrome.runtime.getURL("icon48.png");

    const title = document.createElement('div');
    title.className = 'wtf-title';
    title.textContent = 'Giraffana — Work Timer';

    left.appendChild(icon);
    left.appendChild(title);
    header.appendChild(left);
    card.appendChild(header);

    const stats = document.createElement('div');
    stats.className = 'wtf-stats';
    stats.innerHTML = `
      <div class="wtf-chip"><span>Time</span><strong id="wt-time">0h</strong></div>
      <div class="wtf-chip"><span>Events</span><strong id="wt-events">0</strong></div>
      <div class="wtf-chip"><span>Rate / h</span><strong id="wt-rate">0.0</strong></div>
    `;
    card.appendChild(stats);

    const actions = document.createElement('div');
    actions.className = 'wtf-actions';

    const btnStats = document.createElement('button');
    btnStats.className = 'wtf-btn primary';
    btnStats.textContent = 'Stats';
    btnStats.onclick = () => window.open(chrome.runtime.getURL("stats.html"), "_blank");

    const btnReset = document.createElement('button');
    btnReset.className = 'wtf-btn danger';
    btnReset.textContent = 'Reset day';
    btnReset.onclick = () => {
      if (!confirm("Zresetować dzisiejszy czas i zdarzenia?")) return;
      const today = getTodayName();
      chrome.storage.local.get(['weeklyData'], (data) => {
        const weekly = data.weeklyData || {};
        weekly[today] = { timeMs: 0, events: 0 };
        chrome.storage.local.set({ weeklyData: weekly, workTimerMs: 0, reviewedImageCount: 0 }, () => {
          workTimeMs = 0; totalReviewedImages = 0;
          renderWorkTimeFloating();
        });
      });
    };

    actions.appendChild(btnStats);
    actions.appendChild(btnReset);
    card.appendChild(actions);

    const details = document.createElement('details');
    details.className = 'wtf-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Show weekly breakdown';
    const pre = document.createElement('pre');
    pre.id = 'weeklySummary';
    pre.className = 'wtf-week';
    details.appendChild(summary);
    details.appendChild(pre);
    card.appendChild(details);
  }

  const timeEl = document.getElementById('wt-time');
  const evEl   = document.getElementById('wt-events');
  const rateEl = document.getElementById('wt-rate');
  if (timeEl) timeEl.textContent = formatGrafanaLabel(workTimeMs);
  if (evEl)   evEl.textContent   = String(totalReviewedImages);
  if (rateEl) rateEl.textContent = eventsPerHour(workTimeMs, totalReviewedImages);

  chrome.storage.local.get(['weeklyData'], (data) => {
    const weekly = data.weeklyData || {};
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const summary = days.map(day => {
      const e = weekly[day];
      if (!e) return `${day}: –`;
      const rate = eventsPerHour(e.timeMs, e.events);
      return `${day}: ${msToGrafanaHours(e.timeMs)}h, ${e.events} ev, ${rate}/h`;
    }).join('\n');
    const weeklyEl = document.getElementById("weeklySummary");
    if (weeklyEl) weeklyEl.textContent = summary;
  });

  let showT = null, hideT = null;

  const showCard = () => {
  if (hideT) { clearTimeout(hideT); hideT = null; }
  if (showT) clearTimeout(showT);
  showT = setTimeout(() => {
    positionCardTopRight(card);
    card.classList.add('wt-visible');
  }, 60);
};


  const hideCard = () => {
    if (showT) { clearTimeout(showT); showT = null; }
    if (hideT) clearTimeout(hideT);
    hideT = setTimeout(() => {
      card.classList.remove('wt-visible');
    }, 140);
  };

  // podpinamy raz
  if (!launcher.dataset.hoverBound) {
    launcher.addEventListener('mouseenter', showCard);
    launcher.addEventListener('mouseleave', hideCard);
    launcher.dataset.hoverBound = "1";
  }
  if (!card.dataset.hoverBound) {
    card.addEventListener('mouseenter', showCard);
    card.addEventListener('mouseleave', hideCard);
    window.addEventListener('resize', () => {
      if (card.classList.contains('wt-visible')) positionCardTopRight(card);
    });
    card.dataset.hoverBound = "1";
  }

  // startowo: ukryty panel
  card.classList.remove('wt-visible');
}



function handleWorkEvent(sourceDesc) {
  if (sourceDesc === 'Approve' && Date.now() < suppressApproveUntil) {
    return;
  }

  checkDayChange();

  const now = Date.now();
  const isInternalReview = window.location.pathname.startsWith("/internalReview");

  if (lastActionTime !== null) {
    const diff = now - lastActionTime;
    if (diff <= MAX_GAP) {
      workTimeMs += diff;
    } else {
      console.log(`[WORK TIMER] Pominięta przerwa ${Math.round(diff / 60000)} min.`);
    }

    if (isInternalReview) {
      totalReviewedImages += 1;
    } else {
      const reviewedNow = countValidEventDivs();
      totalReviewedImages += reviewedNow;
    }

    saveData();
  }

  lastActionTime = now;
  saveData();
  renderWorkTimeFloating();
}


function attachSpecificRejectAllNoCount() {
  const nodes = $x(REJECT_ALL_BTN_XPATH);
  nodes.forEach(btn => {
    if (!btn || btn.dataset.rejectAllNoCountAttached === "1") return;
    btn.addEventListener('click', (ev) => {
      suppressApproveUntil = Date.now() + SUPPRESS_MS;
    }, true);
    btn.dataset.rejectAllNoCountAttached = "1";
  });
}

function attachApproveListeners() {
  approveSelectors.forEach(sel => {
    const btns = document.querySelectorAll(sel);
    btns.forEach(btn => {
      if (!btn.dataset.timerAttached) {
        btn.addEventListener("click", () => {
          setTimeout(() => {
            if (isRejectMenuOpenNear(btn)) return;               
            if (Date.now() < suppressApproveUntil) return;      
            handleWorkEvent('Approve');                       
          }, 0);
        }, true);
        btn.dataset.timerAttached = "1";
      }
    });
  });
}

function attachRejectDropdownListeners() {
  const rejectLinks = document.querySelectorAll(
    'a.item.dropdown-item[role="button"], [role="menuitem"], .menu .item, .menu [role="option"]'
  );
  rejectLinks.forEach(link => {
    if (!link.dataset.timerAttached) {
      link.addEventListener("click", () => handleWorkEvent('Reject'), true);
      link.dataset.timerAttached = "1";
    }
  });
}

const buttonObserver = new MutationObserver(() => {
  attachSpecificRejectAllNoCount();
  attachApproveListeners();
  attachRejectDropdownListeners();
});
buttonObserver.observe(document.body, { subtree: true, childList: true });

(async () => {
  await loadStoredData();
  attachSpecificRejectAllNoCount();
  attachApproveListeners();
  attachRejectDropdownListeners();
  injectFloatStyles(); 
  setTimeout(() => { renderWorkTimeFloating(); }, 100);
})();
