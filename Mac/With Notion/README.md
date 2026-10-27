<p align="center">
  <img src="../../assets/with-notion.svg" width="100%" alt="Salchi With Notion edition">
</p>

<h1 align="center">🍎 Salchi for Mac · With Notion</h1>

<p align="center">
  Your tasks live in a <b>Notion database</b>, so the same list follows you to every computer and to the Notion app on your phone.<br>
  <sub>Looking for the other edition? → <a href="../No%20Notion/">No Notion</a></sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-13%2B-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Mac">
  <img src="https://img.shields.io/badge/edition-With%20Notion-a36130?style=flat-square&labelColor=3b2a1f" alt="With Notion edition">
  <img src="https://img.shields.io/badge/setup-%E2%89%88%205%20min-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Setup time">
</p>

---

### 📁 In this folder

- `Salchi-mac.zip`: the app, ready to share (created by `../build_app.sh`)
- `README.md`: this guide

## 📥 Install

**Option A: you have the source code (this repository)**

1. Open **Terminal** in the `Mac` folder and run:
   ```sh
   ./build_app.sh
   ```
   The first time, macOS may ask to install the developer tools: accept, then run the command again.
2. `Salchi.app` is created in the `Mac` folder, and a shareable copy is saved here as `Salchi-mac.zip`.
3. Drag `Salchi.app` to **Applications** and open it.

**Option B: someone sent you the zip**

1. Double-click `Salchi-mac.zip` and drag **Salchi** to **Applications**.
2. Open it. macOS blocks apps from unidentified developers the first time: go to
   **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.

> [!NOTE]
> Salchi appears in the bottom-right corner, and a `🐕` item shows up in the menu bar. Turn on **Abrir al iniciar sesión** (*open at login*) in ⚙️ settings if you want it every day.

## 🔑 Connect Notion (once, ≈ 3 min)

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → **New integration**.
   Choose **Internal**, name it *Salchi* and copy the token (it starts with `ntn_`).
2. Pick the Notion database that will hold your tasks:
   - **Already using Salchi on Windows or Linux?** Open the *Salchi* list it created inside your page.
   - **Starting fresh?** Create a database with a title column called **Tarea** and a checkbox column called
     **Hecho**. Salchi adds the date columns by itself.
3. On that database: **••• → Connections →** add your *Salchi* integration.
4. Copy the database link (**••• → Copy link**).
5. Salchi opens its ⚙️ settings on first launch. Paste the **token** and, in
   **ID o enlace de la base de datos** (*database ID or link*), the link. Press **Guardar** (*Save*).

> [!TIP]
> The token is stored in your Mac's Keychain. You never have to paste it again, even after updating.

## 🐕 Using Salchi

| Do this | What happens |
| --- | --- |
| 🖱️ Hover the dog | The list opens; move away and it folds back. |
| ✋ Drag the dog or the list header | Moves Salchi anywhere, even flush against the screen edge. |
| ⌨️ Type in **apuntar algo…** (*jot something down…*) and press <kbd>Enter</kbd> | Adds a task. |
| ⭕ Click the circle | Ticks the task off. |
| 📅 Next to the text box | Gives the next task a due date before you press <kbd>Enter</kbd>. |
| 📅 Hover a task and click its calendar | Sets or changes that task's date. |
| 🖱️ Right-click a task | Every action: **Hecho** (*done*), **Cambiar fecha…** (*change date*), **Quitar fecha** (*remove date*), **Abrir en Notion** (*open in Notion*) and **Abrir en Google Calendar**. |
| 📌 Pin | Keeps the list open. |
| ⟳ Reload | Fetches the list again right away. |
| ❗ A red badge on the dog | Something went wrong; hover to read the message. |

<details>
<summary><b>📅 More about due dates</b></summary>

<br>

- Quick picks: **Hoy** (*today*), **Mañana** (*tomorrow*), **Sábado** (*Saturday*), **Lunes** (*Monday*), or any day on
  the calendar.
- Tick **A una hora** (*at a time*) to add a time; press **Listo** (*done*) to confirm.
- Under each task the date reads *hoy*, *mañana*, a weekday or a short date. It turns **red** when overdue and
  **orange** when due today.
- Dated tasks go first, soonest first. Undated ones follow in the order you added them.

</details>

## 🗓️ Google Calendar (optional)

<img align="right" src="../../assets/google-calendar.svg" width="44%" alt="The dachshund pinning tasks onto a calendar">

Set up the small script in [`GoogleCalendar`](../../GoogleCalendar/) once (≈ 3 min). From then on:

- every task with a date appears in a **Salchi 🐕** calendar,
- changing the date moves the event,
- ticking the task off removes it,
- and a 🔗 next to the date opens the event.

It runs on Google's servers, so it keeps working while your computer is off.

<br clear="right">

## 🔄 Update & uninstall

| | How |
| --- | --- |
| **Update** | Run `./build_app.sh` again: it replaces the copy in **Applications** and relaunches it. |
| **Uninstall** | Quit Salchi from the menu-bar item and drag the app from **Applications** to the Bin. |
| **Your data** | `UserDefaults` and the Keychain |

## 🩺 Troubleshooting

<details>
<summary>The dog has a red “!” and the list shows an error</summary>

<br>

Hover to read it. Usually it is one of these: no internet connection; the token was pasted incompletely; or the page/database is not shared with your integration (**••• → Connections** in Notion).

</details>

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
