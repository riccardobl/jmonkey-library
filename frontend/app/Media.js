
import Utils from "/common/Utils.js";
import Msg from "./Msg.js";
import Storage from "./Storage.js";
import Api from "/common/Api.js";
import Auth from "./Auth.js";

export default class Media {
    static async get(userId,  entryId, mediaId ) {
        
        const mediaGetApi = new Api(await Msg.getDef("media/media-get"));
        const msg = await mediaGetApi.parse("request", Auth.sign({ userId: userId, entryId: entryId,mediaId:mediaId },userId));
       let res = await fetch("/media/get", {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', },
           body: JSON.stringify(msg),
       }).then(r => r.json());
       res = await mediaGetApi.parse("response", res);
       if(res.error)throw res.error;
       return res;
    }

    static async unset(userId,  entryId, mediaId ) {        
        const mediaGetApi = new Api(await Msg.getDef("media/media-delete"));
        const msg = await mediaGetApi.parse("request",Auth.sign( { userId: userId, entryId: entryId,mediaId:mediaId },userId));
       let res = await fetch("/media/delete", {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', },
           body: JSON.stringify(msg),
       }).then(r => r.json());
       res = await mediaGetApi.parse("response", res);
       if(res.error)throw res.error;
    }
    // static async getFirstMedia(userId,  authId, authKey,entryId, nMedia,modId ) {
    //     for (let i = 0; i < nMedia; i++) {
    //         let res;
    //         try{
    //             res=await this.get(userId,authId,authKey,entryId,i,modId);
    //             // if(res.data.startsWith("data:image/")){
    //                 return [res.data,res.preview||res.data];
    //             // }

    //         }catch(e){
    //             console.error(e);
    //         }
    //     }

    //     return [undefined,undefined];
    // }
    static async getAll(userId,entryId, nMedia ) {
        const out = [];
        const promises=[];
        for (let i = 0; i < nMedia; i++) {
            try{
                promises.push(this.get(userId,entryId,i));

            }catch(e){
                console.error(e);
            }
        }
        (await Promise.allSettled(promises)).forEach(res=>{
            if(res.status=="fulfilled"){
                res=res.value;
                out.push([res.data,res.preview||res.data,res.blurred]);
            }else{
                out.push([undefined,undefined,undefined]);
            }
        })
        return out;
    }
    static async set(userId,  entryId, mediaId) {
    }
    static async set(userId,  entryId, mediaId,data) {
        console.log("Update", entryId,"media",mediaId);
        const uploadApi = new Api(await Msg.getDef("media/media-upload"));
        const msg = await uploadApi.parse("request", Auth.sign({
            userId:userId,
            entryId:entryId,
            mediaId:mediaId,
            data:data
        },userId));
        let res = await fetch("/media/set", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());
        if(res.error) throw res.error;
        return await uploadApi.parse("response", res)
    }
}
