<p align="center">
  <img src="../../assets/with-notion.svg" width="100%" alt="Salchi With Notion edition">
</p>

<h1 align="center">🪟 Salchi for Windows · With Notion</h1>

<p align="center">
  Your tasks live in a <b>Notion database</b>, so the same list follows you to every computer and to the Notion app on your phone.<br>
  <sub>Looking for the other edition? → <a href="../No%20Notion/">No Notion</a></sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Windows">
  <img src="https://img.shields.io/badge/edition-With%20Notion-a36130?style=flat-square&labelColor=3b2a1f" alt="With Notion edition">
  <img src="https://img.shields.io/badge/setup-%E2%89%88%205%20min-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Setup time">
</p>

---

### 📁 In this folder

- `Salchi-Setup-con-Notion.exe`: the installer
- `README.md`: this guide

## 📥 Install

1. Double-click **`Salchi-Setup-con-Notion.exe`**.
2. If Windows shows *"Windows protected your PC"*, click **More info → Run anyway**.
   This appears because the installer is not signed with a paid certificate; it only happens once.
3. That's it: no wizard, no admin password. A desktop shortcut and a Start-menu entry are created.

> [!NOTE]
> Salchi appears in the bottom-right corner and in the notification area, and starts with Windows from now on (you can turn that off in ⚙️ settings).

## 🔑 Connect Notion (once, ≈ 3 min)

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → **New integration**.
   Choose **Internal**, name it *Salchi* and copy the token (it starts with `ntn_`).
2. In Notion, create an empty page, for example *Salchi*.
3. On that page: **••• → Connections →** add your *Salchi* integration.
4. Copy the page link (**••• → Copy link**).
5. Salchi opens its ⚙️ settings on first launch. Paste the **token** and, in
   **Enlace de la página de Notion** (*Notion page link*), the link. Press **Guardar** (*Save*).
   Salchi creates a *Salchi* task list inside the page.

> [!TIP]
> **Second computer?** Paste **the same token and the same page link**. Salchi finds the list that already exists
> and both computers share it: what you add on one shows up on the other within 20 seconds.

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
| **Update** | Run the new installer: it replaces the old version and keeps your settings. |
| **Uninstall** | **Settings → Apps → Installed apps → Salchi → Uninstall**. |
| **Your data** | `%APPDATA%\Salchi\config.json` (token encrypted with DPAPI) |

## 🩺 Troubleshooting

<details>
<summary>The dog has a red “!” and the list shows an error</summary>

<br>

Hover to read it. Usually it is one of these: no internet connection; the token was pasted incompletely; or the page/database is not shared with your integration (**••• → Connections** in Notion).

</details>

<details>
<summary>I can’t see the dog</summary>

<br>

Click the dog icon next to the clock (it may be hidden under the **^** arrow) to show it again.

</details>

<details>
<summary>SmartScreen won’t let me run it</summary>

<br>

Click **More info** first: the **Run anyway** button only appears after that.

</details>

---

<p align="center"><sub><a href="../">← Salchi for Windows</a> &nbsp;·&nbsp; <a href="../../">Salchi home</a></sub></p>
