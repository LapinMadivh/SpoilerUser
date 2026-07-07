/**
 * @name SpoilerUser
 * @author Lapin
 * @description Ajoute une liste de pseudos dont tous les messages seront automatiquement floutés (spoiler), cliquables pour révéler.
 * @version 1.0.0
 */

module.exports = class SpoilerUser {
    constructor() {
        this.styleId = "spoileruser-style";
        this.observer = null;
        this.intervalId = null;
        this.MessageStore = null;
        this.SelectedChannelStore = null;
    }

    getSettings() {
        return BdApi.Data.load("SpoilerUser", "users") || [];
    }

    saveSettings(users) {
        BdApi.Data.save("SpoilerUser", "users", users);
    }

    hasUser(name) {
        const lower = name.toLowerCase();
        return this.getSettings().some(u => u.toLowerCase() === lower);
    }

    addUser(name) {
        if (!name) return;
        const users = this.getSettings();
        if (!users.some(u => u.toLowerCase() === name.toLowerCase())) {
            users.push(name);
            this.saveSettings(users);
            this.forceRescan();
            BdApi.UI.showToast(`${name} ajouté à SpoilerUser`, { type: "success" });
        }
    }

    removeUser(name) {
        const lower = name.toLowerCase();
        const users = this.getSettings().filter(u => u.toLowerCase() !== lower);
        this.saveSettings(users);
        this.forceRescan();
        BdApi.UI.showToast(`${name} retiré de SpoilerUser`, { type: "success" });
    }

    toggleUser(name) {
        if (this.hasUser(name)) this.removeUser(name);
        else this.addUser(name);
    }

    forceRescan() {
        document.querySelectorAll('[data-spoileruser-done]').forEach(n => n.removeAttribute("data-spoileruser-done"));
    }

    start() {
        this.MessageStore = BdApi.Webpack.getStore("MessageStore");
        this.SelectedChannelStore = BdApi.Webpack.getStore("SelectedChannelStore");

        if (!this.MessageStore || !this.SelectedChannelStore) {
            BdApi.UI.showToast("SpoilerUser: impossible de charger les modules Discord.", { type: "error" });
            return;
        }

        this.injectStyle();

        // Traite les messages déjà présents à l'écran
        this.scanAll();

        // Observe les nouveaux messages / changements de channel
        this.observer = new MutationObserver(() => this.scanAll());
        this.observer.observe(document.body, { childList: true, subtree: true });

        // Filet de sécurité pour les messages chargés en lazy / virtualisés
        this.intervalId = setInterval(() => this.scanAll(), 1500);

        this.patchContextMenus();
    }

    patchContextMenus() {
        // Clic droit sur un pseudo (profil, liste des membres, mentions...)
        this.unpatchUserContext = BdApi.ContextMenu.patch("user-context", (returnValue, props) => {
            const user = props?.user;
            if (!user) return returnValue;

            const already = this.hasUser(user.username);
            returnValue.props.children.push(
                BdApi.ContextMenu.buildItem({
                    type: "text",
                    label: already ? "Retirer de SpoilerUser" : "Ajouter à SpoilerUser",
                    action: () => this.toggleUser(user.username)
                })
            );
            return returnValue;
        });

        // Clic droit sur un message (pratique quand on ne connaît que le pseudo affiché sur le message)
        this.unpatchMessageContext = BdApi.ContextMenu.patch("message", (returnValue, props) => {
            const author = props?.message?.author;
            if (!author) return returnValue;

            const already = this.hasUser(author.username);
            returnValue.props.children.push(
                BdApi.ContextMenu.buildItem({
                    type: "text",
                    label: already ? "Retirer de SpoilerUser" : "Ajouter à SpoilerUser",
                    action: () => this.toggleUser(author.username)
                })
            );
            return returnValue;
        });
    }

    stop() {
        if (this.observer) this.observer.disconnect();
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.unpatchUserContext) this.unpatchUserContext();
        if (this.unpatchMessageContext) this.unpatchMessageContext();
        BdApi.DOM.removeStyle(this.styleId);

        // Nettoie les wrappers ajoutés
        document.querySelectorAll(".spoileruser-wrapper").forEach(wrapper => {
            const inner = wrapper.querySelector(".spoileruser-inner");
            if (inner) wrapper.replaceWith(...inner.childNodes);
        });
    }

    injectStyle() {
        BdApi.DOM.addStyle(this.styleId, `
            .spoileruser-wrapper {
                position: relative;
                cursor: pointer;
                border-radius: 3px;
            }
            .spoileruser-inner {
                filter: blur(6px);
                transition: filter 0.15s ease;
                user-select: none;
            }
            .spoileruser-wrapper.revealed .spoileruser-inner {
                filter: none;
                user-select: text;
            }
            .spoileruser-overlay {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,0.55);
                color: #fff;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                border-radius: 3px;
                pointer-events: none;
            }
            .spoileruser-wrapper.revealed .spoileruser-overlay {
                display: none;
            }
        `);
    }

    scanAll() {
        const users = this.getSettings();
        if (!users.length) return;

        const channelId = this.SelectedChannelStore.getChannelId();
        if (!channelId) return;

        const nodes = document.querySelectorAll('[id^="message-content-"]:not([data-spoileruser-done])');
        nodes.forEach(el => this.processNode(el, channelId, users));
    }

    processNode(el, channelId, users) {
        el.setAttribute("data-spoileruser-done", "1");

        const messageId = el.id.replace("message-content-", "");
        const message = this.MessageStore.getMessage(channelId, messageId);
        if (!message || !message.author) return;

        const username = (message.author.username || "").toLowerCase();
        const globalName = (message.author.globalName || "").toLowerCase();

        const match = users.some(u => {
            const name = u.toLowerCase();
            return name === username || name === globalName;
        });

        if (!match) return;

        // Empêche de re-wrap si déjà fait
        if (el.closest(".spoileruser-wrapper")) return;

        const wrapper = document.createElement("span");
        wrapper.className = "spoileruser-wrapper";

        const inner = document.createElement("span");
        inner.className = "spoileruser-inner";

        // Déplace le contenu existant dans le wrapper
        while (el.firstChild) {
            inner.appendChild(el.firstChild);
        }

        const overlay = document.createElement("span");
        overlay.className = "spoileruser-overlay";
        overlay.textContent = "Spoiler";

        wrapper.appendChild(inner);
        wrapper.appendChild(overlay);
        el.appendChild(wrapper);

        wrapper.addEventListener("click", (e) => {
            e.stopPropagation();
            wrapper.classList.toggle("revealed");
        });
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.color = "var(--text-normal)";

        const label = document.createElement("div");
        label.textContent = "Pseudos à masquer (nom d'utilisateur ou display name) :";
        label.style.marginBottom = "8px";
        label.style.fontWeight = "600";
        panel.appendChild(label);

        const list = document.createElement("ul");
        list.style.listStyle = "none";
        list.style.padding = "0";
        list.style.marginBottom = "10px";
        panel.appendChild(list);

        const renderList = () => {
            list.innerHTML = "";
            const users = this.getSettings();
            users.forEach((name, idx) => {
                const li = document.createElement("li");
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.alignItems = "center";
                li.style.padding = "4px 8px";
                li.style.marginBottom = "4px";
                li.style.background = "var(--background-secondary)";
                li.style.borderRadius = "4px";

                const span = document.createElement("span");
                span.textContent = name;
                li.appendChild(span);

                const removeBtn = document.createElement("button");
                removeBtn.textContent = "✕";
                removeBtn.style.background = "transparent";
                removeBtn.style.border = "none";
                removeBtn.style.color = "var(--text-danger)";
                removeBtn.style.cursor = "pointer";
                removeBtn.onclick = () => {
                    this.removeUser(name);
                    renderList();
                };
                li.appendChild(removeBtn);

                list.appendChild(li);
            });
        };

        const inputRow = document.createElement("div");
        inputRow.style.display = "flex";
        inputRow.style.gap = "8px";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "pseudo Discord";
        input.style.flex = "1";
        input.style.padding = "6px 8px";
        input.style.borderRadius = "4px";
        input.style.border = "1px solid var(--background-tertiary)";
        input.style.background = "var(--background-tertiary)";
        input.style.color = "var(--text-normal)";

        const addUser = () => {
            const name = input.value.trim();
            if (!name) return;
            this.addUser(name);
            renderList();
            input.value = "";
        };

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") addUser();
        });

        const addBtn = document.createElement("button");
        addBtn.textContent = "Ajouter";
        addBtn.style.padding = "6px 12px";
        addBtn.style.borderRadius = "4px";
        addBtn.style.border = "none";
        addBtn.style.background = "var(--brand-experiment)";
        addBtn.style.color = "#fff";
        addBtn.style.cursor = "pointer";
        addBtn.onclick = addUser;

        inputRow.appendChild(input);
        inputRow.appendChild(addBtn);
        panel.appendChild(inputRow);

        renderList();

        return panel;
    }
};
