
import Utils from "/common/Utils.js";
import Msg from "./Msg.js";
import Api from "/common/Api.js";
import Auth from "./Auth.js";

export default class Entries {

    static async listIds(query, listHidden) {
        // const out = [];
        // const entryListApi = new Api(await Msg.getDef("entry/entry-list"));
        // const listReq = await entryListApi.parse("request", { query: query, listHidden: listHidden }, false);
        // await Utils.multipageFetch('/entry/list', listReq, 10, async (res) => {
        //     if (res.entryId.length == 0) return false;
        //     for (let i in res.entryId) {
        //         const uid = res.entryId[i];
        //         out.push(uid);
        //     }
        // });
        const out=[];
        let page=0;
        while(true){
            const outPart=await this.listIdsPage(query,page,listHidden);
            if(outPart.length==0) break;
            outPart.forEach(el=>out.push(el));
            page++;
        }
        return out;
    }

    static async listIdsPage(query, page, listHidden,pageSize) {
        if(!pageSize)pageSize=10;
        const entryListApi = new Api(await Msg.getDef("entry/entry-list"));
        let listReq = Auth.sign(await entryListApi.parse("request", { query: query, listHidden: listHidden }, false));
        listReq.page = page;
        listReq.limit = pageSize;

        const res = await fetch('/entry/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(listReq),
        }).then(r => r.json());
        if (res.error) throw res.error;
        const out = [];
        for (let i in res.entryId) {
            out.push({
                userId: res.userId[i],
                entryId: res.entryId[i]
            });
        }
        return out;
    }

    static async getListApi() {
        const msg = await Msg.getDef("entry/entry-list");
        const entryApi = new Api(msg);
        return entryApi;
    }

    static async getApi() {
        const msg = await Msg.getDef("entry/entry");
        const entryApi = new Api(msg);
        return entryApi;
    }

    static async get(userId, entryId) {
        const entryGetApi = new Api(await Msg.getDef("entry/entry-get"));
        const entryApi = await this.getApi();

        const msg = Auth.sign(await entryGetApi.parse("request", { entryId: entryId }), userId);

        let res = await fetch("/entry/get", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());

        res = await entryApi.parse("response", res);
        return res;
    }



    static async set(entry) {
        console.log("Update", entry);
        const entryApi = new Api(await Msg.getDef("entry/entry"));
        const msg = Auth.sign(await entryApi.parse("request", entry), entry.userId);
        let res = await fetch("/entry/set", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());
        return await entryApi.parse("response", res)
    }

    // static async delete(entryId) {
    //     console.log("Delete", entryId);
    //     const deleteApi = new Api(await Msg.getDef("entry/entry_delete"));
    //     const msg = Auth.sign(await deleteApi.parse("request", { entryId: entryId }));
    //     const res = await fetch("/entry/delete", {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json', },
    //         body: JSON.stringify(msg),
    //     }).then(r => r.json());
    //     // try{
    //     //     res=JSON.parse(res)
    //     // }catch(e){
    //     //     throw res;
    //     // }
    //     return await deleteApi.parse("response", res);
    // }


}