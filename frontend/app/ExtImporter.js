
import Msg from "./Msg.js";
import Api from "/common/Api.js";
import Auth from "./Auth.js";
import Ui from "./ui/ui.js";
import Tasks from "./ui/Tasks.js";
export default class ExtImporter{

    static async import(source) {
        Tasks.completable("import","Importing...",{},true,false,undefined,false);
        
        let entry;
        let media;
        let waiting;
        if(waiting){
            clearInterval(waiting);
            waiting=undefined;
        }
        if(source.startsWith("https://github.com/")){
       
            const importEntry=async ()=>{
                let repo = source.substring("https://github.com/".length);
                
                const accessToken=localStorage.getItem("gh_accessToken");
                if(!accessToken)throw "Token not found";
                
                let api = new Api(await Msg.getDef("import/import-github-entry"));
                let msg = await api.parse("request", {
                    repo: repo,
                    token: accessToken,
                    userId:Auth.getCurrentUserID()
                });
                let res = await fetch("/ext-import/github/entry", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify(msg),
                }).then(r => r.json());
                if(res.error)throw new Error(res.error);

                const entryApi = new Api(await Msg.getDef("entry/entry"));
                entry = await entryApi.parse("response", res);

                const importedMedia = [];
                api = new Api(await Msg.getDef("import/import-github-media"));
                const mediaGetApi = new Api(await Msg.getDef("media/media-get"));
                for (let i = 0; ; i++) {
                    try {
                        let msg = await api.parse("request", {
                            repo: repo,
                            token: accessToken,
                            userId:Auth.getCurrentUserID(),
                            mediaId:i
                        });
                        let res = await fetch("/ext-import/github/media", {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', },
                            body: JSON.stringify(msg),
                        }).then(r => r.json());
                        res = await mediaGetApi.parse("response", res);
                        if(res.error)throw res.error;
                        importedMedia.push([res.data,res.preview||res.data]);
                    } catch (e) {
                        console.log(e);
                        break;
                    }
                }
                media = importedMedia;
            };
            try{
                if(!localStorage.getItem("gh_accessToken"))throw "Token is undefined";
                await importEntry();
            }catch(e){
                console.log(e);
                localStorage.removeItem("gh_accessToken");
                window.open("/github/authorize/", '_blank').focus();
                await new Promise((resolve, reject) => {
                    waiting = setInterval(async () => {
                        try {
                            if (!localStorage.getItem("gh_accessToken")) {
                                console.log("Waiting for access token...");
                                return;
                            }
                            clearInterval(waiting);
                            waiting = undefined;
                            await importEntry();
                            resolve();
                        } catch (er) {
                            Ui.error(er);
                            console.log(er);
                        }
                    }, 1000);

                });
            }
        }else if (source.startsWith("https://store.jmonkeyengine.org/")) {
            const id = source.substring("https://store.jmonkeyengine.org/".length);

            const entryGetApi = new Api(await Msg.getDef("entry/entry-get"));

            const msg = await entryGetApi.parse("request", {
                userId: Auth.getCurrentUserID(),
                entryId: id,
            });
            const res = await fetch("/ext-import/store/entry", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(msg),
            }).then(r => r.json());
            if(res.error)throw new Error(res.error);
            const entryApi = new Api(await Msg.getDef("entry/entry"));
            entry = await entryApi.parse("response", res);

            const importedMedia = [];
            const mediaGetApi = new Api(await Msg.getDef("media/media-get"));
            for (let i = 0; ; i++) {
                try {
                    const msg = await mediaGetApi.parse("request", {
                        userId: Auth.getCurrentUserID(),
                        entryId: id,
                        mediaId:i
                    });
                    let res = await fetch("/ext-import/store/media", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify(msg),
                    }).then(r => r.json());
                    res = await mediaGetApi.parse("response", res);
                    if(res.error)throw res.error;
                    importedMedia.push([res.data,res.preview||res.data]);
                } catch (e) {
                    console.log(e);
                    break;
                }
            }
            media = importedMedia;
        }
        Tasks.ok("import","Imported!");
        entry.platforms=undefined;

        return { entry: entry, media: media };
    }

}