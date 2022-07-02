
import Fs from 'fs';
import Database from './Database.js';
import Api from '../common/Api.js';
// import KeysManager from './KeysManager.js';
import KeysManager from "./KeysManager.js";

export default  class EntriesManager{
    static async init(register){
        this.db=new Database("entries.json");
        this.likeDb=new Database("entries-like.json");
        this.getApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry-get.json")));
        this.entryApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry.json")));
        this.likeApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry-like.json")));
        // this.deleteApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry-delete.json")));
        this.listApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry-list.json")));
        register("/entry/list",this.listApi,this.listApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onListRequest(d,ip,checkReqPerms));
        register("/entry/get",this.getApi,this.entryApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onGetRequest(d,ip,checkReqPerms));
        register("/entry/set",this.entryApi,this.entryApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onSetRequest(d,ip,checkReqPerms));
        register("/entry/like-toggle",this.likeApi,this.likeApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onLikeToggleRequest(d,ip,checkReqPerms));
        register("/entry/like-get",this.likeApi,this.likeApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onLikeGetRequest(d,ip,checkReqPerms));
        // register("/entry/delete",this.deleteApi,this.deleteApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onDeleteRequest(d,ip,checkReqPerms));        
    }

    
    // Search and list
    // Authors start with @
    // Tags start with #
    // Everything else is free text search
    static async list(query,skip,limit,listHidden){
        let queryData=[];
        let sort={};

        if(query&&query.trim()!=""){
            const tags=[];
            const authors=[];
            const modifiers=[];
            let words=[];
            console.log(query);
            while(true){
                let type=0; // 0 = tag ; 1 = author 2= modifier
                let tagStart=query.indexOf("#");
                if(tagStart==-1){
                    tagStart=query.indexOf("@");
                    type=1;
                }
                if(tagStart==-1){
                    tagStart=query.indexOf(";");
                    type=2;
                }
                if(tagStart==-1)break;
                let tagEnd=query.indexOf(" ",tagStart);
                if(tagEnd==-1)tagEnd=query.length;
                let a=query.substring(0,tagStart);
                let b=query.substring(tagEnd+1);
                let tag=query.substring(tagStart+1,tagEnd);
                query=a+b;
                if(type==1){
                    authors.push(tag);
                    console.log("Found author",tag);
                }else if(type==2){
                    modifiers.push(tag);   
                    console.log("Found modifier",tag);

                }else{
                    tags.push(tag);
                    console.log("Found tag",tag);
                }            
            }     
            words=query.replace(/[^A-Za-z0-9]/g,' ').trim().split(" ").filter(w=>w);
            console.log("Found words",words);
            queryData=[];
            if(tags.length>0){
                queryData.push({"tags":{$in:tags}});      
            }
            if(authors.length>0){
                queryData.push({"userId":{$in:authors}});      
            }

            if(modifiers.length>0){
                let order=1;

                modifiers.forEach(m=>{
                    const mp=m.split("=");
                    
                    const mod=(mp[0]||"").toLowerCase().trim();
                    const v=(mp[1]||"").trim();
                    if(mod=="sortby"){
                        if(v=="updateDate"||v=="creationDate"||v=="likes"){
                            if(!sort)sort={};
                            sort[v]=order;
                        }                        
                    }else if(mod=="order"){
                        if(v=="asc"){
                            order=-1;
                        } else {
                            order=1;
                        }                             
                    }
                })
                
            }
            console.log(sort);
            if(words&&words.length>0){
                let regex="";
                words.forEach(w=>{
                    if(regex!="")regex+="|";
                    regex+=w.trim();
                });
                queryData.push(...[
                    { "description":{$regex:new RegExp(regex)} },
                    { "summary":{$regex:new RegExp(regex)} },
                    { "tags":{$regex:new RegExp(regex)} },
                    { "name":{$regex:new RegExp(regex)} }
                ]);

            }
        }        
        const filter=!listHidden?[
            {"suspended":{$exists:false}},
            {"banned":{$exists:false}}
        ]:undefined;
        const ee=await this.db.get(undefined,undefined,skip,limit,queryData,filter,sort);
        const uids=[];
        const namespaces=[];
        for(let i in ee){
            uids.push(ee[i].entryId);
            namespaces.push(ee[i].userId);
        }
        return {entryId:uids,userId:namespaces};
    }

    static async get(userId,entryId){        
        const data=(await this.db.get(userId,entryId))[0];      
        return data;
    }

    static async delete(userId,entryId){        
        await this.db.unset(userId,entryId);
        return {
            "success":true
        };
    }

    static async getLikes(userId,entryId){  
        const lk=(await this.likeDb.get(userId,entryId))[0] ;
        const data=(await this.db.get(userId,entryId))[0];
        return {
            likes:data.likes,
            likedBy:lk.likedBy
        }
    }

    static async toggleLike(userId,entryId,likerId){  
        const lk=(await this.likeDb.get(userId,entryId))[0] ;
        const data=(await this.db.get(userId,entryId))[0];
        const lki=lk.likedBy.indexOf(likerId);     
        console.log(lk,likerId,lki);  
        if(lki==-1){
            lk.likedBy.push(likerId);
            data.likes++;
        }else{
            lk.likedBy.splice(lki,1);
            data.likes--;
        }
        await this.db.set(userId,entryId,data);
        await this.likeDb.set(userId,entryId,lk);
        return {
            likes:data.likes,
            likedBy:lk.likedBy
        };
    }

    static async set(data){
        const dbEntry=await this.entryApi.parse("database",data);
        const oldEntry=await this.get(data.userId,data.entryId);
        if(!oldEntry){
            dbEntry.creationDate=Date.now();
            dbEntry.updateDate=Date.now();
            dbEntry.likes=0;
            await this.likeDb.set(dbEntry.userId,dbEntry.entryId,await this.likeApi.parse("database",{
                userId:dbEntry.userId,
                entryId:dbEntry.entryId,
                likedBy:[]
            }));
        }else{
            dbEntry.updateDate=Date.now();
            dbEntry.likes=oldEntry.likes;
            dbEntry.creationDate=oldEntry.creationDate;           
        }
        await this.db.set(dbEntry.userId,dbEntry.entryId,dbEntry);
        return this.get(data.userId,data.entryId);
    }


    static async onSetRequest(data,ip,checkReqPerms){
        // Check permissions
        const hints=[];
        const canEdit=await KeysManager.canEdit(data.modId,data.userId,data.authId,data.authKey,ip,hints);
        if(!canEdit) throw new Error("Unauthorized");
        checkReqPerms(hints);
  
        // Set
        return this.set(data);      
    }


    // static async onDeleteRequest(data,ip,checkReqPerms){
    //     // if(!await KeysManager.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");
    //     // if(data.modId && data.userId!=data.modId && !await KeysManager.validateAsMod(data.modId,data.authId,data.authKey,ip))throw new Error("Unauthorized");
    //     // else if(!await KeysManager.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");
    //     const hints=[];
    //     const canEdit=await KeysManager.canEdit(data.modId,data.userId,data.authId,data.authKey,ip);
    //     if(!canEdit)throw new Error("Unauthorized");
    //     checkReqPerms(hints);

    //     return this.delete(data.userId,data.entryId);      
    // }
    
    static async onLikeToggleRequest(data,ip,checkReqPerms){
        // Check permissions
        if(!KeysManager.validate(data.userId,data.authId,data.authKey,ip))throw "Unauthorized";

        // Search
        return this.toggleLike(data.entryUserId||data.userId,data.entryId,data.userId); 
    }

    static async onLikeGetRequest(data,ip,checkReqPerms){      
        // Check permissions
        const hints=[];
        const canEdit=await KeysManager.canEdit(data.modId,data.userId,data.authId,data.authKey,ip,hints);
        checkReqPerms(hints);
             
        // Search
        return this.getLikes(data.userId,data.entryId);
    }
    
    static async onListRequest(data,ip,checkReqPerms){
        // Check permissions
        const hints=[];
        const canEdit=await KeysManager.canEdit(data.modId,data.userId,data.authId,data.authKey,ip,hints);
        checkReqPerms(hints);

        // Search
        return this.list(data.query,data.page*data.limit,data.limit,data.listHidden);    
    }

    static async onGetRequest(dataIn,ip,checkReqPerms){
        // Check permissions
        const hints=[];
        const canEdit=await KeysManager.canEdit(dataIn.modId,dataIn.userId,dataIn.authId,dataIn.authKey,ip,hints);
        checkReqPerms(hints);

        // Get data
        const data=await this.get(dataIn.userId,dataIn.entryId);

        // Remove unrequired infos if suspended or banned and the user is not an owner or mod
        if(data&&!canEdit&&(data.suspended||data.banned)){
            console.log("Entry is suspended and the user is not an editor. Some data will be hidden");
            const def=await this.entryApi.getDefByType("response");
            for(let k in data){
                if(!def[k]["required"]&&k!="suspended"&&k!="banned"){
                    data[k]=undefined;
                }
            }
        }
        
        return data;    
    }
}
