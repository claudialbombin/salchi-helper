<p align="center">
  <img src="../../assets/no-notion.svg" width="100%" alt="Salchi No Notion edition">
</p>

<h1 align="center">🍎 Salchi for Mac · No Notion</h1>

<p align="center">
  Your tasks are saved in a <b>small file on this computer</b>. No account, no setup, nothing leaves your machine.<br>
  <sub>Looking for the other edition? → <a href="../With%20Notion/">With Notion</a></sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-13%2B-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Mac">
  <img src="https://img.shields.io/badge/edition-No%20Notion-a36130?style=flat-square&labelColor=3b2a1f" alt="No Notion edition">
  <img src="https://img.shields.io/badge/setup-1%20min-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Setup time">
</p>

---

### 📁 In this folder

- `Salchi-sin-Notion-mac.zip`: the app, ready to share (created by `../build_app.sh --local`)
- `README.md`: this guide

## 📥 Install

**Option A: you have the source code (this repository)**

1. Open **Terminal** in the `Mac` folder and run:
   ```sh
   ./build_app.sh --local
   ```
   The first time, macOS may ask to install the developer tools: accept, then run the command again.
2. `Salchi sin Notion.app` is created in the `Mac` folder, and a shareable copy is saved here as
   `Salchi-sin-Notion-mac.zip`.
3. Drag the app to **Applications** and open it.

**Option B: someone sent you the zip**

1. Double-click `Salchi-sin-Notion-mac.zip` and drag the app to **Applications**.
2. Open it. macOS blocks apps from unidentified developers the first time: go to
   **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.

> [!NOTE]
> Salchi appears in the bottom-right corner, and a `🐕` item shows up in the menu bar. Turn on **Open at login** in ⚙️ settings if you want it every day.

## 🌍 Language

Salchi speaks 46 languages, from English (US and UK), Spanish and French to Japanese, Arabic and Ukrainian.
The first time it opens, Salchi asks which one you want (yours is already selected). You can change it at any time in ⚙️ **Settings → Language**.

## 🐕 Using Salchi

| Do this | What happens |
| --- | --- |
| 🖱️ Hover the dog | The list opens; move away and it folds back. |
| ✋ Drag the dog or the list header | Moves Salchi anywhere, even flush against the screen edge. |
| ⌨️ Type in **jot something down…** and press <kbd>Enter</kbd> | Adds a task. |
| ⭕ Click the circle | Ticks the task off. |
| ✕ Hover a task | Deletes it for good. |
| 📅 Next to the text box | Gives the next task a due date before you press <kbd>Enter</kbd>. |
| 📅 Hover a task and click its calendar | Sets or changes that task's date. |
| 🖱️ Right-click a task | Every action: **Done**, **Change date…**, **Remove date**, **Add to Google Calendar** and **Delete**. |
| 📌 Pin | Keeps the list open. |
| ⟳ Reload | Fetches the list again right away. |
| ❗ A red badge on the dog | Something went wrong; hover to read the message. |

<details>
<summary><b>📅 More about due dates</b></summary>

<br>

- Quick picks: **Today**, **Tomorrow**, **Saturday**, **Monday**, or any day on
  the calendar.
- Tick **At a set time** to add a time; press **Done** to confirm.
- Under each task the date reads *today*, *tomorrow*, a weekday or a short date. It turns **red** when overdue and
  **orange** when due today.
- Dated tasks go first, soonest first. Undated ones follow in the order you added them.

</details>

## 🗓️ Google Calendar

<img align="right" src="../../assets/google-calendar.svg" width="44%" alt="The dachshund pinning tasks onto a calendar">

Right-click a task with a date → **Add to Google Calendar**.
Your browser opens Google Calendar with the event already filled in: title, day and time. Just press **Save**.

> [!NOTE]
> Automatic syncing needs the With Notion edition, because something has to run in the cloud while your computer is
> off.

<br clear="right">

## 🔄 Update & uninstall

| | How |
| --- | --- |
| **Update** | Run `./build_app.sh --local` again: it replaces the copy in **Applications** and relaunches it. |
| **Uninstall** | Quit Salchi from the menu-bar item and drag the app from **Applications** to the Bin. |
| **Your data** | `~/Library/Application Support/Salchi/tasks.json` |

## 🩺 Troubleshooting

<details>
<summary>“Salchi can’t be opened because Apple cannot check it”</summary>

<br>

Go to **System Settings → Privacy & Security** and click **Open Anyway**. This is needed once, because the app is signed by you, not by a registered Apple developer.

</details>

<details>
<summary>The build fails with a “module cache path” error</summary>

<br>

The folder was moved after a previous build. The script cleans the cache and retries by itself; if it still fails, delete the `.build` folder and run it again.

</details>

<details>
<summary>It runs on an Intel Mac but I sent it to an Apple-silicon Mac</summary>

<br>

That works through Rosetta 2: macOS offers to install it the first time. Building on the Apple-silicon Mac itself gives a native app.

</details>

---

<p align="center"><sub><a href="../">← Salchi for Mac</a> &nbsp;·&nbsp; <a href="../../">Salchi home</a></sub></p>
