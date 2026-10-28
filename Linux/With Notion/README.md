<p align="center">
  <img src="../../assets/with-notion.svg" width="100%" alt="Salchi With Notion edition">
</p>

<h1 align="center">🐧 Salchi for Linux · With Notion</h1>

<p align="center">
  Your tasks live in a <b>Notion database</b>, so the same list follows you to every computer and to the Notion app on your phone.<br>
  <sub>Looking for the other edition? → <a href="../No%20Notion/">No Notion</a></sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Linux-x86__64-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Linux">
  <img src="https://img.shields.io/badge/edition-With%20Notion-a36130?style=flat-square&labelColor=3b2a1f" alt="With Notion edition">
  <img src="https://img.shields.io/badge/setup-%E2%89%88%205%20min-f7e2a0?style=flat-square&labelColor=3b2a1f" alt="Setup time">
</p>

---

### 📁 In this folder

- `salchi-con-Notion_amd64.deb`: for Ubuntu, Debian, Linux Mint, Pop!_OS…
- `Salchi-con-Notion.AppImage`: for any other distribution
- `README.md`: this guide

## 📥 Install

**Ubuntu, Debian, Linux Mint (`.deb`)**

```sh
sudo apt install ./salchi-con-Notion_amd64.deb
```

Or double-click the file and choose **Install**. Then open **Salchi** from your applications menu.

**Any other distribution (AppImage)**

```sh
chmod +x Salchi-con-Notion.AppImage
./Salchi-con-Notion.AppImage
```

Or right-click it → **Properties → Allow executing as a program**, then double-click.

> [!NOTE]
> Salchi appears in the bottom-right corner and in the tray, and starts at login from now on (you can turn that off in ⚙️ settings).

## 🔑 Connect Notion (once, ≈ 3 min)

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → **New integration**.
   Choose **Internal**, name it *Salchi* and copy the token (it starts with `ntn_`).
2. In Notion, create an empty page, for example *Salchi*.
3. On that page: **••• → Connections →** add your *Salchi* integration.
4. Copy the page link (**••• → Copy link**).
5. Salchi opens its ⚙️ settings on first launch. Paste the **token** and, in
   **Link to the Notion page**, the link. Press **Save**.
   Salchi creates a *Salchi* task list inside the page.

> [!TIP]
> **Second computer?** Paste **the same token and the same page link**. Salchi finds the list that already exists
> and both computers share it: what you add on one shows up on the other within 20 seconds.

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
| 📅 Next to the text box | Gives the next task a due date before you press <kbd>Enter</kbd>. |
| 📅 Hover a task and click its calendar | Sets or changes that task's date. |
| 🖱️ Right-click a task | Every action: **Done**, **Change date…**, **Remove date**, **Open in Notion** and **Open in Google Calendar**. |
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
| **Update** | Install the new `.deb` on top of the old one, or replace the AppImage file. |
| **Uninstall** | `sudo apt remove salchi` for the `.deb` (it also removes its AppArmor profile), or delete the AppImage file and `~/.config/autostart/salchi.desktop`. |
| **Your data** | `~/.config/Salchi/config.json` (token encrypted with your keyring when available) |

## 🩺 Troubleshooting

<details>
<summary>The dog has a red “!” and the list shows an error</summary>

<br>

Hover to read it. Usually it is one of these: no internet connection; the token was pasted incompletely; or the page/database is not shared with your integration (**••• → Connections** in Notion).

</details>

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
