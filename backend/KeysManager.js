
import Fs from 'fs';
import Database from './Database.js';
import Api from '../common/Api.js';

export default  class KeysManager{
    static async init(register){
        this.db=new Database("keys.json");
        this.keyDbApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/key/key-db.json")));
        this.keySetApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/key/key-set.json")));
        this.keyGetApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/key/key-get.json")));
        this.keyCheck=new Api(JSON.parse(Fs.readFileSync("./common/messages/key/key-check.json")));
        this.keyDelete=new Api(JSON.parse(Fs.readFileSync("./common/messages/key/key-delete.json")));
        this.keyList=new Api(JSON.parse(Fs.readFileSync("./common/messages/key/key-list.json")));
        this.keyKeepAlive=new Api(JSON.parse(Fs.readFileSync("./common/messages/key/key-keepalive.json")));

        register("/key/list",this.keyList,this.keyList,(d,ip,checkReqPerms)=>this.onListRequest(d,ip,checkReqPerms));
        register("/key/get",this.keyGetApi,this.keyGetApi,(d,ip,checkReqPerms)=>this.onCredentialRequest(d,ip,checkReqPerms));
        register("/key/add",this.keySetApi,this.keySetApi,(d,ip,checkReqPerms)=>this.onAddRequest(d,ip,checkReqPerms));
        register("/key/check",this.keyCheck,this.keyCheck,(d,ip,checkReqPerms)=>this.onValidateRequest(d,ip,checkReqPerms));
        register("/key/delete",this.keyDelete,this.keyDelete,(d,ip,checkReqPerms)=>this.onDeleteRequest(d,ip,checkReqPerms));
        register("/key/keepalive",this.keyKeepAlive,this.keyKeepAlive,(d,ip,checkReqPerms)=>this.onKeepAliveRequest(d,ip,checkReqPerms));
        
    }

    static async list(userId,skip,limit){
        const keys=await this.db.get(userId,undefined,skip,limit);
        const uids=[];
        for(let i in keys){
            uids.push(keys[i].keyId);
        }
        return {keyId:uids,userId:userId};
    }

    static async get(userId,keyId){        
        let key=(await this.db.get(userId,keyId))[0];
        // credentials=await this.credentialApi.parse("response",credentials,withMeta);
        return key;
    }

    static async delete(userId,keyId){        
        await this.db.unset(userId,keyId);
        return {
        }
    }

    static async validate(userId,keyId,key,ip){
        if(!userId||!keyId||!key)return false;
        console.log("Validate",userId,keyId,key,ip);
        const keyE=await this.get(userId,keyId);
        if(!keyE){
            console.log("Key does not exist.");
            return false;
        }
        if(keyE.key!=key){
            console.log("Key is invalid",userId,keyId,keyE.key,key);
            return false;
        }
        if(keyE.ips&&keyE.ips.length>0&&ip&&keyE.ips.indexOf(ip)==-1){
            console.log("Ip not authorized.");
            return false;

        }
        console.log("Valid");
        return true;
    }

    static async validateAsMod(userId,keyId,key,ip){
        if(!userId||!keyId||!key)return false;
        console.log("Validate",userId,keyId,key,ip);
        const keyE=await this.get(userId,keyId);
        if(!keyE){
            console.log("Key does not exist.");
            return false;
        }
        if(keyE.key!=key){
            console.log("Key is invalid",userId,keyId,keyE.key,key);
            return false;
        }
        if(keyE.ips&&keyE.ips.length>0&&ip&&keyE.ips.indexOf(ip)==-1){
            console.log("Ip not authorized.");
            return false;

        }
        console.log("Valid");
        return keyE.isMod;
    }


    static async canEdit(modId,userId,keyId,key,ip,hints){
        if(modId){
            if(await this.validateAsMod(modId,keyId,key,ip)){
                if(hints)hints.push("MOD");
                return true;
            }
            return false;
        }
        return await this.validate(userId,keyId,key,ip);
    }

    static async set(data){
        const dbEntry=await this.keyDbApi.parse("database",data);
        console.log("Set",dbEntry);        
        await this.db.set(dbEntry.userId,dbEntry.keyId,dbEntry,dbEntry.expire);
        return this.get(data.userId,data.keyId);
    }


    static async onAddRequest(data,ip,checkReqPerms){
        const hints=[];
        const canEdit=await this.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        checkReqPerms(hints);
        if(!canEdit)throw new Error("Unauthorized");

        if(await this.get(data.userId,data.keyId)) throw new Error("Can't replace an existing key. It must be deleted and recreated.");

        // if(!await this.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");
        this.set(data);      
        
        return {};
    }

    static async onKeepAliveRequest(data,ip,checkReqPerms){
        const hints=[];
        const canEdit=await this.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        checkReqPerms(hints);
        if(!canEdit)throw new Error("Unauthorized");
        const key=await this.get(data.userId,data.keyId);
        if(key&&key.expire){
            key.expire=(new Date()+30).getTime();
            this.set(key);      
        }      
        return {};
    }

    static async onDeleteRequest(data,ip,checkReqPerms){
        const hints=[];
        const canEdit=await this.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        checkReqPerms(hints);
        if(!canEdit)throw new Error("Unauthorized");


        // if(!await this.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");
        return this.delete(data.userId,data.keyId);      
    }
    static async onValidateRequest(data,ip,checkReqPerms){
        // const hints=[];
        // const canEdit=await this.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        // checkReqPerms(hints);
        // if(!canEdit)throw new Error("Unauthorized");


        console.log("onValidateRequest");
        return {
            userId:data.userId,
            authId:data.authId,
            valid:(await this.validate(data.userId,data.authId,data.authKey,ip))
        };
    }

    static async onListRequest(data,ip,checkReqPerms){
        console.log("onListRequest");
        // if(!await this.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");
        const hints=[];
        const canEdit=await this.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        checkReqPerms(hints);
        if(!canEdit)throw new Error("Unauthorized");


        return this.list(data.userId,data.page*data.limit,data.limit);    
    }

    static async onCredentialRequest(data,ip,checkReqPerms){
        console.log("onCredentialRequest");
        const hints=[];
        const canEdit=await this.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        checkReqPerms(hints);
        if(!canEdit)throw new Error("Unauthorized");



        // if(!await this.validate(data.userId,data.authId,data.authKey,ip)) throw new Error("Unauthorized");
        const out= this.get(data.userId,data.keyId,false);
        return out;
      
    }
}

// module.exports=CredentialsManager;