import  AuthGateway from "./AuthGateway.js";
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {URL} from 'url';
import Api from '../../common/Api.js';
import fetch from 'node-fetch';
import Fs from 'fs';
import KeysManager from "../KeysManager.js";
import BackendUtils from '../BackendUtils.js';
import EntriesManager from "../EntriesManager.js";

export default  class DiscourseGateway extends AuthGateway{
    static async init (server,options,register){
        const {secret,baseUrl,discourseUrl,apiKey,apiUser,minTrustLevel} = options;
        this.apiKey=apiKey;
        this.discourseUrl=discourseUrl;
        this.apiUser=apiUser;
        this.nonces={};
        this.minTrustLevel=minTrustLevel;
        server.get("/discourse/embedEntry", async (req, res) => {
            console.log(req.query);
            const entryId = req.query["entryId"];
            const userId =""+(req.query["userId"]);
            let entry=undefined;

            if(entryId.match(/^[A-Za-z0-9_\\.@\\(\\)\\-]+$/)
            &&userId.match(/^[A-Za-z0-9_\\.@\\(\\)\\-]+$/)
            ){
                entry = await EntriesManager.get(userId,entryId);
            }

            if(!entry){
                res.status(404);
                res.set('X-Robots-Tag', 'noindex');
                res.end("404");
            }else{
                res.set('Content-Type', 'text/html');
                res.set('X-Robots-Tag', 'noindex');
                if(entry){
                    const realUrl=baseUrl+`/#!entry=${userId}/${entryId}`;
                    res.end(`<html>
                        <head>
                            <title>${entry.name} | jMonkeyEngine | Library</title>
                            <meta http-equiv="refresh" content="1; URL=${realUrl}" />
                        </head>
                        <body>
                        <a href="${realUrl}">${entry.name}</a>
                        </body>
                        </html>`);  
                } 
            }
        });

        server.get("/auth_confirm", async (req, res) => {
            try{
                console.log("Receive auth confirm");
                const sso=req.query.sso;
                const sig=req.query.sig;
                const authId=req.cookies['authId'];
                
                const ip =  await BackendUtils.getIp(req);


                let [credentialData]=this.verify(authId,secret,sso,sig,[ip]);
                credentialData=await KeysManager.set(credentialData,true,false);
                console.log("Auth confirmed",credentialData);
                res.cookie('authKey',credentialData.key);
                res.cookie('authUserId',credentialData.userId);
                res.cookie('authKeyId',credentialData.keyId);

                const user=await this.getUser(credentialData.userId);
                
                res.cookie('authIsMod',user.isMod);
                res.cookie('authIsTrusted',user.isTrusted);

                // setInterval(async ()=>{
                //     console.log(await KeysManager.list(credentialData.namespace,false));
                // },1000);
                res.redirect("/");
            }catch(e){
                console.log(e);
            }
        });
       
        server.get("/auth_request", async (req, res) => {
            try{
                // const src=decodeURIComponent(req.query.src);
            const userId=uuidv4();
            res.cookie('authId',userId);
            const redir=this.authorize(userId,secret,baseUrl,discourseUrl);
            if(redir){
                console.log("Redirect to",redir);
                res.redirect(redir);
            }else{
                res.end("error");
            }
        }catch(e){
            console.log(e);
        }
        });

        this.userApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/user/user.json")));
  
        register("/user/get",this.userApi,this.userApi,(d,ip,checkReqPerms)=>this.onUserNameRequest(d,ip,checkReqPerms));
      
    }

    static async onUserNameRequest(data,ip,checkReqPerms){
        return this.getUser(data.userId);
    }

    static async getUser(external_id){
        if(!this.userCache)this.userCache={};
        if(this.userCache[external_id])return this.userCache[external_id];
        
        const url=`${this.discourseUrl}/admin/users/${external_id}.json`;
        console.log("Fetch",url);
        const userData=await fetch(url,{
            method:"GET",
            headers:{
                'Api-Username':this.apiUser,
                'Api-Key':this.apiKey
            }
        }).then(res=>res.json());
        const out= {
            userName:userData.username,
            displayName:userData.name,
            isMod:userData.admin||userData.moderator,
            title:userData.title,
            userId:""+userData.id,
            isTrusted:userData.trust_level>=(this.minTrustLevel||2),
            avatar:userData.avatar_template?this.discourseUrl+userData.avatar_template.replace("{size}",512):undefined
        };
        this.userCache[external_id]=out;
        return out;
    }

    static authorize(userId,secret,baseUrl,discourseUrl){
        const nonce=uuidv4();
        this.nonces[userId]={
            // src:src,
            nonce:nonce
        };
        setTimeout(()=>{
            delete this.nonces[userId];
        },1000*60*60);
        const payload=`nonce=${nonce}&return_sso_url=${baseUrl}/auth_confirm`;
        const b64payload=Buffer.from(payload).toString('base64');
        const urlEncb64payload=encodeURI(b64payload);
        const hexSignature = createHmac('sha256', secret).update(b64payload).digest('hex');
        return `${discourseUrl}/session/sso_provider?sso=${urlEncb64payload}&sig=${hexSignature}`;
    }
    static verify(userId,secret,sso,sig,ips){
        const hexSignature = createHmac('sha256', secret).update(sso).digest('hex');
        if(hexSignature!=sig){
            console.error("Invalid signature");
            return null;
        }
        let query="https://placeholder/?"+Buffer.from(sso, 'base64').toString('ascii');
        query=new URL(query);
        const nonce=query.searchParams.get("nonce");
        const userData=this.nonces[userId]
        const savedNonce=userData.nonce;
        // const savedSrc=userData.src||"/";
        if(!savedNonce||savedNonce!=nonce||!nonce){
            console.error("Invalid nonce!",nonce,savedNonce,"for userid",userId);
            return null;
        }
        console.log(query);
        delete this.nonces[userId];
        const resp={};
        resp.keyId=query.searchParams.get("username")+"@"+query.searchParams.get("external_id")+"(discourse-session-"+uuidv4()+")";
        resp.description="Temporary AuthKey for "+query.searchParams.get("name")+" logged on discourse.";
        resp.userId=query.searchParams.get("external_id");
        resp.key=uuidv4();
        resp.expire=Date.now()+(1000*60*60*24*2);
        resp.ips=ips;
        // resp.isMod=query.searchParams.get("moderator")=="true";
        // resp.isTrusted=this.getUser(resp.userId).isTrusted;
        return [resp];

    }

}

