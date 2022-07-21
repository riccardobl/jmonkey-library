
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


        this.showcase = Ui.createShowCase("", false,["cycle"]);
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

        this.sortByEl = Ui.createSection(parentEl, ["responsiveWidth", "right","hlist", "list", "settings"]);
        this.sortByEl.append(Ui.toEl(`
        <div>
        <b style="padding:0.9rem" >Sort by:</b> 
            <a style="padding:0.5rem" class="clickable" id="sortBylikes"><i class="fa-regular fa-square"></i> Likes</a> 
            <a style="padding:0.5rem" class="clickable"  id="sortByupdateDate"><i class="fa-regular fa-square-caret-down"></i> Date</a>
            </div>
        `));

        const resort=(by)=>{
            let search=this.searchBarInput.value;
            search=search.split(";");
            let asc=by=="updateDate";
            for(let i=0;i<search.length;i++){
                let part=search[i].trim();
                if(part.startsWith("sortby=")){
                    search[i]="";
                }else if(part.startsWith("order=")){
                    search[i]="";
                    asc=part.split("=")[1]=="asc";
                }
            }
           asc=!asc;
                search.push("order="+(asc?"asc":"desc"));
            
            search.push("sortby="+by);

            let emptySearch=!(search[0].trim());

            search=search.map(s=>s.trim()).filter(s=>s);
         
       
            if(emptySearch){
                search.unshift(" ");
            }

            search=search.join(" ;");
            this.searchBarInput.value=search;          
            UrlParams.replace({ s:  search });

            this.sortByEl.querySelectorAll("i").forEach(i=>{
                i.className="fa-regular fa-square";
            });
            
            this.sortByEl.querySelector("#sortBy"+by).querySelector("i").className="fa-regular fa-square-"+(asc?"caret-down":"caret-up");
            
        };

        this.sortByEl.querySelector("#sortBylikes").addEventListener("click", () => {
            resort("likes");
        });

       this.sortByEl.querySelector("#sortByupdateDate").addEventListener("click", () => {
            resort("updateDate");
        });


        this.userInfoEl = Ui.createSection(parentEl, ["responsiveWidth", "hlist", "list", "settings", "center"]);

        this.entriesEl = Ui.createSection(parentEl, ["entrylist", "list", "hlist", "responsive", "responsiveWidth"]);
        for (let i = 0; i < this.config.entriesPerPage; i++) {
            this.reset(this.entriesEl, i);

        }

        this.pageControlEl = Ui.createSection(parentEl, []);
        this.pageControlEl.appendChild(this.previousPageBtn = Ui.createButton("", `<i class="fas fa-caret-left"></i>`, "Previous Page", () => {
            pageId--;
            if (pageId < 0) pageId = 0;
            UrlParams.set({ "page": pageId });
            // window.scrollToElement(document.querySelector("#entry0"));


        }));
        this.pageControlEl.appendChild(this.pageN = Ui.createText(`  Page ${pageId}  `)).setAttribute("id", "pageN");
        this.pageControlEl.appendChild(this.nextPageBtn = Ui.createButton("", `<i class="fas fa-caret-right"></i>`, "Next Page", () => {
            pageId++;
            UrlParams.set({ "page": pageId });
            // window.scrollToElement(document.querySelector("#entry0"));
        }));



    }

    static cycle() {
        const showcase = document.querySelector("#showcase");
        if (showcase && showcase.classList.contains("cycle")) {
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


        
        this.userInfoEl.innerHTML="";
        const uidRegEx=/@([0-9A-Z]+)/ig;
        const parseUid=async ()=>{
            let userId=uidRegEx.exec(searchQuery);
            if(!userId||!userId[1])return;
            const userEl = Ui.createUserProfile(await Auth.getUser(userId[1]));
            this.userInfoEl.append(userEl);
            setTimeout(parseUid,100);
        };
        parseUid();


   


        const entries = await Entries.listIdsPage(searchQuery ? searchQuery : ";order=asc ;sortby=updateDate", pageId, false, this.config.entriesPerPage);


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


        const entiresLoadPromises = [];

        for (let i in entries) {
            entiresLoadPromises.push(
                (async ()=>{
                    const entryId = entries[i].entryId;
                    const userId = entries[i].userId;
        
                    const entryP =  Entries.get(userId, entryId);
                    const mediaP =  Media.get(userId, entryId, 0);
                    const authorUserP = Auth.getUser(userId);
        
                    const [entry, r, authorUser] = await Promise.all([entryP, mediaP, authorUserP]);
        
                    const media = r.data;
                    const preview = r.preview;
                    const blurred = r.blurred;
        
                    let title = entry.name;
                    const maxTitleLength = this.config.entryList.maxTitleLength;
                    if (title && title.length > maxTitleLength) title = title.substring(0, maxTitleLength) + "...";
        
        
                    const oldArticle = this.entriesEl.querySelector("#entry" + i);
                    const newArticle = Ui.createArticle("entry" + i, undefined, title);
                    this.entriesEl.replaceChild(newArticle, oldArticle);
                    newArticle.content.classList.add("textShadowedIntense");
                    newArticle.content.innerHTML = Utils.getSummary(entry.descriptionSummary, this.config.entryList.maxSummaryLength);
                    Ui.appendCover(newArticle.content, preview);
                    Ui.setClickAction(newArticle, () => {
                        UrlParams.replace({
                            entry: entry.userId + "/" + entry.entryId
                        });
                    });
        
                    const likesEl = Ui.toEl("<div class='likes'></div>");
                    newArticle.content.append(likesEl);
        
                    Entries.getLikes(entry.userId, entry.entryId).then(res => {
                        likesEl.innerHTML = `<i class="fa-solid fa-heart"></i> ${res.likes}`
                    });
        
                    const detailsEl = Ui.createMenu();
                    newArticle.content.append(detailsEl);
        
        
                    const authorSectionEl = detailsEl.addSection();
                    const authorEl = Ui.createUserElement(authorUser);
                    authorSectionEl.addItem(authorEl);
        
                    const tagsSectionEl = detailsEl.addSection();
                    entry.tags.forEach(tag => {
                        const tagEl = Ui.createTagElement(tag);
                        tagsSectionEl.addItem(tagEl);
                    });
        
                    Utils.enqueue(async () => {
                        const item = this.showcase.addItem(media, blurred);
                        if (item) Ui.setClickAction(item, () => {
                            UrlParams.replace({
                                entry: entry.userId + "/" + entry.entryId
                            });
                        }
                        );
                    });
                })()
            )  
        }
        await Promise.all(entiresLoadPromises);

        for (let i = entries.length; i < this.config.entriesPerPage; i++) {
            this.reset(this.entriesEl, i);
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