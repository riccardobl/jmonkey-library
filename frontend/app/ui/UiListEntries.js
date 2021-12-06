
import Ui from "./ui.js";
import Entries from "../Entries.js";
import Media from "../Media.js";
import Auth from "../Auth.js";
import Utils from "/common/Utils.js";
import Tasks from "./Tasks.js";
import Config from "../Config.js";
import UrlParams from "../UrlParams.js";
export default class UiListEntries {

    static async reset(entriesEl, entryId) {
        Utils.enqueue(async () => {
            const article = Ui.createArticle("entry" + entryId, undefined, "");
            const oldArticle = document.querySelector("#entry" + entryId);
            if (oldArticle) {
                entriesEl.replaceChild(article, oldArticle);
            } else {
                entriesEl.appendChild(article);
            }
        });
    }
    static async init(parentEl, pageId) {
        if (parentEl.getAttribute("id") == "indexPage") return;
        await parentEl.clear();
        parentEl.setAttribute("id", "indexPage");




        this.config = await Config.get();


        this.showcase = Ui.createShowCase("", false);
        parentEl.appendChild(this.showcase);

        this.searchBarEl = parentEl.querySelector(".searchbar");
        this.searchBarEl = Ui.createSection(parentEl, ["searchbar"]);

        this.searchBarInput = Ui.createInputField((await Entries.getListApi()).getDefByType("request").query, "search");
        this.searchBarEl.append(this.searchBarInput);

        const icon = document.createElement("i");
        icon.className = "fas fa-search";
        this.searchBarEl.append(icon);

        this.searchBarInput.setAttribute("placeholder", "Type what you are looking for...")
        this.searchBarInput.addEventListener("input", () => {
            if (this.searchEvent) clearTimeout(this.searchEvent);
            icon.className = "fas fa-spinner fa-pulse";
            this.searchEvent = setTimeout(() => {
                UrlParams.replace({ s: this.searchBarInput.value });
                // window.location.hash = "!s=" + encodeURIComponent(this.searchBarInput.value);
                icon.className = "fas fa-search";
            }, 1000);
        });


        this.entriesEl = Ui.createSection(parentEl, ["entrylist", "list", "hlist", "responsive", "responsiveWidth"]);
        for (let i = 0; i < this.config.entriesPerPage; i++) {
            this.reset(this.entriesEl, i);

        }

        this.pageControlEl = Ui.createSection(parentEl, []);
        this.pageControlEl.appendChild(this.previousPageBtn = Ui.createButton("", `<i class="fas fa-caret-left"></i>`, "Previous Page", () => {
            pageId--;
            if (pageId < 0) pageId = 0;
            UrlParams.set({ "page": pageId });

        }));
        this.pageControlEl.appendChild(this.pageN = Ui.createText(`  Page ${pageId}  `)).setAttribute("id", "pageN");
        this.pageControlEl.appendChild(this.nextPageBtn = Ui.createButton("", `<i class="fas fa-caret-right"></i>`, "Next Page", () => {
            pageId++;
            UrlParams.set({ "page": pageId });
        }));



    }

    static cycle() {
        const showcase = document.querySelector("#showcase");
        if (showcase) {
            showcase.showcase.cycleShowCase(1);
            setTimeout(this.cycle, 10000);
        }
    };
    static async load(parentEl, searchQuery) {

        const pageId = parseInt(UrlParams.get("page")) || 0;

        Tasks.completable("loading", "Searching ... ");//,{},true,false,undefined,false);
        await this.init(parentEl, pageId);


        const oldShowcase = this.showcase;
        this.showcase = Ui.createShowCase("", false);

        parentEl.replaceChild(this.showcase, oldShowcase);

        if (searchQuery) this.searchBarInput.value = searchQuery;

        const entries = await Entries.listIdsPage(searchQuery ? searchQuery : ";order=asc ;sortby=updateDate", pageId, false, this.config.entriesPerPage);
        for (let i in entries) {
            const entryId = entries[i].entryId;
            const userId = entries[i].userId;
            Utils.enqueue(async () => {
                const entry = await Entries.get(userId, entryId);

                const r = await Media.get(userId, entryId, 0);
                const media = r.data;
                const preview = r.preview;
                const blurred = r.blurred;

                let title = entry.name;
                const maxTitleLength =  this.config.entryList.maxTitleLength;
                if (title && title.length > maxTitleLength) title = title.substring(0, maxTitleLength) + "...";


                const oldArticle = this.entriesEl.querySelector("#entry" + i);
                const newArticle = Ui.createArticle("entry" + i, undefined, title);
                this.entriesEl.replaceChild(newArticle, oldArticle);
                newArticle.content.classList.add("textShadowedIntense");
                newArticle.content.innerHTML = Utils.getSummary(entry.descriptionSummary,this.config.entryList.maxSummaryLength);
                Ui.appendCover(newArticle.content, preview);
                Ui.setClickAction(newArticle, ()=>{
                    UrlParams.replace({
                        entry: entry.userId + "/" + entry.entryId
                    });
                });

                const detailsEl = Ui.createMenu();
                newArticle.content.append(detailsEl);


                const authorSectionEl = detailsEl.addSection();
                const authorUser = await Auth.getUser(entry.userId);
                const authorEl = Ui.createUserElement(authorUser);
                authorSectionEl.addItem(authorEl);

                const tagsSectionEl = detailsEl.addSection();
                entry.tags.forEach(tag => {
                    const tagEl = Ui.createTagElement(tag);
                    tagsSectionEl.addItem(tagEl);
                });

                Utils.enqueue(async () => {
                    const item = this.showcase.addItem(media, blurred);
                    if (item) Ui.setClickAction(item, ()=>{
                        UrlParams.replace({
                            entry: entry.userId + "/" + entry.entryId
                        });
                    }
                        );
                });
           
            });
        }

        for (let i = entries.length; i < this.config.entriesPerPage; i++) {
            this.reset(this.entriesEl, i);
        }

        this.pageN.innerHTML = `  Page ${pageId}  `;
        if (pageId == 0) {
            if (!this.previousPageBtn.classList.contains('diabled')) this.previousPageBtn.classList.add("disabled");
        } else {
            this.previousPageBtn.classList.remove("disabled");
        }

        if (entries.length == 0) {
            if (!this.nextPageBtn.classList.contains('diabled')) this.nextPageBtn.classList.add("disabled");

        } else {
            this.nextPageBtn.classList.remove("disabled");

        }

        if (this.showcaseCycleTimeout) {
            clearTimeout(this.showcaseCycleTimeout);
            this.showcaseCycleTimeout = null;
        }
        if (entries.length > 1) {

            this.showcaseCycleTimeout = setTimeout(this.cycle, 10000);
        }


        // if (this.showcaseCycleInterval) clearInterval(this.showcaseCycleInterval);


        // this.showcaseCycleInterval = setTimeout(cycle, 5000);
        Utils.enqueue(async () => {
            Tasks.ok("loading");
        });
        // await parentEl.show();

    }
}