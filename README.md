# Project Xhabbit

Project Xhabbit is a futuristic personal habit tracker built with HTML, CSS, vanilla JavaScript, and Chart.js. It runs fully in the browser, stores progress in LocalStorage, and is designed to feel smooth, motivating, and lightweight enough for GitHub Pages.

## Features

- Fixed personalized header with `Hello Piyush 👋`
- Animated daily progress ring
- Habit cards with streak-aware ring thickness and glow states
- `Mark Done` interaction with celebration confetti
- Add Habit modal with icon and difficulty selection
- Best streak and current streak summary cards
- Weekly and monthly insights powered by local Chart.js
- Habit consistency bars
- Daily rotating motivational quote
- LocalStorage persistence for habits, streaks, and completion history
- Lightweight particle background and glassmorphism-inspired UI

## Project Structure

```text
xhabbit/
├── index.html
├── style.css
├── script.js
├── README.md
└── assets/
    ├── background/
    ├── icons/
    └── vendor/
        └── chart.umd.js
```

## Setup

1. Open the `xhabbit/` folder.
2. Launch `index.html` directly in a browser, or serve the folder with any static file server.
3. Your habits and progress will persist automatically in LocalStorage.

## Local Development

If you want a local server, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/xhabbit/`.

## GitHub Pages Deployment

1. Push the repository to GitHub.
2. Commit the `xhabbit/` folder as part of your repo.
3. In GitHub, open `Settings -> Pages`.
4. Choose the branch you want to publish from.
5. Publish the repository root and open `/xhabbit/` on the Pages site if this project lives inside a larger repo.

## Notes

- Chart.js is bundled locally in `assets/vendor/chart.umd.js`, so the app does not depend on a CDN.
- The default data is intentionally seeded so the dashboard looks alive on first launch.
- The app is easy to extend with edit actions, exports, reminders, or filters later.
