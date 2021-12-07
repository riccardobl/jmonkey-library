import Ui from './ui.js';
import Entries from "../Entries.js";
import Auth from "../Auth.js";
import Media from "../Media.js";
import Utils from "/common/Utils.js";
import Config from "../Config.js";
import Payment from "../Payment.js";
import ExtImporter from "../ExtImporter.js";
import Tasks from './Tasks.js';
import Dialogs from '../Dialogs.js';
export default class UiEntry {


    static async load(parentEl, userId, entryId) {
        // Ui.loading(true, "Loading... ", 10000);
        Tasks.completable("loading", "Loading entry...", {}, true, false, undefined, false);
        // Ui.waitTask("loading","Loading entry...",{},false,false,10000);

        const onSaveListeners = [];
        try {




            // Get entry from backend
            const entry = await Entries.get(userId, entryId);

            // Get media
            const media = await Media.getAll(
                userId,
                entryId,
                4 // 4 media per page
            );



            await this.loadEntry(
                parentEl,
                entry,
                media,
                false
            );

            // const reload = async (editMode) => {
            //     await this.load(parentEl, namespace, entryId, editMode);
            // };
        } catch (e) {
            Ui.error(e);
        }
    }

    static async loadEntry(parentEl, entry, media, editMode, forceSave) {
        // Get entry def api
        const def = (await Entries.getApi()).getDefByType("database");

        // Ui.loading(true, "Loading " + entry.entryId + (editMode ? " in edit mode..." : "..."), 10000);
        // Ui.waitTask("loading","Loading "+ entry.entryId + (editMode ? " in edit mode..." : "..."),{},false,false,10000);
        Tasks.completable("loading", "Loading entry " + entry.entryId + "...", {}, true, false, undefined, false);
        // Create destination for edited values if in editMode
        const editedEntry = editMode ? Utils.clone(entry) : undefined;


        // Create destination for edited values if in editMode
        const editedMedia = {
            media: media.map(el => {
                return {
                    changed: forceSave,
                    data: el[0]
                }
            })
        };//editMode?Utils.clone(media):undefined;

        // Reload action
        const reload = async (editMode, newEntry, newMedia, forceSave) => {

            await this.loadEntry(parentEl, newEntry ? newEntry : entry, newMedia ? newMedia : media, editMode, forceSave);
            // Utils.reload();
        };

        // Save action
        const onSaveListeners = [];
        const saveEntry = !editMode ? () => { console.log("Do nothing. Edit mode disabled") } : async () => {
            try {

                Tasks.completable("save", "Saving...", {}, true, false, false, undefined, false);
                // update entry
                console.log("Update entry");
                Tasks.completable("save", "Updating entry...", {}, true, false, false, undefined, false);
                await Entries.set(editedEntry);


                // update media
                // if (editedMedia.changed) {
                console.log("Update media");
                const editedMediaNonNull = editedMedia.media;//.filter(m => m&&m.data); // remove undefined
                for (let i = 0; i < Math.min(editedMediaNonNull.length, 4); i++) {

                    // if (!forceSave&&editedMediaNonNull[i] == media[i]) { // media is the same, don't reupload
                    //     console.log("Media", i, "unchanged. Skip update");
                    //     continue;
                    // }
                    // if (!editedMediaNonNull[i].startsWith("data:")) continue;
                    if (!editedMediaNonNull[i] || !editedMediaNonNull[i].changed) continue;
                    Tasks.completable("save", "Uploading media " + i + "...", {}, true, false, undefined, false);

                    console.log("Update media", i, editedMediaNonNull[i].data);
                    if (editedMediaNonNull[i].data) {
                        await Media.set(
                            editedEntry.userId,
                            editedEntry.entryId,
                            i,
                            editedMediaNonNull[i].data
                        );
                    } else {
                        Tasks.completable("save", "Deleting media " + i + "...", {}, true, false, undefined, false);
                        try {
                            await Media.unset(
                                editedEntry.userId,
                                editedEntry.entryId,
                                i
                            );
                        } catch (e) {
                            console.error(e);
                        }
                    }

                }
                // }

                // Call listeners
                for (let i in onSaveListeners) await onSaveListeners[i]();

                await this.load(parentEl, entry.userId, entry.entryId);


            } catch (e) {
                console.error(e);
                Ui.error(e);
            } finally {
                Tasks.ok("save", "Saved.");
            }
        };

        await parentEl.clear();
        parentEl.setAttribute("id", "entryPage");
        // Warning messages for blocked entries
        await this.loadWarns(parentEl, entry);
        //

        // Importer
        if (editMode) await this.loadImporter(parentEl, reload);
        //

        // Showcase
        await this.loadShowcase(parentEl, editMode, entry, editedEntry, media, editedMedia, def);
        //


        // Main menu 
        await this.loadMainMenu(parentEl, entry, editedEntry, saveEntry, reload);
        //


        // Summary
        if (editMode) {
            const summaryRow = Ui.createSection(parentEl, ["responsiveWidth"]);
            const summaryEl = Ui.createArticle("summary", "fa-puzzle-piece", "Summary");
            summaryRow.appendChild(summaryEl);
            summaryEl.content.innerText = entry.descriptionSummary;
            Ui.createEditorFor(
                summaryEl.content,
                "Summary: Text that will be shown in previews. No HTML or Markdown, only plain text",
                `<textarea></textarea>`,
                async (el) => el.value = entry.descriptionSummary,
                (e) => editedEntry.descriptionSummary = e.target.value
            );
        }

        const firstRowEl = Ui.createSection(parentEl, ["responsiveWidth", "withSideMenu"]);

        // DESCRIPTION
        const descriptionEl = Ui.createArticle("description", "fas fa-paragraph", "Description");
        firstRowEl.appendChild(descriptionEl);
        descriptionEl.content.innerHTML += Utils.renderMarkdown(entry.description);
        if (editMode) {
            Ui.createEditorFor(
                descriptionEl.content,
                "Description: Supports Markdown and basic HTML",
                `<textarea></textarea>`,
                async (el) => el.value = entry.description,
                (e) => editedEntry.description = e.target.value
            );
        }

        // DETAILS
        const menuElArt = Ui.createArticle("details", "fas fa-bars", "Details");
        firstRowEl.appendChild(menuElArt);
        const menuEl = Ui.createMenu();
        menuElArt.content.append(menuEl);

        // Payments
        await this.loadPayment(parentEl, menuEl, entry, editedEntry, editMode, onSaveListeners);

        // Buttons
        if (entry.download || entry.repo || editMode) {
            const menuDownloadEl = menuEl.addSection("Download");
            if (entry.download || editMode) {
                const downloadBtn = menuDownloadEl.addItem(Ui.createButton("fas fa-download", "Download", entry.download || "", entry.download || ""));
                if (editMode) {
                    const input = Ui.createInputField(def.download);
                    Ui.createEditorFor(
                        downloadBtn,
                        "Download Link: ",
                        input,
                        (el) => el.value = entry.download || "",
                        (e) => editedEntry.download = e.target.value,
                        (toggled, editArea) => {
                            if (!toggled) delete editedEntry.download;
                            else editedEntry.download = editArea.value;
                        },
                        entry.download,
                        undefined, undefined, undefined,
                        entry.paidFields && entry.paidFields.includes("download"),
                        (toggle) => {
                            if (!editedEntry.paidFields) editedEntry.paidFields = [];
                            if (toggle) editedEntry.paidFields.push("download")
                            else editedEntry.paidFields = editedEntry.paidFields.filter(el => el != "download")
                        }
                    );
                    if (!entry.download) downloadBtn.classList.add("disabled");
                }
            }

            if (entry.repo || editMode) {
                const repoBtn = menuDownloadEl.addItem(Ui.createButton("fab fa-git-alt", "Repository / Source", entry.repo || "", entry.repo || ""));
                if (editMode) {
                    const input = Ui.createInputField(def.repo);
                    Ui.createEditorFor(
                        repoBtn,
                        "Repository/Source: ",
                        input,
                        (el) => el.value = entry.repo || "",
                        (e) => editedEntry.repo = e.target.value,
                        (toggled, editArea) => {
                            if (!toggled) delete editedEntry.repo;
                            else editedEntry.repo = editArea.value;
                        },
                        entry.repo,
                        undefined, undefined, undefined,
                        entry.paidFields && entry.paidFields.includes("repo"),
                        (toggle) => {
                            if (!editedEntry.paidFields) editedEntry.paidFields = [];
                            if (toggle) editedEntry.paidFields.push("repo")
                            else editedEntry.paidFields = editedEntry.paidFields.filter(el => el != "repo")
                        }
                    );
                    if (!entry.repo) repoBtn.classList.add("disabled");
                }
            }

        }
        if (entry.docs || entry.issues || entry.discussions || editMode) {
            const menuSupportEl = menuEl.addSection("Support");
            if (entry.docs || editMode) {
                const menuSupportDocsEl = menuSupportEl.addItem(Ui.createButton("fas fa-book-dead", "Documentation", entry.docs || "", entry.docs || ""));
                if (editMode) {
                    const input = Ui.createInputField(def.docs);
                    Ui.createEditorFor(
                        menuSupportDocsEl,
                        "Documentation: ",
                        input,
                        (el) => el.value = entry.docs || "",
                        (e) => editedEntry.docs = e.target.value,
                        (toggled, editArea) => {
                            if (!toggled) delete editedEntry.docs;
                            else editedEntry.docs = editArea.value;
                        },
                        entry.docs,
                        undefined, undefined, undefined,
                        editedEntry.paidFields && entry.paidFields.includes("docs"),
                        (toggle) => {
                            if (!editedEntry.paidFields) editedEntry.paidFields = [];
                            if (toggle) editedEntry.paidFields.push("docs")
                            else editedEntry.paidFields = editedEntry.paidFields.filter(el => el != "docs")
                        }
                    );
                    if (!entry.docs) menuSupportDocsEl.classList.add("disabled");
                }
            }
            if (entry.issues || editMode) {
                const menuSupportIssuesEl = menuSupportEl.addItem(Ui.createButton("fas fa-bug", "Report Issue", entry.issues || "", entry.issues || ""));
                if (editMode) {
                    const input = Ui.createInputField(def.issues);
                    Ui.createEditorFor(
                        menuSupportIssuesEl,
                        "Issue Tracker: ",
                        input,
                        (el) => el.value = entry.issues || "",
                        (e) => editedEntry.issues = e.target.value,
                        (toggled, editArea) => {
                            if (!toggled) delete editedEntry.issues;
                            else editedEntry.issues = editArea.value;
                        },
                        entry.issues,
                        undefined, undefined, undefined,
                        editedEntry.paidFields && entry.paidFields.includes("issues"),
                        (toggle) => {
                            if (!editedEntry.paidFields) editedEntry.paidFields = [];
                            if (toggle) editedEntry.paidFields.push("issues")
                            else editedEntry.paidFields = editedEntry.paidFields.filter(el => el != "issues")
                        }
                    );
                    if (!entry.issues) menuSupportIssuesEl.classList.add("disabled");
                }
            }
            if (entry.discussions || editMode) {
                const menuSupportDiscussionsEl = menuSupportEl.addItem(Ui.createButton("fab fa-discourse", "Discussions", entry.discussions || "", entry.discussions || ""));
                if (editMode) {
                    const input = Ui.createInputField(def.discussions);
                    Ui.createEditorFor(
                        menuSupportDiscussionsEl,
                        "Forum/Discussions: ",
                        input,
                        (el) => el.value = entry.discussions || "",
                        (e) => editedEntry.discussions = e.target.value,
                        (toggled, editArea) => {
                            if (!toggled) delete editedEntry.discussions;
                            else editedEntry.discussions = editArea.value;
                        },
                        entry.discussions,
                        undefined, undefined, undefined,
                        editedEntry.paidFields && entry.paidFields.includes("discussions"),
                        (toggle) => {
                            if (!editedEntry.paidFields) editedEntry.paidFields = [];
                            if (toggle) editedEntry.paidFields.push("discussions")
                            else editedEntry.paidFields = editedEntry.paidFields.filter(el => el != "discussions")
                        }
                    );
                    if (!entry.discussions) menuSupportDiscussionsEl.classList.add("disabled");
                }
            }
        }

        // Author
        const menuAuthorEl = menuEl.addSection("Author");
        const authorUser = await Auth.getUser(entry.userId);
        const userElement = Ui.createUserElement(authorUser);
        menuAuthorEl.addItem(userElement);

        // Tags
        const menuTagsEl = menuEl.addSection("Tags");
        if (editMode) {
            const tagsInput = Ui.createInputField(def.tags);
            Ui.createEditorFor(
                menuTagsEl,
                "<h2>Tags</h2> Comma separated list of tags:<br/>",
                tagsInput,
                (el) => el.value = (entry.tags || []).join(","),
                (e) => editedEntry.tags = e.target.value.split(",")
            );
        }
        entry.tags.forEach(tag => {
            const tagElement = Ui.createTagElement(tag);
            menuTagsEl.addItem(tagElement);
        });


        // Date
        const creationDate = new Date(entry.creationDate);
        const updateDate = new Date(entry.updateDate);

        const dateEl = menuEl.addSection("Created");
        dateEl.addItem(Ui.createText(`${creationDate.toLocaleDateString()} - ${creationDate.toLocaleTimeString()}`))

        const udateEl = menuEl.addSection("Updated");

        udateEl.addItem(Ui.createText(`${updateDate.toLocaleDateString()} - ${updateDate.toLocaleTimeString()}`))

        const secondRowEl = Ui.createSection(parentEl, ["responsiveWidth", entry.usage && entry.license ? "withSide" : ""]);

        // USAGE & LICENSE
        if (entry.usage || editMode) {
            const usageEl = Ui.createArticle("usage", "fas fa-book-dead", "Usage");
            secondRowEl.appendChild(usageEl);
            usageEl.content.innerHTML += Utils.renderMarkdown(entry.usage || "");
            if (editMode) Ui.createEditorFor(
                usageEl.content,
                "Usage Instructions: Supports Markdown and basic HTML",
                `<textarea></textarea>`,
                (el) => el.value = entry.usage || "",
                (e) => editedEntry.usage = e.target.value || "",
                (toggled, editArea) => {
                    if (!toggled) delete editedEntry.usage;
                    else editedEntry.usage = editArea.value;
                },
                entry.usage,
                undefined, undefined, undefined,
                editedEntry.paidFields && entry.paidFields.includes("usage"),
                (toggle) => {
                    if (!editedEntry.paidFields) editedEntry.paidFields = [];
                    if (toggle) editedEntry.paidFields.push("usage")
                    else editedEntry.paidFields = editedEntry.paidFields.filter(el => el != "usage")
                }
            );
        }


        if (entry.license || editMode) {
            const licenseEl = Ui.createArticle("license", "fas fa-id-badge", "License");
            secondRowEl.appendChild(licenseEl);
            licenseEl.content.innerHTML += Utils.renderMarkdown(entry.license || "");
            if (editMode) Ui.createEditorFor(
                licenseEl.content,
                "License: Supports Markdown and basic HTML",
                `<textarea></textarea>`,
                (el) => el.value = entry.license || "",
                (e) => editedEntry.license = e.target.value,
                (toggled, editArea) => {
                    if (!toggled) delete editedEntry.license;
                    else editedEntry.license = editArea.value;
                },
                entry.license,
                undefined, undefined, undefined,
                editedEntry.paidFields && entry.paidFields.includes("license"),
                (toggle) => {
                    if (!editedEntry.paidFields) editedEntry.paidFields = [];
                    if (toggle) editedEntry.paidFields.push("license")
                    else editedEntry.paidFields = editedEntry.paidFields.filter(el => el != "license")
                }
            );
        }


        // COMMENTS
        //     if (hubUrl) {
        //         const thirdRow = Ui.createSection(parentEl, ["responsiveWidth"]);
        //         const commentsEl = Ui.createArticle(thirdRow, "fa-comments", "Comments");
        //         commentsEl.innerHtml = ` <div class="content" id='discourse-comments'></div>
        //     <script type="text/javascript">
        //             const eurl=${commentsOriginUrl} ;

        //             DiscourseEmbed = { 
        //               discourseUrl: '${hubUrl}',
        //               discourseEmbedUrl: eurl
        //             };

        //             (function() {
        //               var d = document.createElement('script'); d.type = 'text/javascript'; d.async = true;
        //               d.src = DiscourseEmbed.discourseUrl + 'javascripts/embed.js';
        //               (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(d);
        //             })();
        //           </script>
        //   `;
        // }

        setTimeout(() => {
            Prism.highlightAll();
        }, 10);
        // Ui.loading(false);
        Tasks.ok("loading");
        // await parentEl.show();
    }


    static async loadImporter(parentEl, reload) {
        parentEl.appendChild(Ui.toEl("<hr>"));
        const autoImporterRow0 = Ui.createSection(parentEl, ["responsiveWidth", "hlist"]);
        autoImporterRow0.appendChild(Ui.createText(`<h2>Parse a remote source</h2>
            <br />
            You can import an entry from a remote source.
            <br />
            We will try to parse the source and extract the required informations. 
            <br />
            <br />
            Supported sources: store.jmonkeyengine.org, github.com
            
            `));
        const autoImporterRow = Ui.createSection(parentEl, ["responsiveWidth", "hlist", "searchbar"]);

        const autoImporterField = Ui.createInputField();
        autoImporterRow.appendChild(autoImporterField);
        const importBtn = Ui.createText(`<i class="fas fa-file-import"></i>`);
        autoImporterRow.appendChild(importBtn);
        parentEl.appendChild(Ui.toEl("<hr>"));
        Ui.setClickAction(importBtn, async () => {
            const source = autoImporterField.value;

            const importedData = await ExtImporter.import(source);
            await reload(true, importedData.entry, importedData.media, true);

        });

    }

    static async loadMainMenu(parentEl, entry, editedEntry, saveEntry, reload) {
        if (!await Auth.isLoggedIn()) {
            const msg = Ui.createMessage("", "LogIn to interract with this entry");
            parentEl.appendChild(msg);
            return;
        }
        const callerId = Auth.getCurrentUserID();
        const isCallerMod = Auth.isCurrentUserMod();

        const mainMenuRow = Ui.createSection(parentEl, ["responsiveWidth", "entryMenu"]);

        if (callerId == entry.userId || isCallerMod) {
            if (editedEntry) {
                mainMenuRow.append(Ui.createButton(
                    "fas fa-save", "Save", "Save changes", () => {
                        saveEntry()
                    }));

            } else {
                mainMenuRow.append(Ui.createButton("fas fa-edit", "Edit", "Open editor", () => {
                    reload(true)
                }));

            }
            if (editedEntry) {

                if (!entry.suspended) {
                    mainMenuRow.append(Ui.createButton("fas fa-dungeon", "Suspend", "The access to this entry will be suspended temporarily", () => {
                        const dialogContent = document.createElement("span");

                        dialogContent.innerHTML = `
                        Please write the reason for the suspension of this entry.
                        <br />
                        The suspension reason will be shown to everybody.
                        <br /><br />
                        <input type="text" />

                        <br /><br />
                        <sub>Note: The entry can be edited and republished by the owner or a moderator.</sub>`;
                        const reasonEl = dialogContent.querySelector("input");


                        Ui.showDialog("Suspend Entry", dialogContent, [
                            {
                                text: "Cancel",
                                action: async () => {

                                }
                            },
                            {
                                text: `Suspend  <i class="fas fa-dungeon"></i>`,
                                action: async () => {
                                    editedEntry.suspended = reasonEl.value || "No reason";
                                    console.log("Suspend with reason", reasonEl.value);

                                    saveEntry();
                                }
                            }
                        ])

                    }));
                } else {
                    mainMenuRow.append(Ui.createButton("fas fa-check-double", "Publish", "The entry will be published", () => {
                        delete editedEntry["suspended"];
                        saveEntry();
                    }));
                }
            }
        }
        if (isCallerMod && editedEntry) {
            if (!entry.banned) {
                mainMenuRow.append(Ui.createButton("fas fa-gavel", "Block", "Ban this entry", () => {
                    const dialogContent = document.createElement("span");
                    dialogContent.innerHTML = `
                    Please write the reason for which your are blocking this entry.
                    <br />
                    The ban reason will be shown to everybody.
                    <br /><br />
                    <input type="text" />
                    <br /><br />
                    <sub>Note: Only a moderator can unban the entry.</sub>`;

                    const reasonEl = dialogContent.querySelector("input");

                    Ui.showDialog("Block Entry", dialogContent, [
                        {
                            text: "Cancel",
                            action: async () => {

                            }
                        },
                        {
                            text: `Block  <i class="fas fa-gavel"></i>`,
                            action: async () => {
                                editedEntry.banned = reasonEl.value || "No reason";
                                console.log("Ban with reason", reasonEl.value);
                                saveEntry();
                            }
                        }
                    ])


                }));
            } else {
                mainMenuRow.append(Ui.createButton("fas fa-fire-extinguisher", "UnBlock", "Unban this entry", () => {
                    delete editedEntry["banned"];
                    saveEntry();
                }));
            }
        }
    }

    static async loadWarns(parentEl, entry) {
        const isCallerMod = Auth.isCurrentUserMod();
        const callerId = Auth.getCurrentUserID();

        if (entry.suspended) {

            parentEl.appendChild(Ui.createWarningMessage(`Suspended ~ This entry is suspended for the following reasons`, `
            <br/>

            ${entry.suspended}
            <br/>
            <br/>
            You can apply the required changes and click publish.
            `));

            // parentEl.appendChild(Ui.toEl("<hr>"));
            // const msgRow = Ui.createSection(parentEl, ["responsiveWidth", "hlist"]);
            // msgRow.appendChild(Ui.createText(`<h2>Suspended ~ This entry is suspended for the following reasons</h2>
            // <br />

            // `));
            // parentEl.appendChild(Ui.toEl("<hr>"));

            // const suspendedEl = Ui.createSection(parentEl, ["responsiveWidth", "suspended"]);
            // const suspendedArtEl = Ui.createArticle(suspendedEl, "", "Suspended ~ This entry is suspended for the following reasons");
            // suspendedArtEl.innerHTML = `${entry.suspended}
            // <br/><br/>You can apply the required changes and click publish.`;
            if (!isCallerMod && callerId != entry.entryId.userId) return;
        }

        if (entry.banned) {
            parentEl.appendChild(Ui.createErrorMessage(`Blocked ~ This entry is blocked for the following reasons`, `
            <br/>

            ${entry.banned}<br /><br >Only a moderator can unblock this entry
            `));

            // const bannedEl = Ui.createSection(parentEl, ["responsiveWidth", "banned"]);
            // const bannedArtEl = Ui.createArticle(bannedEl, "", "Blocked ~ This entry is blocked for the following reasons");
            // bannedArtEl.innerHTML = `${entry.banned}<br /><br >Only a moderator can unblock this entry`;
            if (!isCallerMod && callerId != entry.entryId.userId) return;
        }
    }

    static async loadShowcase(parentEl, editMode, entry, editedEntry, media, editedMedia, def) {
        const showcase = Ui.createShowCase(entry.name + " " + entry.version, true);
        media.forEach(m => {
            showcase.addItem(m[0], m[2]);
        });
        parentEl.appendChild(showcase);

        // }

        if (editMode) {
            const titleAndVersion = document.createElement("div");
            const titleEdEl = Ui.createInputField(def.name);
            const versionEdEl = Ui.createInputField(def.version);

            titleAndVersion.appendChild(Ui.toEl(`<label>Name:  </label>`));
            titleAndVersion.appendChild(titleEdEl);

            titleAndVersion.appendChild(Ui.toEl(`<label>Version:  </label>`));
            titleAndVersion.appendChild(versionEdEl);
            Ui.createEditorFor(showcase.titleElement, "", titleAndVersion, (editArea) => {
                titleEdEl.value = entry.name;
                versionEdEl.value = entry.version;
            }, (editArea) => {
                editedEntry.name = titleEdEl.value;
                editedEntry.version = versionEdEl.value;
            });

            Ui.createUploader(showcase.mediaListElement, "Upload Media", `
            Supported image files: .png .jpg 
            <br />
            Supported video files: .webp .mp4
            
            `, 4,


                (i, data) => { // on change
                    editedMedia.media[i] = {
                        changed: true,
                        data: data
                    }
                },
                (i, preview) => { // on content pull
                    if (!media[i]) return;
                    const data = media[i][0];
                    preview.setData(data);
                }, showcase.parentElement,
                (editing) => {
                    showcase.querySelector("#showCaseNext").style.display = editing ? "none" : "block";
                    showcase.querySelector("#showCasePrev").style.display = editing ? "none" : "block";
                });
        }
    }

    static async loadPayment(parentEl, menuEl, entry, editedEntry, editMode, onSaveListeners) {
        if (!await Auth.isLoggedIn() && (entry.paid || editMode)) {
            const section = menuEl.addSection("");

            section.addItem(Ui.createWarningMessage("", `<b>LogIn required.</b>
            <br />
            <br />
            This entry has paid features that are accessible only to logged in users.
            `));

            return;
        }
        const userId = entry.userId;
        const entryId = entry.entryId;


        const config = await Config.get();
        const chain = Object.keys(config.paymentChains)[0];

        if (entry.paid || editMode) {

            if (!await Payment.isCurrentWalletConnected(chain)) {
                // if (entry.paid||editMode) {
                const section = menuEl.addSection("");
                section.addItem(Ui.createWarningMessage("", `Wallet is not connected.
                <br />
                Please <a href="#Wallet!user=${Auth.getCurrentUserID()}">connect a wallet</a> to enable payment options.`));


                return;
            } else if (editMode && !await Payment.isSellerContractEnabled((await Payment.getAddresses(userId, chain))[0], userId, chain)) {
                if (entry.paid || editMode) {
                    const section = menuEl.addSection("");
                    section.addItem(Ui.createWarningMessage("", `The current user is not a seller.
                <br />
                Please <a href="#Wallet!user=${Auth.getCurrentUserID()}">enable the seller contract</a> for this user
                to use payment features.`));

                }
                return;
            }


            const purchaseId = await Payment.getPurchaseId(userId, entryId, Auth.getCurrentUserID(), chain);
            console.log("Paid entry", entry.paid);
            let price = (await Payment.getPrice(userId, entryId, chain)) || 0;

            if (!entry.paid && !editMode && !purchaseId) return;
            if( !purchaseId&&price==0&&!editMode)return;

            const symbol = config.paymentChains[chain].nativeCurrency.symbol;

            const initialPrice = await Payment.getPrice(userId, entryId, chain) || 0;
            const initialText = await Payment.getMessage(userId, entryId, chain) || "Donate";

            console.log(config.paymentChains[chain]);
            let text = await Payment.getMessage(userId, entryId, chain) || "Donate";
            onSaveListeners.push(async () => {
                // (async () => {
                    if (price <= 0) Ui.error("Can't sell for <=0");
                    console.log("Sell for", price, editedEntry.paid);
                    if (editedEntry.paid) {
                        if (price != initialPrice || text != initialText) {
                            await Payment.sell(entry.entryId, price, text, chain);
                        }
                    } else if (!editedEntry.paid && entry.paid) {
                        await Payment.unsell(entry.entryId, chain);
                    }
                // })();
            });

            let menuPaySectionEl;

            if (purchaseId && !editMode) { // If entry has been purchased
                const price = await Payment.getPurchasePrice(userId, purchaseId, chain);
                const message = await Payment.getPurchaseMessage(userId, purchaseId, chain);
                menuPaySectionEl = menuEl.addSection(message);
                const shownPrice=(await Payment.toHumanValue(price, chain));

                menuPaySectionEl.addItem(Ui.createText(`<i class="fas fa-check"></i> You paid ` + shownPrice + ` ${symbol}`));
                const isRefundable = await Payment.isPurchaseRefundable(userId, purchaseId, chain);
                
                menuPaySectionEl.addItem(Ui.createButton("fas fa-exchange-alt", isRefundable ? "Request a refund" : "Refund time expired",
                    "Request a refund", async () => {
                        if (!isRefundable) return;
                        const sellerAddr=(await Payment.getAddresses(userId, chain))[0]
                        const sellerContract= (await Payment.getSellerContract(sellerAddr,userId,chain)).options.address

                        Dialogs.showRefundDialog(config.paymentChains[chain],sellerContract,shownPrice,async ()=>{
                       await Payment.refund(entry.userId, entry.entryId, chain);

                        })
                    }, [isRefundable ? "enabled" : "disabled"]));
            }

            // if ((price && entry.paid) || editMode) { // If entry is a paid entry or in editmode
            if (!menuPaySectionEl) menuPaySectionEl = menuEl.addSection(!editMode ? text : "Payment Settings");

            if (!purchaseId  || editMode) { // If never bought  or edit mode        
                let shownPrice = await Payment.toHumanValue(price, chain);
                if (shownPrice == 0) shownPrice = config.paymentChains[chain].defaultPricing;
                const buyButtonEl = menuPaySectionEl.addItem(Ui.createButton("fas fa-shopping-cart",
                    "Pay " + shownPrice + " " + symbol, "Pay", async () => {
                        if (!editMode) {
                            const sellerAddr=(await Payment.getAddresses(userId, chain))[0]
                            Dialogs.showBuyDialog(config.paymentChains[chain],sellerAddr,
                                (await Payment.getSellerContract(sellerAddr,userId,chain)).options.address
                                ,shownPrice,async ()=>{
                                await Payment.buy(entry.userId, entry.entryId, chain);
                            });
                        }
                    }, ["donateCl"])); // BUY

                if (editMode) { // EDITOR FOR BUY
                    if (editedEntry.paid) {
                        parentEl.classList.add("paid");
                    } else {
                        parentEl.classList.remove("paid");
                    }
                    Ui.createEditorFor( // PRICE EDITOR
                        buyButtonEl,
                        "Price: ",
                        Ui.createInputField(shownPrice),
                        async (el) => {
                            el.value = shownPrice;
                            price = await Payment.fromHumanValue(el.value, chain);

                        },
                        async (e) => {
                            price = await Payment.fromHumanValue(e.target.value, chain);
                        },
                        (toggled, editArea) => {
                            if (!toggled) {
                                delete editedEntry.paidFields;
                                delete editedEntry.paid;
                                parentEl.classList.remove("paid");
                            } else {
                                editedEntry.paid = true
                                parentEl.classList.add("paid");
                            }
                        },
                        entry.paid
                    );

                    Ui.createEditorFor( // TITLE EDITOR
                        menuPaySectionEl.addItem(Ui.createText("Title: " + text)),
                        "Title: ",
                        Ui.createInputField(text),
                        (el) => {
                            el.value = text;
                        },
                        (e) => {
                            text = e.target.value;
                        }
                    );
                }
            }
            // }
        }
    }
}