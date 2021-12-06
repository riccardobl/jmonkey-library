import fetch from "node-fetch";

import DatauriParser from 'datauri/parser.js';
import Api from "../../common/Api.js";
import Fs from 'fs';

export default class StoreImporter {
    static initApi(register){
        
        this.mediaGet=new Api(JSON.parse(Fs.readFileSync("./common/messages/media/media-get.json")));
        this.entryApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry.json")));
        this.entryGetApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry-get.json")));

        register("/ext-import/store/entry",this.entryGetApi,this.entryApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onImportEntry(d,ip,checkReqPerms));
        register("/ext-import/store/media",this.mediaGet,this.mediaGet,(d,ip,checkReqPerms,checkRespPerms)=>this.onImportMedia(d,ip,checkReqPerms));
                
    }


    static async onImportEntry(data,ip){
        const entryId=data.entryId;
        const entry=await this.getEntry(entryId);
        entry.userId=data.userId;
        return entry;
    }


    static async onImportMedia(data,ip){
        const entryId=data.entryId;
        const mediaId=data.mediaId;
        const media=await this.getMedia(entryId,mediaId);
        return {
            entryId:entryId,
            userId:data.userId,
            data:media
        };
    }


    static async cliCall(source){
        if (!source.startsWith("https://store.jmonkeyengine.org/")) throw new Error("Invalid store url " + url);
        const id = source.substring("https://store.jmonkeyengine.org/".length);
        const entry=await this.getEntry(id);
        const media=[];
        let mediaId=0;
        while(true){
            try{
                const data=await this.getMedia(id,mediaId);
                mediaId++;
                if(!data) throw "Undefined media";
                media.push(data);
            }catch(e){
                break;
            }
        }
        return {
            entry:entry,
            media:media
        };
    }

    static async getData(id){
        // validate id

        const data = await fetch(`https://store.jmonkeyengine.org/api/page/${id}`).then(res => res.json());
        return data;
            
    }

    static async getEntry(source) {
        
        const data = await this.getData(source);

        const entry = {};
        entry.entryId = data.id;
        entry.name = data.details.title;
        entry.repo = data.openSourceData.gitRepository;
        entry.docs = data.externalLinks.docsWebsite;
        entry.discussions = data.externalLinks.hubLink;
        entry.website = data.externalLinks.publisherWebsite;
        entry.description = data.details.description;
        entry.descriptionSummary = data.details.shortDescription;
        entry.tags = data.details.tags.split(",");
        entry.tags.push(data.category.name);
        entry.tags.push(data.category.parent.name);
        entry.tags.push(data.id);

        if(data.buildData){
            let usage="Add this software to your project\n```gradle";

            {
                usage+="\nrepositories {\n"
                data.buildData.repositories.split(",").forEach(r=>{
                    usage+="    "+r+"\n";
                });
                usage+="\n}\n\n"
            }
            {
                usage+="\dependencies {\n"
                data.buildData.hostedDependencies.split(",").forEach(r=>{
                    usage+="    "+r+"\n";
                });
                usage+="\n}"
                
            }

            usage+="\n```";

            entry.usage=usage;
            

        }

        entry.version = data.versionData.version;
        entry.license = "";
        [{ name: "Software License", id: "softwareLicense" }, { name: "Media License", id: "mediaLicense" }].forEach(l => {
            const licenseData=data.openSourceData[l.id];

            entry.license += `## ${l.name}\n`;
            entry.license += `[${licenseData.name}](${licenseData.url})\n`;

            entry.license += `## Permissions\n`;
            licenseData.permissions.forEach(p => {
                entry.license += `### ${p.name}\n${p.description}\n`;
            });


            entry.license += `## Conditions\n`;
            licenseData.conditions.forEach(p => {
                entry.license += `### ${p.name}\n${p.description}\n`;
            });

            entry.license += `## Limitations\n`;
            licenseData.limitations.forEach(p => {
                entry.license += `### ${p.name}\n${p.description}\n`;
            });

        });

        return entry;

    }

    static async getMedia(source,mediaId) {
        const data = await this.getData(source);

        const imageIds=data.mediaLinks.imageIds.split(",");
        const imageId=imageIds[mediaId];
        if(!imageId)throw "Media not found with id "+mediaId;
        const imageData=await fetch(`https://store.jmonkeyengine.org/image/${imageId}`).then(res=>res.buffer());

        const parser = new DatauriParser();
        const dataUrl=await parser.format('.jpg', imageData).content; 
        return dataUrl;
        

    }
};


