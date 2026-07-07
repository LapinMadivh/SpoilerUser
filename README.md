# SpoilerUser

A BetterDiscord plugin that automatically blurs (spoiler-style) all messages from one or more chosen usernames. Click a blurred message to reveal it.
<img width="1036" height="103" alt="image" src="https://github.com/user-attachments/assets/be8649ee-8a05-47b7-8f88-b0f9c508024f" />

## Installation

1. Download `SpoilerUser.plugin.js`
2. Place the file in your BetterDiscord plugins folder:
   - **Windows**: `%appdata%\BetterDiscord\plugins`
   - **macOS**: `~/Library/Application Support/BetterDiscord/plugins`
   - **Linux**: `~/.config/BetterDiscord/plugins`
3. In Discord: `Settings` > `Plugins` > enable **SpoilerUser**

## Usage

### Adding a username

Three ways to do it:

- **Settings panel**: `Settings` > `Plugins` > ⚙️ icon on SpoilerUser > type the username > `Add`
- **Right-click a username** (in the member list, a profile, a mention...) > `Add to SpoilerUser`
- **Right-click a message** > `Add to SpoilerUser` (uses the message's author, handy if you don't know the exact username)

### Removing a username

- `✕` button next to the name in the settings panel
- Or right-click the username / message again → the option becomes `Remove from SpoilerUser`

### Revealing a blurred message

Just click the blurred message to reveal it. Click it again to re-blur it.

## How it works

- Each message is identified via its `message-content-<id>` DOM element, and the actual author is retrieved through Discord's internal `MessageStore` (Webpack) rather than by parsing the displayed text — more reliable, especially with grouped messages.
- Matching is done against both `username` and `globalName` (display name), case-insensitive.
- A `MutationObserver` catches new messages in real time, backed by a `setInterval` (1.5s) safety net to catch lazily-loaded/virtualized messages.
- Usernames are saved via `BdApi.Data`, so they persist across sessions.

## Known limitations

- The `"user-context"` and `"message"` navIds used to hook into the context menus are Discord-internal identifiers. A Discord update could change them, which would remove the right-click option (the rest of the plugin would keep working).
- Matching is based on the user's global Discord username, not a server-specific nickname.

## Ideas for future improvements

- Per-server username lists instead of a global one
- A keyboard shortcut to reveal everything at once
- Also blur images/attachments sent by the person
