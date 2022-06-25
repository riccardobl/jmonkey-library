import fetch from "node-fetch";

import DatauriParser from 'datauri/parser.js';
import Api from "../../common/Api.js";
import Fs from 'fs';
import Utils from "../../common/Utils.js";
import { JSDOM } from 'jsdom';
import Webp from 'webp-converter';
import Tmp from 'tmp';

export default class GithubImporter {
    static initApi(register){
        
        this.mediaGet=new Api(JSON.parse(Fs.readFileSync("./common/messages/media/media-get.json")));
        this.entryApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/entry/entry.json")));
        
        this.importGhEntryApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/import/import-github-entry.json")));
        this.importGhMediaApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/import/import-github-media.json")));

        register("/ext-import/github/entry",this.importGhEntryApi,this.entryApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onImportEntry(d,ip,checkReqPerms));
        register("/ext-import/github/media",this.importGhMediaApi,this.mediaGet,(d,ip,checkReqPerms,checkRespPerms)=>this.onImportMedia(d,ip,checkReqPerms));
                
    }


    static async fetch(url,token){
        const options={headers: {
            authorization: "token "+token
          }};
        return fetch(url,token?options:undefined);
       
    }
    

    static async onImportEntry(data,ip){
        const entry=await this.getEntry(data.repo,data.token);
        entry.userId=data.userId;
        return entry;
    }


    static async onImportMedia(data,ip){
        const media=await this.getMedia(data.repo,data.mediaId,data.token);
        return {
            entryId:"entry",
            userId:data.userId,
            data:media
        };
    }

    static async getRepoInfos(repo,token){
        const info=await this.fetch(`https://api.github.com/repos/${repo}`,token).then(res=>res.json());
        if(info.message)throw info.message;        
        return info;

    }

    static async fetchFile(repo,possibleMatches,token){
        const info=await this.getRepoInfos(repo,token);
        const branch=info.default_branch||"main";

        const url=(file)=>`https://raw.githubusercontent.com/${repo}/${branch}/${file}`;
        for(let i in possibleMatches){
            const possibleMatch=possibleMatches[i];
            const d=url(possibleMatch);

            try{
                const content=await this.fetch(d,token).then(res=>res.text());
                if(content.startsWith("404:"))throw "404";
                console.log("Found",possibleMatch,"at",d);
                return {file:possibleMatch,content:content.trim()};
            }catch(e){
                console.log("Can't fetch",possibleMatch,"at",d,", skip...");
            }
        }
        return {file:"",content:""};
    }


    static async listFiles(repo,token){
        const info=await this.getRepoInfos(repo,token);
        const branch=info.default_branch||"main";
        const url=`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
        const tree=await this.fetch(url,token).then(res=>res.json());
        return tree.tree;
      

        
    }

    static async fetchReadme(repo,token) {
        const possibleMatches = [
            "README.md", "README.MD", "readme.md", "Readme.md", "ReadME.md",
            "README.txt", "README.TXT", "readme.txt", "Readme.txt", "ReadME.txt",
            "README", "readme", "Readme", "ReadME"
        ]
        return this.fetchFile(repo, possibleMatches,token);
    }

    static async fetchLicense(repo,token) {
        const possibleMatches = [
            "LICENSE.md", "LICENSE.MD", "license.md", "License.md",
            "LICENSE.txt", "LICENSE.TXT", "license.txt", "License.txt",
            "LICENSE", "license", "License"
        ];
        return this.fetchFile(repo, possibleMatches,token);
    }

    static async fetchLastRelease(repo,token){
        const releases=await this.fetch(`https://api.github.com/repos/${repo}/releases`,token).then(res=>res.json());
        for(let i in releases){
            const release=releases[i];
            if(!release.draft&&!release.prerelease){
                return release;
            }
        }
        for(let i in releases){
            const release=releases[i];
            if(!release.draft){
                return release;
            }
        }
        return undefined;

    }

    static extractUsageContent(content){
        const dom=JSDOM.fragment(`<div>${content}</div>`);
        const codeEls=dom.querySelectorAll("code");
        for(const codeEl of codeEls){
            const code = codeEl.innerText;

            let repos=/^\s*repositories\s*{\s*([^}]+)/img.exec(code);
            if(repos&&repos[1]){
                repos=repos[1];
                repos=repos.replace(/^\s*maven\s*{\s*url\s*['"]+([^'"]+)["']+\s*}/img,"$1");
                repos=repos.split("\n");
            } else repos=[];

            let deps=/^\s*dependencies\s*{\s*([^}]+)/img.exec(code);
            if(deps&&deps[1]){
                deps=deps[1];
                deps=deps.split("\n");
                deps = deps.map(d=>d.split(" ",1)[1]);
            } else deps=[];

            return [repos,deps];

            
        }
        return [undefined,undefined];
    }

    static extractTitleContent(content){
        let title;
        if(content&&content!=""){

            const dom=JSDOM.fragment(`<div>${content}</div>`);
            const h1=dom.querySelector("h1");
            if(h1){
                // h1.remove();
                title=h1.innerHTML;
                title=Utils.sanitize(title,{html:false});
            }
            content=dom.firstChild.innerHTML;
            content=Utils.sanitize(content,{html:true});
        }
        return [title,content];
        // if(content.startsWith("# ")){
        //     return content.substring(0, content.indexOf("\n")).substring(2);
        // }
        // return undefined;

    }

    static clean(txt){
        if(!txt)return txt;
        return txt.replace(/[^A-Za-z0-9\- .,_]+/g,"");

    }
    static async cliCall(source,token){
        if (!source.startsWith("https://github.com/")) throw new Error("Invalid github url " + url);
        const id = source.substring("https://github.com/".length);

        const entry=await this.getEntry(id,token);
        const media=[];
        let mediaId=0;
        while(true){
            try{
                const data=await this.getMedia(id,mediaId,token);
                mediaId++;
                if(!data) throw "Undefined media";
                media.push(data);
            }catch(e){
                console.log(e);
                break;
            }
        }
        return {
            entry:entry,
            media:media
        };
    }

    static async fixLinks(source,content,token){
        const info = await this.getRepoInfos(source,token);

        const dom =  JSDOM.fragment(`<div>`+content+`</div>`);
        const toAbs=(link,raw)=>{

            if(link&&!link.startsWith("http://")&&!link.startsWith("https://")){
                if(link.startsWith("/"))link=link.substring(1);
                if(raw){                    
                    link=`https://raw.githubusercontent.com/${source}/${info.default_branch}/${link}`;
                }else{
                    link=`https://github.com/${source}/tree/${info.default_branch}/${link}`;
                }
            }
            return link;
        }

        dom.querySelectorAll("a")
        .forEach(l=>{
            if(l.getAttribute("href"))l.setAttribute("href",toAbs(l.getAttribute("href")))
            
        });

        dom.querySelectorAll("img")
        .forEach(l=>l.setAttribute("src",toAbs(l.getAttribute("src"),true)));
        
        content=dom.firstChild.innerHTML;
        return content;
    }

    static async getEntry(source,token) {
        const info = await this.getRepoInfos(source,token);

        const readme=await this.fetchReadme(source,token);
        const license=await this.fetchLicense(source,token);
        const release=await this.fetchLastRelease(source,token);
        license.content=Utils.renderMarkdown(license.content);
        license.content=await this.fixLinks(source,license.content,token);

        readme.content=Utils.renderMarkdown(readme.content);
        readme.content=await this.fixLinks(source,readme.content,token);
        
        let repos,artifacts;
        [repos,artifacts]=this.extractUsageContent(readme.content);        

        let title;
        [title,readme.content]=this.extractTitleContent(readme.content);

        const entry = {};
        entry.entryId = info.name;
        entry.name = this.clean(title)||info.name;
        entry.repo = `https://github.com/${source}`;
        entry.docs = info.has_wiki?`https://github.com/${source}/wiki`:(readme.file?`https://github.com/${readme.file}`:undefined);
        entry.website =  info.homepage;
        entry.description = readme.content;
        entry.descriptionSummary = this.clean(info.description);
        entry.tags = info.topics;
        entry.download=release?release.html_url:`https://github.com/${source}/releases`;
        entry.issues=`https://github.com/${source}/issues`;
        entry.version=release?this.clean(release.tag_name):"SNAPSHOT";
        entry.license=license.file?license.content:undefined;
        entry["maven-repos"]=repos;        
        entry["maven-artifacts"]=artifacts;        

        return entry;

    }

    static async getMedia(source,mediaId,token) {
        const info = await this.getRepoInfos(source,token);


        let mediaFiles=(await this.listFiles(source,token)).filter(f=>{
            const path=f.path;
            return (path.startsWith("media/")||path.startsWith("screenshots/")||path.startsWith("screenshot/"))&&(path.endsWith(".jpg")||path.endsWith(".webp")||path.endsWith(".png")||path.endsWith(".webm")||path.endsWith(".mp4"));
        });

        mediaFiles=mediaFiles.map(mediaFile=>{
            mediaFile=mediaFile.path;
            return `https://raw.githubusercontent.com/${source}/${info.default_branch}/${mediaFile}`
        })

        const readme=await this.fetchReadme(source,token);
        readme.content=Utils.renderMarkdown(readme.content);
        readme.content=await this.fixLinks(source,readme.content,token);
        JSDOM.fragment(readme.content).querySelectorAll("img").forEach((el)=>{
            const l=el.getAttribute("src");
            if(l.endsWith(".png")||l.endsWith(".jpg")||l.endsWith(".webp")
            ||l.endsWith(".gif")
            ){
                console.log("Found image in readme",l);
                mediaFiles.push(l);
            }
        });


        let mediaFile=mediaFiles[mediaId];
        if(!mediaFile)throw "media not found";
        // mediaFile=mediaFile.path;

        let buffer=await this.fetch(mediaFile,token).then(res=>res.buffer());
        let ext=mediaFile.substring(mediaFile.lastIndexOf("."));

        // const tmpFile = Tmp.fileSync();
        // const tmpFile2 = Tmp.fileSync();
        // try{         
        //     Fs.writeFileSync(tmpFile.name,buffer);
        //     if(ext==".gif"){
        //         await Webp.gwebp(tmpFile.name,tmpFile2.name,"-q 80");
        //     }else{
        //         await Webp.cwebp(tmpFile.name,tmpFile2.name,"-q 80");
        //     }
        //     buffer=Fs.readFileSync(tmpFile2.name);

        //     ext=".webp";
        // }catch(e){
        //     console.error(e);
        // }
        // tmpFile.removeCallback();
        // tmpFile2.removeCallback();

        const parser = new DatauriParser();
        let dataUrl=await parser.format(ext, buffer).content; 

      
        return dataUrl;
        
    }
};


