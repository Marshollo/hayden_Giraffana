// stats.js

function msToGrafanaHours(ms) {
  return (ms / (60 * 60 * 1000)).toFixed(2);
}

function createStatsTable(weeklyData) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  table.style.marginTop = '1em';
  table.style.minWidth = '300px';

  const headerRow = document.createElement('tr');
  ['Day', 'Hours', 'Events'].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.border = '1px solid #aaa';
    th.style.padding = '6px 10px';
    th.style.backgroundColor = '#f4f4f4';
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  days.forEach((day) => {
    const row = document.createElement('tr');
    const entry = weeklyData[day];
    const timeText = entry ? msToGrafanaHours(entry.timeMs) : '–';
    const eventsText = entry ? entry.events : '–';

    [day, timeText, eventsText].forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      td.style.border = '1px solid #ddd';
      td.style.padding = '5px 8px';
      row.appendChild(td);
    });

    table.appendChild(row);
  });

  return table;
}

function renderCharts(weekly) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const eventsData = days.map(day => (weekly[day]?.events || 0));
  const hoursData = days.map(day => weekly[day] ? (weekly[day].timeMs / (60 * 60 * 1000)).toFixed(2) : 0);

  // Tworzenie canvasów
  const canvas1 = document.createElement('canvas');
  const canvas2 = document.createElement('canvas');

  const statsDiv = document.getElementById('stats');
  statsDiv.appendChild(document.createElement('hr'));

  // Nowy kontener flex na wykresy
  const chartsRow = document.createElement('div');
  chartsRow.className = 'charts-row';

  // Blok 1: Events
  const block1 = document.createElement('div');
  block1.className = 'chart-block';
  const eventsLabel = document.createElement('h3');
  eventsLabel.textContent = 'Events per Day';
  block1.appendChild(eventsLabel);
  block1.appendChild(canvas1);

  // Blok 2: Hours
  const block2 = document.createElement('div');
  block2.className = 'chart-block';
  const hoursLabel = document.createElement('h3');
  hoursLabel.textContent = 'Hours per Day';
  block2.appendChild(hoursLabel);
  block2.appendChild(canvas2);

  // Dodanie obu bloków do kontenera
  chartsRow.appendChild(block1);
  chartsRow.appendChild(block2);

  // Dodaj do głównego diva
  statsDiv.appendChild(chartsRow);

  // Wykres Events
  new Chart(canvas1.getContext('2d'), {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Events',
        data: eventsData,
        backgroundColor: '#36a2eb'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Wykres Hours
  new Chart(canvas2.getContext('2d'), {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Hours',
        data: hoursData,
        backgroundColor: '#4caf50'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function loadStats() {
  chrome.storage.local.get(['weeklyData'], (data) => {
    let weekly = data.weeklyData;

    // Fallback: try loading from localStorage
    if (!weekly || Object.keys(weekly).length === 0) {
      const backup = localStorage.getItem('backupWeeklyData');
      if (backup) {
        weekly = JSON.parse(backup);
        chrome.storage.local.set({ weeklyData: weekly });
      }
    }

    const statsDiv = document.getElementById('stats');
    statsDiv.innerHTML = '<h2>Weekly Work Stats</h2>';
    if (weekly) {
      statsDiv.appendChild(createStatsTable(weekly));
      renderCharts(weekly);
    } else {
      statsDiv.innerHTML += '<p>No data available.</p>';
    }
  });
}

document.addEventListener('DOMContentLoaded', loadStats);