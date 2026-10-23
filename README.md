# Taskora

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-20232a?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Peer_to_Peer-333333?style=flat-square&logo=webrtc)](https://webrtc.org/)
[![PWA](https://img.shields.io/badge/PWA-Offline_Ready-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

Taskora is a privacy-first, local-first productivity workspace combining an interactive Kanban board, a synchronized Pomodoro timer, and serverless peer-to-peer device synchronization.

All personal tasks and productivity analytics remain stored directly inside your browser storage. Devices connect directly over encrypted WebRTC data channels with zero intermediary cloud database.

---

## Why I Built This

I was looking for a tool to manage my daily to-do lists and track personal productivity, but could not find one that fit my needs. Most solutions were either locked behind paid subscriptions or severely restricted essential features behind limited-access tiers. I did not want to waste money on recurring software fees or compromise my workflow with artificial limitations, so I built Taskora: a free, open-source, local-first productivity workspace that provides full functionality with complete privacy and zero paywalls. It works cross-platform directly in any browser without needing an app install, keeping all your devices in real-time sync at the same time.

---

## Features

### 1. Kanban Board
- Visual column workflow: Todo, In Progress, and Done.
- Drag-and-drop card reordering and column movement.
- Granular task details: Priority levels (Low, Medium, High), subtask checklists, due dates, due times, and custom tags.
- Search and filtering by status, priority, and text search.
- Quick action menu for status transitions, editing, and deletion.

### 2. Synchronized Pomodoro Timer
- Three distinct session modes: Focus, Short Break, and Long Break.
- Wall-clock synchronization: Accurate down to the millisecond across devices with hardware clock skew elimination.
- Master-follower heartbeat synchronization to prevent ping-pong loops and interval drift.
- Background persistence: Continues running and ticking while navigating across board or analytics tabs.
- Visibility change recovery: Automatically recalculates elapsed time when tabs are refocused or phones are unlocked.
- Optional task linking to track completed Pomodoro cycles per task.

### 3. Direct Peer-to-Peer Device Sync
- Connect phone and laptop directly over WebRTC DataChannel.
- Quick pairing using a 4-digit PIN or QR code scan.
- Host authorization prompt: When a device attempts connection, the laptop displays an explicit authorization request (Accept or Decline) before exchanging data.
- Bidirectional conflict resolution: Merges tasks and history using timestamp-based updates and deletion tombstones.
- Live settings synchronization: Changes to Pomodoro durations or sound preferences sync in real time across paired devices.
- Zero cloud database: Data stays on your devices.

### 4. Productivity Analytics
- Daily completed task totals and focus time records.
- Completion streaks and daily visual goal tracking.
- Visual breakdown of tasks by priority and category tags.

### 5. Sound Effects and Celebrations
- Synthesized audio cues via Web Audio API for task completions, timer finishes, and pairing notifications.
- Celebratory multi-angle confetti cannon animation whenever a task is marked done.

### 6. Progressive Web App (PWA)
- Offline-first operation with custom service worker caching.
- Installable on desktop, Android, and iOS home screens.
- Web push notification support for upcoming task deadlines.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| P2P Networking | PeerJS, WebRTC DataChannel |
| QR Code | qrcode |
| Particle Effects | canvas-confetti |
| Audio | Web Audio API Synthesizer |
| Storage | Browser localStorage with BroadcastChannel tab synchronization |

---

## Getting Started

### Prerequisites
- Node.js 18.18.0 or newer
- npm, pnpm, yarn, or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ShahbazCoder1/Taskora.git
   cd Taskora
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Building for Production

Create an optimized production bundle:

```bash
npm run build
npm run start
```

---

## Device Pairing Guide

1. On your laptop, open the Sync modal from the header and select **Host**.
2. A unique 4-digit PIN and QR code will be generated.
3. On your phone, open Taskora, go to Sync, and choose **Connect**.
4. Enter the 4-digit PIN or scan the QR code using your phone camera.
5. On your laptop, a prompt will appear: **Allow connection from 'Phone'?**
6. Click **Accept** to establish an encrypted WebRTC data channel. Tasks, timer, and settings will synchronize automatically.

---

## Privacy and Data Ownership

Taskora is built with a strict local-first philosophy:
- Zero tracking or user profiling.
- Tasks, reminders, and history are stored locally on your device.
- Device synchronization occurs peer-to-peer over WebRTC data channels.
- Backups can be exported and imported at any time as JSON files via the Settings tab.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
