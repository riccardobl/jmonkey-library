import fetch from 'node-fetch';

const Users={
    "jayfella":null,
    "sgold":"sgold",
    "tlf30":"tlf30",
    "RiccardoBlb":null,
    "grizeldi":"grizeldi",
    "glh3586": "glh3586",
    "nickidebruyn":"ndebruyn",
    "arthasPL":"ArthasPL",
    "remy_vd":"remy_vd",
    "adibarda":"adi.barda",
    "polinc":"polinc",
    "RichTea":"richtea",
    "benckx":"benckx",
    "1724624287@qq.com":"jhonkkk",
    "yaRnMcDonuts":"yaRnMcDonuts",
    "Markil3":"Markil3",
    "joliver82":"joliver82",
    "rickard":"rickard"
};

const EntriesExclusion=[
    "38308161-c3cf-4e23-8754-528ca8387c11"
];

async function apiCall(api, body) {
    const host=process.env.LIBRARY_HOST||"http://localhost:8081";

    const url = `${host}/${api}`;
    let data = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json"
        }
    }).then(res => res.text());
    data=JSON.parse(data);
    if (data.error) throw data.error;
    return data;

}

async function getEntries(user){
    const entries=[];
    const host=process.env.STORE_HOST||"https://store.jmonkeyengine.org";
    const data = await fetch(`${host}/api/search/?categoryId=-1&title=&tag=&author=${user}&orderBy=updated&direction=descending&page=0`).then(res=>res.json());
    for(let entry of data.content){
        const id = entry.id;
        if(EntriesExclusion.indexOf(id)!=-1)continue;
        entries.push(id);
    }
    return entries;
}

async function importAll(){
    const modId=process.env.MOD_ID;
    const authKey=process.env.AUTH_KEY;
    const authId=process.env.AUTH_ID;
    
    for(const [storeUser,hubUser] of Object.entries(Users)){
        if(!hubUser)continue;
        try{
            const entries = await getEntries(storeUser);
            if(entries.length==0)continue;
            const userData=await fetch(`https://hub.jmonkeyengine.org/u/${hubUser}.json`).then(res=>res.json());
            const userId=userData.user.id.toString();
            const isTrusted = userData.user.trust_level>=2;


            for(const entryId of entries){
                const importedEntry = await apiCall("ext-import/store/entry", {
                    userId: userId,
                    entryId: entryId,
                });

                const importedMedia = [];
                let lastMediaId=0;
                for (let i = 0; ; i++) {
                    try {
                        const mediaData = await apiCall("ext-import/store/media", {
                            userId: userId,
                            entryId: entryId,
                            mediaId:i
                        });
                        mediaData.mediaId=lastMediaId;
                        lastMediaId++;
                        importedMedia.push(mediaData);
                    } catch (e) {
                        console.log(e);
                        break;
                    }
                }

                importedEntry.funding=true;
                if(isTrusted)importedEntry.initializerCategory="GENERAL";
                importedEntry.modId = modId;
                importedEntry.authKey = authKey;
                importedEntry.authId = authId;
                importedEntry.entryId = entryId;

                await apiCall("entry/set", importedEntry);

                for (const mediaData of importedMedia) {
                    console.info("Set media",mediaData.mediaId, "for entry",importedEntry.entryId);
                    try{
                        mediaData.entryId = entryId;
                        mediaData.modId = modId;
                        mediaData.authKey = authKey;
                        mediaData.authId = authId;
                        await apiCall("media/set", mediaData);
                    }catch(e){
                        console.error(e);
                    }
                }
            }

        

        }catch(e){
            console.error(e);
        }
    }
}

importAll();