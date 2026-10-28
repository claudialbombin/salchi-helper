<p align="center">
  <img src="../../assets/no-notion.svg" width="100%" alt="Salchi No Notion edition">
</p>

<h1 align="center">🐧 Salchi for Linux · No Notion</h1>

<p align="center">
  Your tasks are saved in a <b>small file on this computer</b>. No account, no setup, nothing leaves your machine.<br>
  <sub>Looking for the other edition? → <a href="../With%20Notion/">With Notion</a></sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Linux-x86__64-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Linux">
  <img src="https://img.shields.io/badge/edition-No%20Notion-a36130?style=flat-square&labelColor=3b2a1f" alt="No Notion edition">
  <img src="https://img.shields.io/badge/setup-1%20min-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Setup time">
</p>

---

### 📁 In this folder

- `salchi-sin-Notion_amd64.deb`: for Ubuntu, Debian, Linux Mint, Pop!_OS…
- `Salchi-sin-Notion.AppImage`: for any other distribution
- `README.md`: this guide

## 📥 Install

**Ubuntu, Debian, Linux Mint (`.deb`)**

```sh
sudo apt install ./salchi-sin-Notion_amd64.deb
```

Or double-click the file and choose **Install**. Then open **Salchi** from your applications menu.

**Any other distribution (AppImage)**

```sh
chmod +x Salchi-sin-Notion.AppImage
./Salchi-sin-Notion.AppImage
```

Or right-click it → **Properties → Allow executing as a program**, then double-click.

> [!NOTE]
> Salchi appears in the bottom-right corner and in the tray, and starts at login from now on (you can turn that off in ⚙️ settings).

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
| **Update** | Install the new `.deb` on top of the old one, or replace the AppImage file. Your tasks are kept. |
| **Uninstall** | `sudo apt remove salchi` for the `.deb` (it also removes its AppArmor profile), or delete the AppImage file and `~/.config/autostart/salchi.desktop`. |
| **Your data** | `~/.config/Salchi/tasks.json` |

## 🩺 Troubleshooting

<details>
<summary>The AppImage does nothing on Ubuntu 22.04 or older</summary>

<br>

Install FUSE 2: `sudo apt install libfuse2`.

</details>

<details>
<summary>I can’t see the tray icon (GNOME)</summary>

<br>

Install the *AppIndicator and KStatusNotifierItem Support* GNOME extension. Ubuntu already includes it.

</details>

<details>
<summary>It opens but the window doesn’t move on Wayland</summary>

<br>

Salchi runs through XWayland, which is part of every major Wayland desktop. Make sure XWayland is not disabled in your compositor settings.

</details>

---

<p align="center"><sub><a href="../">← Salchi for Linux</a> &nbsp;·&nbsp; <a href="../../">Salchi home</a></sub></p>
