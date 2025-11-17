🦒 Giraffana - Work Timer & Event Tracker

Giraffana is a lightweight Chrome extension designed for annotators working on the Hayden AI platform.
It tracks active work time, event counts, daily performance, and weekly summaries, all in a clean floating dashboard.

<br>
🔗 Install from Chrome Web Store

👉 https://chromewebstore.google.com/detail/giraffana/oihpifdiakkhpgoijlbhjeooloefgcjp

<br>
✨ Features

⏱ Active work-time tracking
Only counts productive time (inactive breaks are ignored automatically).

🟩 Approve & Reject detection
Smart event tracking based on actual UI interactions.

🧠 Accurate event counting
Detects the real number of events visible in the match, not just "+1".

📊 Real-time floating dashboard
Minimal, modern panel showing:

Time worked today

Event count today

Events per hour

Weekly breakdown

📅 Automatic day switching
Resets daily stats at midnight.

💾 Local data storage
Persists stats using chrome.storage.local.

🖱 Hover-based quick panel
Tiny launcher icon → hover → full dashboard appears.

<br>
🛠 Technology

JavaScript (vanilla)

Chrome Extensions Manifest V3

chrome.storage API

DOM observers (MutationObserver)

Custom floating UI with CSS glassmorphism

<br>
📥 Installation, download directly from the .store OR (development)

Clone the repo:

git clone https://github.com/USERNAME/Giraffana.git


Open Chrome → Extensions → Enable developer mode

Click Load unpacked

Select the Giraffana folder

📝 Changelog

v1.0.0 – Initial release

v1.1.0 – Added hover panel + drag memory + UI redesign

v1.2.0 – Improved event detection & Reject All bug fix

v1.3.0 – Added events/hour metric and weekly summaries

<br>
🔒 Privacy

Giraffana stores all data only on your machine using chrome.storage.local.
No analytics, no tracking, no network requests.
You fully control your data.

<br>
📧 Contact

If you want new features or have found a bug, please feel free to open an issue or message me.
