import Ui from './ui.js';
import Entries from "../Entries.js";
import Auth from "../Auth.js";
import Media from "../Media.js";
import Utils from "/common/Utils.js";
import Config from "../Config.js";
import Payment from "../Payment.js";
import ExtImporter from "../ExtImporter.js";
import Tasks from './Tasks.js';
import DeepLink from '../thirdparty/DeepLink.js';
import VanillaQR from "../thirdparty/VanillaQR.js";
import UrlParams from '../UrlParams.js';

export default class UiEntry {


    static async load(parentEl, userId, entryId) {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth'
        });
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
                10 // 10 media per page
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
        entry=await (await Entries.getApi()).parse("database",entry,false);
        // Ui.loading(true, "Loading " + entry.entryId + (editMode ? " in edit mode..." : "..."), 10000);
        // Ui.waitTask("loading","Loading "+ entry.entryId + (editMode ? " in edit mode..." : "..."),{},false,false,10000);
        
        Tasks.completable("loading", "Loading entry " + entry.entryId + "...", {}, true, false, undefined, false);


        // set title
        document.title = entry.name + " | jMonkeyEngine | Library"; 


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
                UrlParams.unlockPage();

                Tasks.completable("save", "Saving...", {}, true, false, false, undefined, false);
                // update entry
                console.log("Update entry");
                Tasks.completable("save", "Updating entry...", {}, true, false, false, undefined, false);
                await Entries.set(editedEntry);


                // update media
                // if (editedMedia.changed) {
                console.log("Update media");
                const editedMediaNonNull = editedMedia.media;//.filter(m => m&&m.data); // remove undefined
                for (let i = 0; i < Math.min(editedMediaNonNull.length, 10); i++) {

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

        if(editMode){
            UrlParams.lockPage("There are unsaved changes. Do you wish to save?",(v)=>{
                if(v)saveEntry();
                return true;
            });
        }

        // Importer
        if (editMode) await this.loadImporter(editedEntry, parentEl, reload);
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
                        undefined, undefined, undefined
            
                    );
                    if (!entry.download) downloadBtn.classList.add("disabled");
                }
            }

            if (entry.repo || editMode) {
                const repoBtn = menuDownloadEl.addItem(Ui.createButton("fab fa-git-alt", "Source", entry.repo || "", entry.repo || ""));
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
                        undefined, undefined, undefined
                      
                    );
                    if (!entry.repo) repoBtn.classList.add("disabled");
                }
            }

        }

        if(!editMode&&entry.platforms){
        
            const supportedPlatformsEl = menuEl.addSection("Platforms");

            const platformsListEl = Ui.toEl(`<div style="text-align:center;margin:0;width:100%; display:flex;align-items:center"></div>`);

            supportedPlatformsEl.addItem(platformsListEl);
            let content=``;
                    
            const findPlatform = (partial) => {
                for(const platform of entry.platforms){
                    if(platform.indexOf(partial)!=-1) return platform;
                }
                return undefined;
            }
            if(findPlatform("_WINDOWS"))content+=`<i style="margin:0;padding:0; flex-grow:1" title="Windows" class="platformIcon fa-brands fa-windows"></i>`;
            if(findPlatform("_LINUX"))content+=`<i style="margin:0;padding:0; flex-grow:1" title="Linux" class="platformIcon  fa-brands fa-linux"></i>`;
            if(findPlatform("_MACOS"))content+=`<i style="margin:0;padding:0; flex-grow:1" title="MacOS"  class="platformIcon  fa-brands fa-apple"></i>`;
            if(findPlatform("ANDROID"))content+=`<i style="margin:0;padding:0; flex-grow:1" title="Android"  class="platformIcon  fa-brands fa-android"></i>`;
            if(findPlatform("VR_"))content+=`<i title="VR" style="margin:0;padding:0; flex-grow:1" class="platformIcon  fa-solid fa-vr-cardboard"></i>`;
            
            if(entry["maven-artifacts"]&&entry["initializerCategory"]&&entry["initializerCategory"]!="HIDDEN"){
                supportedPlatformsEl.addItem(Ui.toEl(`
                <a style="width: 100%;white-space: nowrap; padding: 0; margin:0;margin-top: 0.5rem;text-align: center;" target="_blank" href="https://jmonkeyengine.org/start/"><i class="fa-solid fa-rocket"></i> Available in JME Initializer</a>
                `));
            }
            platformsListEl.innerHTML=content;
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
                        undefined, undefined, undefined
             
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
                        undefined, undefined, undefined
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
                        undefined, undefined, undefined
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

        const secondRowEl = Ui.createSection(parentEl, ["responsiveWidth", entry["maven-artifacts"]&&entry["maven-artifacts"].length>0 && entry.license &&!editMode ? "withSide" : ""]);

        // USAGE & LICENSE
        if(!editMode&&entry["maven-artifacts"]&&entry["maven-artifacts"].length>0){
            // if ( ) {
                const usageEl = Ui.createArticle("usage", "fas fa-book-dead", "Gradle Snippet");
                secondRowEl.appendChild(usageEl);
                let content=``;

              

                // content+="<h2>Supported Platforms</h2>";
                
                // const findPlatform = (partial) => {
                //     for(const platform of entry.platforms){
                //         if(platform.indexOf(partial)!=-1) return platform;
                //     }
                //     return undefined;
                // }
                // if(findPlatform("_WINDOWS"))content+=`<i title="Windows" class="platformIcon fa-brands fa-windows"></i>`;
                // if(findPlatform("_LINUX"))content+=`<i title="Linux" class="platformIcon  fa-brands fa-linux"></i>`;
                // if(findPlatform("_MACOS"))content+=`<i title="MacOS"  class="platformIcon  fa-brands fa-apple"></i>`;
                // if(findPlatform("ANDROID"))content+=`<i title="Android"  class="platformIcon  fa-brands fa-android"></i>`;
                // if(findPlatform("VR_"))content+=`<i title="VR"  class="platformIcon  fa-solid fa-vr-cardboard"></i>`;
                
                // if(entry["maven-repos"]&&entry["initializerCategory"]&&entry["initializerCategory"]!="HIDDEN"){
                //     content+=`<br><a target="_blank" href="https://jmonkeyengine.org/start/"><i class="fa-solid fa-rocket"></i> Available in jMonkeyEngine Initializer</a>`; 
                // }

                if(entry["maven-artifacts"]&&entry["maven-artifacts"].length>0){
                    //<h2>Gradle Coordinates</h2>
                    content+=`

                    <pre class="language-gradle">`;
                    

                    let githubPackageRegistry=false;
        
                    let repoContent=``;
                    
                    if(entry["maven-repos"]&&entry["maven-repos"].length>0){
                        repoContent+=`repositories {\n`;
                        for( const repo of entry["maven-repos"]){
                            if(repo.startsWith("https://github.com/")){
                                const [,,,ghowner,ghrepo, ]=repo.split("/");
                                repoContent+=`    maven githubPackage.invoke("${ghowner}`;
                                if(ghrepo) repoContent+=`/${ghrepo}`;
                                repoContent+=`")\n`;
                                githubPackageRegistry=true;
                            }else if(repo.startsWith("http")  ){
                                repoContent+=`    maven { url "${repo}" }\n`;
                            }else{
                                repoContent+=`    ${repo}\n`;
                            }
                        }
                        repoContent+=`}\n\n`;
                    }

                    if(githubPackageRegistry){
                        content+=`\nplugins {\n    id "io.github.0ffz.github-packages" version "1.2.1"\n}\n\n`;
                    }

                    content+=repoContent;

                    content+=`dependencies {\n`;
                    for( let artifact of entry["maven-artifacts"]){
                        artifact=artifact?artifact.replace("$VERSION", entry.version):""
                        content+=`    implementation "${artifact}"\n`;
                    }

                    content+=`}\n</pre>`;
                }
                usageEl.content.innerHTML+=content;

                
               
            // }
        }else{
            if (editMode) {
                const thirdRowEl = Ui.createSection(parentEl, ["responsiveWidth", "list", "responsive", "vlist", "settings"]);
    

             
                const jmeInitializerEl =  Ui.createArticle("maven", "fas fa-rocket", "Deployment",["content","text-left"]);
                thirdRowEl.appendChild(jmeInitializerEl);
                jmeInitializerEl.content.appendChild(Ui.createSubTitle("jMonkeyEngine Initializer"));
                jmeInitializerEl.content.appendChild(Ui.toEl(`<span>
                    You can toggle this option to include your entry in the <a href="https://start.jmonkeyengine.org" target="_blank">jMonkeyEngine Initializer</a>.
                    <br>
                    <i>This option is available only for entries that have maven coordinates. </i>
                    <br><br>
                    </span>
                `,[]));


                if(!Auth.isCurrentUserTrusted()){
                    jmeInitializerEl.content.appendChild(Ui.createText(`Only trusted users can deploy to the initializer.
                        <br>
                    If you are a trusted user and you see this message, please logout and login again.
                    
                    `));
                    editedEntry.initializerCategory=undefined;

                }

                jmeInitializerEl.content.appendChild(Ui.createToggle("Deploy to jme-initializer",(v)=>{
                    if(Auth.isCurrentUserTrusted()){
                        if(v){
                            editedEntry.initializerCategory="GENERAL";
                        }else{
                            editedEntry.initializerCategory=undefined;
                        }
                    }
                },editedEntry.initializerCategory
                &&editedEntry.initializerCategory!="HIDDEN",
                Auth.isCurrentUserTrusted(),true));

             

                jmeInitializerEl.content.appendChild(Ui.createSubTitle("Supported Platforms"));
                jmeInitializerEl.content.appendChild(Ui.toEl(`<span>
                Please select the platforms suppored by this entry
                </span>
            `,[]));
                jmeInitializerEl.content.appendChild(Ui.createSubSubTitle("Mobile"));
                jmeInitializerEl.content.appendChild( Ui.createToggle("Android",(v)=>{
                    editedEntry.platforms=editedEntry.platforms.filter(p=>p!="MOBILE_ANDROID");
                    if(v)editedEntry.platforms.push("MOBILE_ANDROID");                    
                },editedEntry.platforms.indexOf("MOBILE_ANDROID")!=-1,true,true));

                jmeInitializerEl.content.appendChild(Ui.createSubSubTitle("Desktop"));

                jmeInitializerEl.content.appendChild( Ui.createToggle("Linux",(v)=>{
                    editedEntry.platforms=editedEntry.platforms.filter(p=>p!="DESKTOP_LINUX");
                    if(v)editedEntry.platforms.push("DESKTOP_LINUX");
                },editedEntry.platforms.indexOf("DESKTOP_LINUX")!=-1,true,true));

                jmeInitializerEl.content.appendChild( Ui.createToggle("Windows",(v)=>{
                    editedEntry.platforms=editedEntry.platforms.filter(p=>p!="DESKTOP_WINDOWS");
                    if(v)editedEntry.platforms.push("DESKTOP_WINDOWS");
                },editedEntry.platforms.indexOf("DESKTOP_WINDOWS")!=-1,true,true));

                jmeInitializerEl.content.appendChild( Ui.createToggle("MacOS",(v)=>{
                    editedEntry.platforms=editedEntry.platforms.filter(p=>p!="DESKTOP_MACOS");
                    if(v)editedEntry.platforms.push("DESKTOP_MACOS");
                },editedEntry.platforms.indexOf("DESKTOP_MACOS")!=-1,true,true));

                jmeInitializerEl.content.appendChild(Ui.createSubSubTitle("VR"));

                jmeInitializerEl.content.appendChild( Ui.createToggle("VR Linux",(v)=>{
                    editedEntry.platforms=editedEntry.platforms.filter(p=>p!="VR_LINUX");
                    if(v)editedEntry.platforms.push("VR_LINUX");
                },editedEntry.platforms.indexOf("VR_LINUX")!=-1,true,true));

                jmeInitializerEl.content.appendChild( Ui.createToggle("VR Windows",(v)=>{
                    editedEntry.platforms=editedEntry.platforms.filter(p=>p!="VR_WINDOWS");
                    if(v)editedEntry.platforms.push("VR_WINDOWS");
                },editedEntry.platforms.indexOf("VR_WINDOWS")!=-1,true,true));

                jmeInitializerEl.content.appendChild( Ui.createToggle("VR MacOS",(v)=>{
                    editedEntry.platforms=editedEntry.platforms.filter(p=>p!="VR_MACOS");
                    if(v)editedEntry.platforms.push("VR_MACOS");
                },editedEntry.platforms.indexOf("VR_MACOS")!=-1,true,true));
          
            
                jmeInitializerEl.content.appendChild(Ui.createSubTitle("Maven/Gradle Artifacts"));
                jmeInitializerEl.content.appendChild(Ui.createText(`
                    List of maven artifacts needed to use this entry.
                `));
            
                const artifactsTables=Ui.createTable(["Group","Artifact","Version<br>( use $VERSION for last version )",""],["text-left"])
               
    
    
                jmeInitializerEl.content.appendChild(artifactsTables);
    
                const reloadArtifactsTable=()=>{
                    artifactsTables.querySelectorAll("tr.generated").forEach(el=>el.remove());
                    let row;
                    if( editedEntry["maven-artifacts"]){
                        for(let i=0;i<editedEntry["maven-artifacts"].length;i++){
                            const art=editedEntry["maven-artifacts"][i];
                            row=artifactsTables.addRow(["generated"]);
                            const [group,repo,version]=art?art.split(":"):["","",""];
                            row.addCell(Ui.createText(group));
                            row.addCell(Ui.createText(repo));
                            row.addCell(Ui.createText(version));
                            row.addCell(Ui.createButton(undefined,"x","Remove this artifact",()=>{
                                editedEntry["maven-artifacts"].splice(i,1);
                                if(editedEntry["maven-artifacts"].length==0)editedEntry["maven-artifacts"]=undefined;
                                reloadArtifactsTable();
                            }),["smallest"]);
    
                        }
                    }
                    
                    row=artifactsTables.addRow(["generated"]);
                    let newGroupEl,newArtifactEl,newVersionEl;
                    row.addCell(newGroupEl=Ui.createInputField(def["maven-artifacts"],"text"));
                    row.addCell(newArtifactEl=Ui.createInputField(def["maven-artifacts"],"text"));
                    row.addCell(newVersionEl=Ui.createInputField(def["maven-artifacts"],"text"));
                    row.addCell(Ui.createButton(undefined,"+","Add artifacts",()=>{
                        const v=`${newGroupEl.value}:${newArtifactEl.value}:${newVersionEl.value}`;
                        if(!editedEntry["maven-artifacts"])editedEntry["maven-artifacts"]=[];
                        editedEntry["maven-artifacts"].push(v);
                        reloadArtifactsTable();
                    }),["smallest"]);
                };
                reloadArtifactsTable();
    
                jmeInitializerEl.content.appendChild(Ui.createSubTitle("Additional Maven/Gradle Repositories"));
                const repoTable=Ui.createTable(["Maven Repositories",""],["text-left"]);
                jmeInitializerEl.content.appendChild(Ui.createText(`
                Extra repositories needed to use this entry.
            `));
            jmeInitializerEl.content.appendChild(repoTable);
    
                const reloadRepoTable=()=>{
                    repoTable.querySelectorAll("tr.generated").forEach(el=>el.remove());
                    let row;
                    if( editedEntry["maven-repos"]){
                        for(let i=0;i<editedEntry["maven-repos"].length;i++){
                            const repo=editedEntry["maven-repos"][i];
                            row=repoTable.addRow(["generated"]);
                            row.addCell(Ui.createText(repo));
                            row.addCell(Ui.createButton(undefined,"x","Remove this repo",()=>{
                                editedEntry["maven-repos"].splice(i,1);
                                if(editedEntry["maven-repos"].length==0)editedEntry["maven-repos"]=undefined;
                                reloadRepoTable();
                            }),["smallest"]);
                        }
                    }
                    
                    row=repoTable.addRow(["generated"]);
        
                    const repoInput=Ui.createInputField(def["maven-repos"],"text");
                    repoInput.setAttribute("placeholder","mavenCentral()");
                    row.addCell(repoInput);
                    row.addCell(Ui.createButton(undefined,"+","Add repo",()=>{
                        if(!editedEntry["maven-repos"])editedEntry["maven-repos"]=[];
                        editedEntry["maven-repos"].push(repoInput.value);
                        reloadRepoTable();
                    }),["smallest"]);
                };
                reloadRepoTable();
        }

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
                undefined, undefined, undefined
            );
        }

        if(editMode){
            await this.loadMainMenu(parentEl, entry, editedEntry, saveEntry, reload);
        }

        if(!editMode){
        // COMMENTS
        const cnf=(await Config.get());
        let discourseUrl = cnf.discourse? cnf.discourse.discourseUrl:undefined;
        if(!discourseUrl.endsWith("/"))discourseUrl=discourseUrl+"/";
        if (discourseUrl) {
            const thirdRow = Ui.createSection(parentEl, ["responsiveWidth"]);
            const commentsEl = Ui.createArticle("comments",  "fa-comments", "Comments");
            thirdRow.appendChild(commentsEl);
            let libUrl=(await Config.get()).libraryUrl;
            if(libUrl.endsWith("/")) libUrl=libUrl.substring(0,libUrl.length-1);
            const eurl = libUrl+"/discourse/embedEntry?userId="+encodeURIComponent(entry.userId)+"&entryId="+encodeURIComponent(entry.entryId);
            console.info(eurl);
            const discourseUsername = await Auth.getUser(entry.userId);

            
            commentsEl.content.innerHTML = ` <div class="content" id='discourse-comments'></div>`;
            window.DiscourseEmbed = { 
                discourseUrl: discourseUrl,
                discourseEmbedUrl: eurl,
                discourseUserName: discourseUsername.userName
              };

              (function() {
                var d = document.createElement('script'); d.type = 'text/javascript'; d.async = true;
                d.src = DiscourseEmbed.discourseUrl + 'javascripts/embed.js';
                (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(d);
              })();
        }
    }

        setTimeout(() => {
            Prism.highlightAll();
        }, 10);
        // Ui.loading(false);
        Tasks.ok("loading");
        // await parentEl.show();
    }


    static async loadImporter(currentEntry, parentEl, reload) {
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
            const importedEntry=Utils.clone(currentEntry);
            for(let [key,value] of Object.entries(importedData.entry)){
                if(value)importedEntry[key]=value;
            }
            console.info("Imported",importedData);

            await reload(true, importedEntry, importedData.media, true);

        });

    }

    static async loadMainMenu(parentEl, entry, editedEntry, saveEntry, reload) {
        // if (!await Auth.isLoggedIn()) {
        //     const msg = Ui.createMessage("", "LogIn to interract with this entry");
        //     parentEl.appendChild(msg);
        //     return;
        // }
        const callerId = (await Auth.isLoggedIn())?Auth.getCurrentUserID():undefined;
        const isCallerMod = (await Auth.isLoggedIn())?Auth.isCurrentUserMod():false;

        const mainMenuRow = Ui.createSection(parentEl, ["responsiveWidth", "entryMenu"]);




        if (callerId == entry.userId || isCallerMod) {
            if (editedEntry) {
                mainMenuRow.append(Ui.createButton(
                    "fas fa-save", "Save", "Save changes", () => {
                        saveEntry()
                    },["highlightedCl"]));

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
                                text: `<i class="fas fa-dungeon"></i> Suspend`,
                                important:true,
                                action: async () => {
                                    editedEntry.suspended = reasonEl.value || "No reason";
                                    console.log("Suspend with reason", reasonEl.value);

                                    saveEntry();
                                }
                            },
                            {
                                text: "Cancel",
                                action: async () => {

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
                            text: `<i class="fas fa-gavel"></i> Block `,
                            important:true,
                            action: async () => {
                                editedEntry.banned = reasonEl.value || "No reason";
                                console.log("Ban with reason", reasonEl.value);
                                saveEntry();
                            }
                        },
                        {
                            text: "Cancel",
                            action: async () => {

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

        if(editedEntry){
            mainMenuRow.append( Ui.createButton(
                "fab fa-github-alt", "Github Actions Snippet", "", async () => {
                    const key={
                        userId: Auth.getCurrentUserID(),
                        keyId: entry.entryId+"_github_action_"+Utils.uuidv4(),
                        key: Utils.uuidv4(),
                        description: "Github Action Deployment",
                        ips: undefined
                    };
                    await Auth.setKey(key);

                    const snippet=`- name: Publish to jMonkeyEngine Library
  if: github.event_name == 'release'
  uses: jMonkeyEngine/jme-library-publish-action@1.1
  with:
    userId: ${editedEntry.userId}
    entryId: ${editedEntry.entryId}
    authId: ${key.keyId}
    platforms: "DESKTOP_WINDOWS,DESKTOP_LINUX,DESKTOP_MACOS" # ...?
    importMedia: true
    authKey: \${{ secrets.JME_LIBRARY_AUTH_KEY }}
    token: \${{ secrets.GITHUB_TOKEN }}
    funding: true                     
                    `;

                    Ui.showDialog("Github Action Snippet", Ui.toEl(`
                        <div  style="text-align:left!important">
                            
                            Add this secret to your repository
                            <pre><code lang="yaml">JME_LIBRARY_AUTH_KEY = ${key.key}</code></pre>
                            <br >
                            <br >
                            Add this snippet to your workflow
                            <pre ><code lang="yaml">${snippet}</code></pre>
                        </div>
                    
                    `), [
                        
                        {
                            text: `<i class="fa-solid fa-check"></i> Ok `,
                            important:true,
                            action: async () => {
                               
                            }
                        }
                       
                    ])

            }));
        }


        if(!editedEntry){
            const reloadLikes = (likeButton) => {
                Entries.getLikes(entry.userId, entry.entryId).then(res => {
                    if(Auth.getCurrentUserID()&&res.likedBy.indexOf(Auth.getCurrentUserID())!=-1 ){
                        likeButton.classList.add("highlightedCl");
                    }else{
                        likeButton.classList.remove("highlightedCl");
                    }
                    likeButton.innerHTML = `<i class="fa-solid fa-heart"></i> ${res.likes}`
                });
            };

            const likeButton = Ui.createButton(
                "fas fa-spinner fa-spin", "Likes", "", async () => {
                    if(await Auth.isLoggedIn()){
                        likeButton.querySelector("i").setAttribute("class","fas fa-spinner fa-spin");
                        await Entries.toggleLike(entry.userId, entry.entryId)
                        reloadLikes(likeButton);
                    }
            });
            mainMenuRow.append(likeButton);
            reloadLikes(likeButton);
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
            
            `, 10,


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
        const payinfo=await Payment.getInfo(entry.userId);
        let hasPayInfo=payinfo["ln-address"]||payinfo["paypal-id"]||payinfo["patreon-id"]||payinfo["github-id"];
        hasPayInfo=hasPayInfo?true:false
        if(editMode){
            const section = menuEl.addSection("Funding");
            const el=Ui.createDiv(["editorButtons"])
            section.append(el);
            el.append(Ui.createToggle("Enable Funding",(v)=>{
                editedEntry.funding=v;
            },entry.funding&&hasPayInfo,hasPayInfo?true:false));
            return;
        }

        if(!hasPayInfo||!entry.funding)return;
  
        const section = menuEl.addSection("Funding");
        // section.addItem(Ui.createText("Support the developer and this project"));

        if(payinfo["ln-address"]){
            const lightning = section.addItem(Ui.createButton("fas fa-bolt",
                `Donate ₿itcoin`, "Support this developer with a donation in Bitcoin on the Lightning Network", async () => {
               
            // const content = Ui.toEl(`
            //     <span>                                           
            //         <iframe sandbox="allow-forms allow-modals allow-popups allow-scripts allowpaymentrequest" src="https://www.paypal.com/donate/?hosted_button_id=${payinfo["paypal-id"]}" ></iframe>
            //     </span>
            // `);
            const invoiceReqDef=await (await Payment.getLnInvoiceApi()).getDefByType("request");
            
            const lnEl=Ui.createVList();

           let row;
            let column;
            
            column=Ui.createVList();
            lnEl.append(column);

            row=Ui.createHList();
            column.append(row);

            row.append(Ui.createText("Sats:"));
            const inputSats=Ui.createInputField(invoiceReqDef,"text");
            inputSats.value=3000;
            row.append(inputSats);


            row=Ui.createHList(["justify-left"]);
            column.append(row);
            row.append(Ui.createText("Value in USD:"));
            row.appendChild(row=Ui.createHList(["justify-right"]));

            const usdEl=Ui.createText("0");
            row.append(usdEl);

            row=Ui.createHList(["justify-left"]);
            column.append(row);
            row.append(Ui.createText("Value in Bitcoin:"));

            row.appendChild(row=Ui.createHList(["justify-right"]));

            const btcEl=Ui.createText("0");
            row.append(btcEl);
            
            const updateValues=()=>{
                const sats=parseFloat(inputSats.value);
                const btc=sats*0.00000001;
                const usd=btc*20000;
                let v=`${Math.floor(usd*10.)/10.} $`;
                console.log(v);
                usdEl.innerText=v;

                v=`${Math.floor(btc*100000.)/100000.} ₿`;
                btcEl.innerText=v;
            };

            inputSats.addEventListener("input",updateValues);
            updateValues();
            // row=Ui.createVList();
            // lnEl.append(row);
            // row.append(Ui.createText("USD:"));

            // const inputUSD=Ui.createInputField(invoiceReqDef,"text");
            // row.append(inputUSD);

         
         

            Ui.showDialog(`Donate Bitcoin`, lnEl,
                [
                   
                    {
                        text: `<i class="fas fa-bolt"></i> Generate Invoice`,
                        important:true,
                        action: async ()=>{
                            
                            const invoice=await Payment.getLnInvoice(payinfo["ln-address"],parseInt(inputSats.value));
                            
                         
                            const invoiceEL =Ui.createVList();
                            invoiceEL.append(Ui.createText("Pay this lightning invoice"));
                            const qr = new VanillaQR({
                                url: "lightning:" + invoice,
                                size: 512,
                                colorLight: "#ffffff",
                                colorDark: "#000000",
                                toTable: false,
                                ecclevel: 1,
                                noBorder: true
                            });

                            const qrCodeEl =Ui.createDiv();
                            qrCodeEl.setAttribute("id","qrcontainer");
             
                            
                            const qrImgEl=qr.toImage("jpg");

                            invoiceEL.append(qrCodeEl);
                            qrCodeEl.appendChild(qrImgEl);


                            const invoiceData =Ui.createInputField(undefined,"text");
                            invoiceData.setAttribute("readonly",true);
                            invoiceData.value=invoice;
                            invoiceEL.append(invoiceData);
                            invoiceEL.addEventListener("click",()=>{
                                invoiceData.focus();
                                invoiceData.select();
                                document.execCommand('copy');
                                Tasks.ok("copiedLNInvoice","Copied.");
                            });

                            setTimeout(()=>{
                                Ui.showDialog(`<i class="fa-solid fa-bolt fa-bounce"></i> Lightning Invoice`, invoiceEL,
                                [
                            
                                    {
                                        text: `<i class="fa-solid fa-rocket"></i> Open with App`,
                                        important:true,
                                        action: async ()=>{
                                            let webln;
                                            try{
                                                webln=await WebLN.requestProvider();
                                            }catch(e){
                                                console.error(e);
                                            }
                                            if(webln){
                                                Tasks.ok("sentLNInvoice","Lightning payment sent.");
                                                webln.sendPayment(invoice);
                                            }else{                                        
                                                const invoiceUri='lightning:'+invoice;
                                                if(!await DeepLink.check(invoiceUri)){
                                                    Tasks.error("notFoundAppLNInvoice","Lightning wallet not found.");
                                                }else{
                                                    Tasks.ok("sentLNInvoice","Lightning payment sent.");
                                                }
                                                window.open(invoiceUri);
                                            }
                                        }
                                    },
                                    {
                                        text: `<i class="fas fa-times"></i> Close`,
                                        action: undefined
                                    }
                                    
                                ]
                            );
                            },100);
                        }
                    },
                    {
                        text: `<i class="fas fa-times"></i> Cancel`,
                        action: undefined
                    }
                ]
            );
            }, ["donateCl", "donateClLightning"])); 
        }
        
        if(payinfo["paypal-id"]){
            const paypal = section.addItem(Ui.createButton("fab fa-paypal",
                `Donate with PayPal`, "Support this developer with a PayPal donation",async ()=>{
                    Tasks.completable("popupPaypal", "Opening PayPal page...", {}, false);
                    try{
                        let params = `toolbar=no,menubar=no,width=600,height=800`
                        window.open( `https://www.paypal.com/donate/?hosted_button_id=${payinfo["paypal-id"]}`,"donatePaypal",params);
                        Tasks.ok("popupPaypal");
                    }catch(e){
                        console.log(e);                        
                    }
                } ,["donateCl", "donateClPaypal"])); 
        }
 
        if(payinfo["github-id"]){
            section.addItem(Ui.createButton("fab fa-github-alt",
                `Sponsor on GitHub`, "Support this developer with GitHub sponsor",async ()=>{
                    Tasks.completable("popupGithub", "Opening GitHub sponsor page...", {}, false);
                    try{
                        window.open( `https://github.com/sponsors/${payinfo["github-id"]}`,"GitHub Sponsor");
                        Tasks.ok("popupGithub");
                    }catch(e){
                        console.log(e);                        
                    }
                } ,["donateCl", "donateClGithub"])); 
        }

        if(payinfo["patreon-id"]){
            const patreon = section.addItem(Ui.createButton("fab fa-patreon",
                `Support on Patreon`, "Support this developer on patreon",  async ()=>{
                    Tasks.completable("popupPatreon", "Opening Patreon page...", {}, false);
                    try{
                        window.open(`https://patreon.com/${payinfo["patreon-id"]}`);
                        Tasks.ok("popupPatreon");
                    }catch(e){
                        console.log(e);                        
                    }
                },
                ["donateCl", "donateClPatreon"])
            );
        }
    }
}