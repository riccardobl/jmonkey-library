import Tasks from "./Tasks.js";
import Utils from "/common/Utils.js";
import UrlParams from "../UrlParams.js";

export default class Ui {

    static init() {



    }
    static createDiv(classes){
        const el=document.createElement("div");
        this.addClasses(el,classes);
        return el;
    }
    static createSection(parent, classes) {
        const sc = document.createElement("section");
        classes.forEach(cl => {
            if (cl != "") sc.classList.add(cl);
        });
        if(parent)parent.appendChild(sc);
        return sc;
    };

    static addClasses(el, classes) {
        if (classes) classes.forEach(c => el.classList.add(c));
        return el;
    }

    static toEl(htmlEl, classes) {
        if (typeof htmlEl == "string") {
            const tmp = document.createElement("div");
            tmp.innerHTML = htmlEl;
            htmlEl = tmp.querySelector("div > *");
        }
        this.addClasses(htmlEl, classes);
        return htmlEl;

    }

    static createTable(header, classes) {
        const table = document.createElement("table");
        this.addClasses(table, classes);
        const createRow = () => {
            const row = document.createElement("tr");
            return row;
        }
        const createCell = (content, head) => {
            content = this.toEl(content);
            const cell = document.createElement(head ? "th" : "td");
            cell.append(content);
            return cell;
        }
        if (header) {
            const headRow = table.appendChild(createRow());
            header.forEach(content => headRow.appendChild(createCell(this.createText(content), true)));
        }
        table.addRow = (classes) => {
            const tr = table.appendChild(createRow());
            this.addClasses(tr, classes);

            tr.addCell = (content, classes) => {
                const td = tr.appendChild(createCell(content, false));
                this.addClasses(td, classes);
                td.content = content;
                return td;
            };
            return tr;
        }
        return table;
    }

    static createParagraph(text, classes) {
        const el = document.createElement("p");
        if (classes) classes.forEach(c => el.classList.add(c));
        el.innerHTML = text;
        return el;
    }
    static createText(text, classes) {
        const el = document.createElement("span");
        if (classes) classes.forEach(c => el.classList.add(c));
        el.innerHTML = text;
        return el;
    }

    static error(msg) {
        console.error(msg);

        Tasks.error("error", ("" + msg).substring(0, 100));
        // Ui.waitTask("error",msg.substring(0,100),false,false,10000);
        // alert(msg);
        // this.loading(false);
    }


    static createMessage(title, text, classes) {
        const parentEl = document.createElement("div");
        this.addClasses(parentEl, classes);
        this.addClasses(parentEl, ["msg"]);

        parentEl.appendChild(Ui.toEl("<hr>"));
        // const msgRow = Ui.createSection(parentEl, ["responsiveWidth", "hlist"]);
        parentEl.appendChild(Ui.createText(`<h2>${title}</h2>
            <span>
            ${text}
            </span>        
        `));
        parentEl.appendChild(Ui.toEl("<hr>"));

        // if(title&&title!=""){
        //     el.innerHTML=`<h3><i class="fas fa-exclamation-triangle"></i> ${title} <i class="fas fa-exclamation-triangle"></i></h3>`

        // }

        // el.innerHTML+=text;

        return parentEl;
    }
    static createErrorMessage(title, text, classes) {
        if (!classes) classes = [];
        classes.push("errorMsg");
        return this.createMessage(title, text, classes);
    }


    static appendCover(content, media, blurred) {
        if (!media) return;
        if (!media.startsWith("data:")) {
            media = `'${media}'`;
        }
        if (blurred) {
            if (!blurred.startsWith("data:")) {
                blurred = `'${blurred}'`;
            }
        } else {
            // preview = media;
        }

        const cover = document.createElement("div");
        cover.classList.add("cover");
        cover.style.backgroundImage = `url(${media})`;
        content.append(cover);

        if (blurred) {
            const blur = document.createElement("div");
            blur.classList.add("cover");
            blur.classList.add("blur");
            blur.style.backgroundImage = `url(${blurred})`;
            content.append(blur);
        }
    }

    static createWarningMessage(title, text, classes) {
        if (!classes) classes = [];
        classes.push("warnMsg");
        return this.createMessage(title, text, classes);
    }

    static loading(v, msg, timeout, parent) {
        console.log("Loading", v)
        let loadingEl = parent ? parent.querySelector("#loading") : document.querySelector("body > #loading");
        if (v) {
            if (!loadingEl) {
                loadingEl = document.createElement("div");
                loadingEl.setAttribute("id", "loading");
                if (parent) {
                    parent.append(loadingEl);
                } else {
                    document.body.append(loadingEl);
                }
            }

            loadingEl.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>${msg}</span>`;
            if (timeout) {
                setTimeout(() => {
                    this.loading(false);
                }, timeout);
            }
        } else {
            if (loadingEl) {
                setTimeout(() => loadingEl.remove(), 1000);
            }
        }
    }


    static createInputField(def, type) {
        const input = document.createElement("input");
        input.setAttribute("type", type || "text");
        if (def) {
            if (def.maxLength) {
                input.setAttribute("maxlength", def.maxLength);
            }
            if (def.minLength) {
                input.setAttribute("minlength", def.minLength);
            }
            if (def.sanitize && def.sanitize.filter) {
                input.setAttribute("pattern", def.sanitize.filter);
                input.setAttribute("title", def.sanitize.filter);

            }
            input.addEventListener("input", () => {
                input.reportValidity();
            });
        }
        return input;
    }
    static createTagElement(tag) {
        tag = tag.toLowerCase();
        const cnt = document.createElement("span");
        cnt.innerHTML = `<i class="fas fa-hashtag"></i>${tag}`;
        this.setClickAction(cnt, ()=>{
            UrlParams.replace({
                s:`${("#" + tag)}`
            });
        });
            
        return cnt;
    }
    static createUserElement(userData) {
        const cnt = document.createElement("span");
        cnt.innerHTML = `<i class="fas fa-at"></i>${userData.userName}`;
        this.setClickAction(cnt,  ()=>{ UrlParams.replace({
            s:`${("@" + userData.userId)}`
        });});
            

        return cnt;
    }
    static createEditButton(callback) {

        const editButton = document.createElement("span");


        const editButtonText = document.createElement("span");
        editButtonText.innerText = "Edit ";
        editButton.append(editButtonText);

        const editButtonIcon = document.createElement("i");
        editButtonIcon.setAttribute("class", "fas fa-pencil-alt");
        editButton.append(editButtonIcon);
        editButton.classList.add("editButton");


        let editing = false;
        editButton.addEventListener("click", async () => {
            editing = !editing;
            if (editing) {
                editButtonText.innerText = "Revert ";
                editButtonIcon.setAttribute("class", "fas fa-undo-alt");

            } else {
                editButtonText.innerText = "Edit ";
                editButtonIcon.setAttribute("class", "fas fa-pencil-alt");


            }
            callback(editing);
        });
        return editButton;
    }

    static createToggle(text,onToggle,toggled,enabled, left){
        if(!toggled)toggled=false;
        if(typeof enabled==="undefined")enabled=true;
        const toggleBtn = document.createElement("span");
        toggleBtn.classList.add("toggleBtn");

        const toggleBtnText = document.createElement("span");
        toggleBtnText.innerText = text+" ";

        const toggleBtnIcon = document.createElement("i");
        toggleBtnIcon.className = "fas fa-check-square";
        toggleBtn.append(toggleBtnIcon);
        if(left){
            toggleBtn.append(toggleBtnIcon);

            toggleBtn.append(toggleBtnText);

        }else{
            toggleBtn.append(toggleBtnText);
            toggleBtn.append(toggleBtnIcon);

        }



        const toggle = (toggled, transparent) => {
            if (toggled) {
                toggleBtnIcon.classList = "far fa-square";
                if (!transparent) onToggle(false);
                toggled = false;

            } else {
                toggleBtnIcon.classList = "fas fa-check-square";

                if (!transparent) onToggle(true);
                toggled = true;

            }
            return toggled;
        };
        toggle(!toggled, true);
        if(enabled){
            toggleBtn.addEventListener("click", ev => {
                toggled = toggle(toggled);
            });
        }else{
            toggleBtn.classList.add("disabled");
        }
        return toggleBtn;
    }

    static createEditorFor(forElement, label, editArea, onContentPull, onEdit, onToggle, toggled, attachEditorTo, attachButtonTo, onEditButtonClick, paid, onPaidToggle) {

        let editAreaEl = this.toEl(editArea);

        const editor = document.createElement("editor");
        console.info(forElement.parentElement);
        forElement.parentElement.append(editor);
        (attachEditorTo ? attachEditorTo : forElement.parentElement).append(editor);
        editAreaEl.editor = editor;


        const editorButtons = document.createElement("div");
        editorButtons.className = "editorButtons";
        (attachButtonTo ? attachButtonTo : forElement.parentElement).append(editorButtons);

        onContentPull(editAreaEl);

        const editButton = this.createEditButton(async (editing) => {
            if (editing) {
                forElement.setAttribute("editing-original-display", forElement.style.display);

                forElement.style.display = "none";
                editor.style.display = "block";
                await onContentPull(editAreaEl);
            } else {
                // forElement.style.display="block";
                forElement.style.display = forElement.getAttribute("editing-original-display");
                editor.style.display = "none";
            }
            if (onEditButtonClick) onEditButtonClick(editing, editAreaEl, forElement);
        });

        editorButtons.append(editButton);



        if (label && label != "") {
            const labelEl = document.createElement("label");
            labelEl.innerHTML = label;
            editor.append(labelEl);
            editAreaEl.label = labelEl;
        }

        editor.append(editAreaEl);

        if (onEdit) {

            editAreaEl.addEventListener("input", (e) => onEdit(e, editAreaEl));
        }


        if (onToggle) {
            const toggleBtn = document.createElement("span");
            toggleBtn.classList.add("toggleBtn");
            editorButtons.append(toggleBtn);

            const toggleBtnText = document.createElement("span");
            toggleBtnText.innerText = "Enabled ";
            toggleBtn.append(toggleBtnText);

            const toggleBtnIcon = document.createElement("i");
            toggleBtnIcon.className = "fas fa-check-square";
            toggleBtn.append(toggleBtnIcon);




            const toggle = (toggled, transparent) => {
                if (toggled) {
                    toggleBtnIcon.classList = "far fa-square";
                    editor.classList.add("disabled");
                    forElement.classList.add("disabled");
                    if (!transparent) onToggle(false, editAreaEl);
                    toggled = false;

                } else {
                    toggleBtnIcon.classList = "fas fa-check-square";
                    editor.classList.remove("disabled");
                    forElement.classList.remove("disabled");

                    if (!transparent) onToggle(true, editAreaEl);
                    toggled = true;

                }
                return toggled;
            };
            toggle(!toggled, true);
            toggleBtn.addEventListener("click", ev => {
                toggled = toggle(toggled);
            });

        }
        if (onPaidToggle) {
            const toggleBtn = document.createElement("span");
            toggleBtn.classList.add("toggleBtn");
            toggleBtn.classList.add("paidBtn");
            editorButtons.append(toggleBtn);

            const toggleBtnText = document.createElement("span");
            toggleBtnText.innerText = "Paid ";
            toggleBtn.append(toggleBtnText);

            const toggleBtnIcon = document.createElement("i");
            toggleBtnIcon.className = "fas fa-check-square";
            toggleBtn.append(toggleBtnIcon);




            const toggle = (toggled, transparent) => {
                if (toggled) {
                    toggleBtnIcon.classList = "far fa-square";
                    if (!transparent) onPaidToggle(false, editAreaEl);
                    toggled = false;

                } else {
                    toggleBtnIcon.classList = "fas fa-check-square";
                    if (!transparent) onPaidToggle(true, editAreaEl);
                    toggled = true;

                }
                return toggled;
            };
            toggle(!paid, true);
            toggleBtn.addEventListener("click", ev => {
                paid = toggle(paid);
            });

        }

        return editAreaEl;

    }
    static createVList(classes) {
        const list = document.createElement("div");
        this.addClasses(list, ["list", "vlist"]);
        this.addClasses(list, classes);
        return list;
    }

    static createTitle(content, classes) {
        const e = document.createElement("h1");
        this.addClasses(e, classes);
        e.innerHTML = content;
        return e;
    }

    static createSubTitle(content, classes) {
        const e = document.createElement("h2");
        this.addClasses(e, classes);
        e.innerHTML = content;
        return e;
    }

    static createSubSubTitle(content, classes) {
        const e = document.createElement("h3");
        this.addClasses(e, classes);
        e.innerHTML = content;
        return e;
    }

    static createHList(classes) {
        const list = document.createElement("div");
        this.addClasses(list, ["list", "hlist"]);
        this.addClasses(list, classes);
        return list;
    }

    static setClickAction(element, onClick) {
        if (typeof onClick == "string") {
            console.log("Set click to address", onClick, "on", element);
            element.addEventListener("click", (ev) => {
                document.location.assign(onClick);
                ev.stopPropagation();
            });
            if (!element.getAttribute("title")) element.setAttribute("title", onClick);
        } else {
            console.log("Set click action", onClick, "on", element);
            element.addEventListener("click", (ev) => {
                onClick(ev);
                ev.stopPropagation();
            });
        }

        element.classList.add("clickable");
    }

    static showDialog(title, content, buttons) {
        if (document.querySelector("body").querySelector("window#confirmationWindow")) {
            Utils.enqueue(async () => {
                this.showDialog(title, content, buttons);
            });
            return;
        }
        document.querySelector("body").classList.add("lockedByDialog");
        const window = this.toEl(`   
            <window id="confirmationWindow">
                <h1>${title}</h1>
                <div class="content"></div>
                <div class="buttons"></div>
            </window>
        `);
        window.querySelector(".content").appendChild(this.toEl(content));

        const close = () => {
            document.querySelector("body").classList.remove("lockedByDialog");
            document.querySelector("body").removeChild(window);
        }
        const buttonsEl = window.querySelector(".buttons");

        buttons.forEach(btn => {
            const btnEl = this.toEl(`<button>${btn.text}</button>`);
            btnEl.addEventListener("click", () => {
                if (btn.action) btn.action();
                close();

            });
            buttonsEl.appendChild(btnEl);


        })

        // if(cancelAction){
        // const btn=this.toEl(`<button>${continueAction?`<i class="fas fa-times"></i> Cancel`:`OK`}</button>`);
        // btn.addEventListener("click",close);
        // if(cancelAction)btn.addEventListener("click",cancelAction);            
        // buttons.appendChild(btn);

        // }
        // if(continueAction){
        //     const btn=this.toEl(`<button>Continue <i class="fas fa-caret-right"></i></button>`);
        //     btn.addEventListener("click",close);
        //     btn.addEventListener("click",continueAction);
        //     buttons.appendChild(btn);

        // }
        document.querySelector("body").appendChild(window);
        return window;


    }

    static createUserProfile(user, classes) {
        const html = `<figure class="githubUser ">
        <img src="${user.avatar}">
        <figcaption>
        <h2 alt="${user.userName}" style="display: inline-block;">${user.displayName}</h2>
        <span class="ghbio">${user.title}</span>
        <div>
        <a alt="hub profile" title="Hub Profile" href="https://hub.jmonkeyengine.org/u/${user.userName}" style="display: inline-block;"><i class="fab fa-discourse"></i></a>
        </div>
        </figcaption>
        </figure>`;
        const el = this.toEl(html);
        this.addClasses(el, classes);
        return el;
    }
    static createImage(url, classes) {
        const img = document.createElement("img");
        img.setAttribute("src", url);
        this.addClasses(img, classes);
        return img;
    }

    static createArticle(id, icon, title, classes) {
        const sc = document.createElement("article");
        sc.innerHTML = `
            <h1>
                ${icon ? `<i class="fas ${icon} useless"></i>` : ""} ${title || "<spam style='visibility:hidden'>-</span>"}
            </h1>
        `;

        sc.innerHTML += `
        <div class="content">
        </div>
        `;
        this.addClasses(sc, classes);
        sc.setAttribute("id", id);
        const content = sc.querySelector(".content");
        // content.parentArticle=sc;
        sc.content = content;
        return sc;
    }
    static createMenu() {
        const menu = document.createElement("nav");
        // const sc = document.createElement("article");
        // sc.innerHTML = `<h1><i class="fas ${icon} useless"></i> ${title}</h1>
        // <div class="content">
        //   <nav></nav>
        // </div>
        // `;
        // sc.menu = sc.querySelector("nav");
        menu.addSection = (title) => {
            const sec = document.createElement("ul");
            if (title) sec.innerHTML = `<h3>${title}</h3>`;
            menu.append(sec);
            sec.addItem = (content) => {
                const li = document.createElement("li");
                if (typeof content == "string") {
                    li.innerHTML = content;
                } else {
                    li.append(content);
                }
                sec.append(li);
                return li;
            };
            return sec;
        }
        return menu;
    }

    static createShowCase(title, isGallery) {
        const showcaseEl = document.createElement("section");
        showcaseEl.setAttribute("id", "showcase");
        showcaseEl.className = "responsiveWidth";
        if (isGallery) {
            showcaseEl.classList.add("gallery");
            showcaseEl.setAttribute("mode", "gallery");
        }


        const mediaList = document.createElement("span");

        //     mediaList.innerHTML = `

        // <div class="showcaseElement" style='display: none  '>
        //     <div class="cover blur" lazy="true"
        //         lazy-style="background-image: url('/images/showcase/skullstone/1.jpg'); "></div>
        //     <div class="cover" lazy="true"
        //         lazy-style="background-image: url('/images/showcase/skullstone/1.jpg'); "></div>

        // </div>`;

        showcaseEl.append(mediaList);
        showcaseEl.mediaListElement = mediaList;
        if (title || title == "") {
            const titleEl = document.createElement("h1");
            titleEl.innerText = title;
            const titleCnt = document.createElement("span");
            titleCnt.setAttribute("id", "showCaseTitle");
            titleCnt.append(titleEl);
            showcaseEl.append(titleCnt);
            showcaseEl.titleElement = titleEl;
        }
        // let showCaseControlNextEl;
        // let showCaseControlPrevEl;

        // if (controls) {
        // showCaseControlNextEl = document.createElement("i");
        // showCaseControlPrevEl = document.createElement("i");
        // showCaseControlNextEl.setAttribute("id", "showCaseNext");
        // showCaseControlPrevEl.setAttribute("id", "showCasePrev");

        // showcaseEl.append(showCaseControlPrevEl);
        // showcaseEl.append(showCaseControlNextEl);

        // }

        const showcase = new ShowCase(showcaseEl);
        let firstItem = true;
        showcaseEl.addItem = (dataUrl, coverUrl) => {
            if (!dataUrl) return undefined;
            let showcaseElement;
            if (this.isImage(dataUrl)) {
                showcaseElement = document.createElement("div");
                showcaseElement.className = "showcaseElement cover";
                if (!dataUrl.startsWith("data:")) dataUrl = `'${dataUrl}'`;


                showcaseElement.innerHTML += `                    
                    <div class="cover " style="background-image: url(${dataUrl}); "></div>
                `;
                if (coverUrl) {
                    if (!coverUrl.startsWith("data:")) coverUrl = `'${coverUrl}'`;
                    showcaseElement.innerHTML += `<div class="cover blur"   style="background-image: url(${coverUrl}); "> </div>`;
                }
                showcaseElement.style.display = "none";
                mediaList.append(showcaseElement);

            } else {
                let type = this.getVideoType(dataUrl);


                showcaseElement = document.createElement("div");
                showcaseElement.className = "showcaseElement cover";
                showcaseElement.style.display = "none";

                const showcaseElementVideo = document.createElement("video");
                showcaseElementVideo.setAttribute("preload", "metadata");
                showcaseElementVideo.setAttribute("enablerequestfullscreen", "true");
                showcaseElementVideo.setAttribute("controls", "true");
                showcaseElementVideo.className = "cover";

                showcaseElementVideo.innerHTML = `
                  <source src="${dataUrl}" type="${type}">
               `;
               showcaseElement.appendChild(showcaseElementVideo);
                if (coverUrl) {
                    if (!coverUrl.startsWith("data:")) coverUrl = `'${coverUrl}'`;
                    showcaseElement.innerHTML += `<div class="cover blur" style="background-image: url(${coverUrl}); "></div>`;
                }
                mediaList.append(showcaseElement);
            }
            if (firstItem) {
                showcase.cycleShowCase(-1);
                firstItem = false;
            }
            return showcaseElement;
        };
        showcaseEl.showcase = showcase;
        return showcaseEl;
    }

    static reload() {
        location.reload();

    }

    static createButton(icon, title, desc, onClick, classes) {
        const buttonEl = document.createElement("button");
        // parent.append(buttonEl);
        buttonEl.innerHTML = `<i class="${icon}"></i> ${title}`;
        buttonEl.setAttribute("title", desc);
        if(onClick)this.setClickAction(buttonEl, onClick);
        if (classes) this.addClasses(buttonEl, classes);
        return buttonEl;
    }
    static isVideo(dataUrl) {
        return dataUrl && (dataUrl.startsWith("data:video/") ||
            dataUrl.endsWith(".webm") ||
            dataUrl.endsWith(".mp4"));
    }
    static getVideoType(dataUrl) {
        if (!dataUrl.startsWith("data:")) {
            return "video/" + dataUrl.substring(dataUrl.lastIndexOf(".")+1)
        } else {
            return dataUrl.substring(0, dataUrl.indexOf(";")).substring("data:".length);
        }
    }
    static isImage(dataUrl) {
        return dataUrl && (dataUrl.startsWith("data:image/") ||
            dataUrl.endsWith(".jpg") ||
            dataUrl.endsWith(".jpeg") ||
            dataUrl.endsWith(".webp") ||
            dataUrl.endsWith(".png") ||
            dataUrl.endsWith(".gif"));
    }
    static createUploader(forElement, title, description, numMedia, onChange, onContentPull, attachButtonTo, onEditButtonClick) {

        const setData = (previewEl, dataUrl) => {
            previewEl.querySelectorAll("*").forEach(el3 => el3.style.display = "none");
            previewEl.querySelectorAll("video").forEach(el3 => el3.pause());
            if (!dataUrl) return;
            if (this.isImage(dataUrl)) {
                const preview = previewEl.querySelector("img");
                preview.src = dataUrl;
                preview.style.display = "block";
                console.log("Set preview image on", preview);
            } else if (this.isVideo(dataUrl)) {
                const source = document.createElement("source");
                source.type = this.getVideoType(dataUrl);
                source.src = dataUrl;
                const preview = previewEl.querySelector("video");
                preview.querySelectorAll("source").forEach(el3 => el3.remove());
                preview.append(source);
                preview.style.display = "block";
                preview.load();
                console.log("Set preview video on", preview);
            }
        }

        const editor = document.createElement("editor");
        forElement.parentElement.append(editor);

        const uploaderEl = document.createElement("span");
        editor.append(uploaderEl);

        uploaderEl.className = "uploader";

        const titleEl = document.createElement("h2");
        titleEl.innerText = title;
        uploaderEl.append(titleEl);

        uploaderEl.innerHTML += `<br/><br/>    ${description}  <br /> <br /> `;


        const mediaListEl = document.createElement("mediaList");
        uploaderEl.append(mediaListEl);

        const editButton = this.createEditButton(async (editing) => {
            if (editing) {
                mediaListEl.querySelectorAll("input").forEach(fileSelector => {
                    fileSelector.value = "";

                });
                forElement.setAttribute("editing-original-display", forElement.style.display);

                forElement.style.display = "none";
                editor.style.display = "block";
                for (let i = 0; i < numMedia; i++) {
                    const preview = mediaListEl.querySelector("#preview" + i);
                    preview.setData = (content) => {
                        setData(preview, content);
                    }
                    await onContentPull(i, preview);

                }
            } else {

                // forElement.style.display="block";
                forElement.style.display = forElement.getAttribute("editing-original-display");
                editor.style.display = "none";
            }
            if (onEditButtonClick) onEditButtonClick(editing, uploaderEl, forElement);
        });


        const editButtons = document.createElement("div");
        editButtons.className = "editorButtons";
        (attachButtonTo ? attachButtonTo : forElement.parentElement).append(editButtons);
        editButtons.append(editButton);


        for (let i = 0; i < numMedia; i++) {
            const mediaEl = document.createElement("media");
            mediaListEl.append(mediaEl);

            const h3El = document.createElement("h3");
            h3El.innerText = "Media " + (i + 1);
            mediaEl.append(h3El);

            const previewEl = document.createElement("preview");
            mediaEl.append(previewEl);
            previewEl.setAttribute("id", "preview" + i)

            const videoEl = document.createElement("video");
            videoEl.setAttribute("controls", true);

            const imageEl = document.createElement("img");


            previewEl.append(videoEl);
            previewEl.append(imageEl);

            mediaEl.innerHTML += `
            <span >
                <input type="file" name="file1" accept="image/png, image/jpeg,  image/webp, video/webm,video/mp4">
                <button class="deleteBtn">Delete</button>
            </span>`;

            mediaEl.querySelector(".deleteBtn").addEventListener('click', () => {
                fileSelector.value = "";
                const preview = mediaListEl.querySelector("#preview" + i);

                setData(preview, undefined);
                onChange(i, undefined);
            })


            const fileSelector = mediaEl.querySelector("input");
            fileSelector.value = "";
            fileSelector.addEventListener('change', async ev => {
                //   let filename=ev.target.value.split("/");
                //   filename=filename[filename.length-1];
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(ev.target.files[0]);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });

                //   console.log(filename);
                const preview = mediaListEl.querySelector("#preview" + i);

                setData(preview, data);
                //   mediaEl.querySelectorAll("preview > *").forEach(el3=>el3.style.display="none");
                //   mediaEl.querySelectorAll("video").forEach(el3=>el3.pause());
                //     if(filename.endsWith(".jpg")||filename.endsWith(".webp")||filename.endsWith(".png")){

                //       const preview=mediaEl.querySelector("img");
                //       preview.src= URL.createObjectURL(ev.target.files[0]);
                //       preview.style.display="block";
                //       console.log("Set preview image on",preview );
                //     }else if(filename.endsWith(".webm")||filename.endsWith(".mp4")){
                //       const source=document.createElement("source");
                //       source.type="video/"+filename.substring(filename.lastIndexOf(".")+1);
                //       source.src= URL.createObjectURL(ev.target.files[0]);
                //       console.log(filename,source);
                //       const preview=mediaEl.querySelector("video");
                //       preview.querySelectorAll("source").forEach(el3=>el3.remove());
                //       preview.append(source);
                //       preview.style.display="block";
                //       preview.load();
                //       console.log("Set preview video on",preview );

                //     }else{
                //         alert("Unsupported format!");
                //       return;
                //     }
                onChange(i, data);//ev.target.files[0]);

            });


        }
        return editor;
    }
}