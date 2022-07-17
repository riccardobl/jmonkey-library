import fetch from "node-fetch";

import DatauriParser from 'datauri/parser.js';
import Api from "../../common/Api.js";
import Fs from 'fs';
import Utils from "../../common/Utils.js";
import { JSDOM } from 'jsdom';
import Webp from 'webp-converter';
import Tmp from 'tmp';
import Crypto from 'crypto';
import marked from 'marked';

import createDOMPurify from 'dompurify';

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
        let lastError=undefined;
        for(let i=0;i<4;i++){
            try{
                const options={headers: {
                    authorization: "token "+token
                }};
                return await  fetch(url,token?options:undefined).then(res=>res.text());
            }catch(e){
                lastError=e;
                console.error(e);     
                await Utils.sleep(1000);            
            }
        }
        if(lastError)throw lastError;
    }

    static async fetchBuffer(url,token){
        let lastError=undefined;
        for(let i=0;i<4;i++){
            try{
                const options={headers: {
                    authorization: "token "+token
                }};
                return await  fetch(url,token?options:undefined).then(res=>res.buffer());
            }catch(e){
                lastError=e;
                console.error(e);     
                await Utils.sleep(1000);            
            }
        }
        if(lastError)throw lastError;
    }


    static async fetchJSON(url,token){
        let lastError=undefined;
        for(let i=0;i<4;i++){
            try{
                let data = await this.fetch(url,token);
                data = JSON.parse(data);
                return data;
            }catch(e){
                lastError=e;
                console.error(e);              
                await Utils.sleep(100);  
            }
        }
        if(lastError)throw lastError;
    }

    static async onImportEntry(data,ip){
        const entry=await this.getEntry(data.repo,data.token,data.ref);
        entry.userId=data.userId;
        return entry;
    }


    static async onImportMedia(data,ip){
        const [info,media]=await this.getMedia(data.repo,data.mediaId,data.token,data.ref);
        return {
            entryId:info.name,
            userId:data.userId,
            data:media
        };
    }

    static async getRepoInfos(repo,token){
        const info=await this.fetchJSON(`https://api.github.com/repos/${repo}`,token);
        if(info.message)throw info.message;        
        return info;

    }

    static async fetchFile(repo,possibleMatches,token, ref){
        const info=await this.getRepoInfos(repo,token);
        ref=ref||info.default_branch||"main";

        const url=(file)=>`https://raw.githubusercontent.com/${repo}/${ref}/${file}`;
        for(let i in possibleMatches){
            const possibleMatch=possibleMatches[i];
            const d=url(possibleMatch);

            try{
                const content=await this.fetch(d,token);
                if(content.startsWith("404:"))throw "404";
                console.log("Found",possibleMatch,"at",d);
                return {file:possibleMatch,content:content.trim()};
            }catch(e){
                console.log("Can't fetch",possibleMatch,"at",d,", skip...");
            }
        }
        return {file:"",content:""};
    }


    static async listFiles(repo,token,ref){
        const info=await this.getRepoInfos(repo,token);
        ref=ref||info.default_branch||"main";
        const url=`https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`;
        const tree=await this.fetchJSON(url,token);
        return tree.tree;
      

        
    }

    static async fetchReadme(repo,token,ref) {
        ref=ref||info.default_branch||"main";

        const readmeData= await this.fetchJSON(`https://api.github.com/repos/${repo}/readme?ref=${encodeURIComponent(ref)}`,token);

       const content= await this.fetch(readmeData.download_url,token);

       return {file:readmeData.html_url,content:content};

    }

    static async fetchLicense(repo,token,ref) {
        const possibleMatches = [
            "LICENSE.md", "LICENSE.MD", "license.md", "License.md",
            "LICENSE.txt", "LICENSE.TXT", "license.txt", "License.txt",
            "LICENSE", "license", "License"
        ];
        return this.fetchFile(repo, possibleMatches,token,ref);
    }

    static async fetchLastRelease(repo,token){
        const releases=await this.fetchJSON(`https://api.github.com/repos/${repo}/releases`,token);
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
        console.info("Content ",content);
        const dom=JSDOM.fragment(`<div>${content}</div>`);
        let outRepos=[];
        let outDeps=[];
        let found=false;
        dom.querySelectorAll("code").forEach(codeEl=>{
            if(found)return;

            const code = codeEl.innerHTML;

            let repos=Utils.extractMavenRepos(code);
            // let repo;
            // let rx=/^\s*maven\s*{\s*url\s*['"]+([^'"]+)["']+\s*}/img;
            // while((repo=rx.exec(code))!=null){
            //     if(repo&&repo[1]){
            //         repo=repo[1];
            //         repos.push(repo);
            //     }               
            // }
            
            // rx=/^\s*maven\s*githubPackage\.invoke\s*\(\s*['"]+([^'"]+)["']+/img;
            // while((repo=rx.exec(code))!=null){
            //     if(repo&&repo[1]){
            //         repo=repo[1];
            //         repos.push("https://github.com/"+repo);
            //     }               
            // }
         

            // let deps=/^\s*dependencies\s*{\s*([^}]+)/img.exec(code);
            // if(deps&&deps[1]){
            //     deps=deps[1];
            //     deps=deps.split("\n");
            //     deps = deps.map(d=>{
            //         d=d.trim();
            //         d=d.split(/[ (]/);
            //         d.shift();
            //         d= d.join(" ").trim();     
            //         console.log(d);
            //         if(d.indexOf("group:")!=-1&&d.indexOf("name:")!=-1){
            //             let group=/group: ["']([^"']+)/i.exec(d);
            //             let name=/name: ["']([^"']+)/i.exec(d);
            //             let version=/version: ["']([^"']+)/i.exec(d);

            //             if(group)group=group[1];
            //             if(name)name=name[1];
            //             if(version)version=version[1];
            //             else version="$VERSION";
                        
            //             if(group&&name&&version){
            //                 d=`${group}:${name}:${version}`;
            //             }else{
            //                 d=undefined;
            //             }
                        
            //         }else{
            //             d=d.substring(1);
            //             d=d.substring(0,d.length-1);
            //         }
                    
                    
            //         return d;
            //     });
            // } else deps=[];
            const deps=Utils.extractMavenDeps(code);

            outRepos.push(...repos.filter(v=>v));
            outDeps.push(...deps.filter(v=>v));            
            found=deps.length>0;
        });

        return [outRepos,outDeps];
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
    }

    static clean(txt){
        if(!txt)return txt;
        return txt.replace(/[^A-Za-z0-9\- .,_]+/g,"");

    }
    static async cliCall(source,token,ref){
        if (!source.startsWith("https://github.com/")) throw new Error("Invalid github url " + url);
        const id = source.substring("https://github.com/".length);
        ref=ref||info.default_branch||"main";

        const entry=await this.getEntry(id,token);
        const media=[];
        let mediaId=0;
        while(true){
            try{
                const data=await this.getMedia(id,mediaId,token,ref)[1];
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

    static async fixLinks(source,content,token,ref){
        const info = await this.getRepoInfos(source,token);
        ref=ref||info.default_branch||"main";

        const dom =  JSDOM.fragment(`<div>`+content+`</div>`);
        const toAbs=(link,raw)=>{

            if(link&&!link.startsWith("http://")&&!link.startsWith("https://")){
                if(link.startsWith("/"))link=link.substring(1);
                if(raw){                    
                    link=`https://raw.githubusercontent.com/${source}/${ref}/${link}`;
                }else{
                    link=`https://github.com/${source}/tree/${ref}/${link}`;
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

    static async getEntry(source,token,ref) {
        const info = await this.getRepoInfos(source,token);
        ref=ref||info.default_branch||"main";

        const readme=await this.fetchReadme(source,token,ref);
        const license=await this.fetchLicense(source,token,ref);
        const release=await this.fetchLastRelease(source,token,ref);
        license.content=Utils.renderMarkdown(license.content);
        license.content=await this.fixLinks(source,license.content,token,ref);

        readme.content=Utils.renderMarkdown(readme.content);
        readme.content=await this.fixLinks(source,readme.content,token,ref);
        
        let repos,artifacts;
        [repos,artifacts]=this.extractUsageContent(readme.content);        

        let title;
        [title,readme.content]=this.extractTitleContent(readme.content);


        let version;
        let download;
        if(release&&release.tag_name==ref){
            version=this.clean(release.tag_name);
            download=release.html_url
        }else{
            version=this.clean(ref);
            download=`https://github.com/${source}`;
        }

        const entry = {};
        entry.entryId = info.name;
        entry.name = this.clean(title)||info.name;
        entry.repo = `https://github.com/${source}/tree/${ref}`;
        entry.docs = info.has_wiki?`https://github.com/${source}/wiki`:readme.file;
        entry.website =  info.homepage;
        entry.description = readme.content ||   entry.name;
        entry.descriptionSummary = this.clean(info.description)||  entry.name;
        entry.tags = info.topics;
        entry.download=download;
        entry.issues=`https://github.com/${source}/issues`;
        entry.version=version;
        entry.license=license.file?license.content:undefined;
        entry["maven-repos"]=repos;        
        entry["maven-artifacts"]=artifacts;        

        return entry;

    }

    static async getMedia(source,mediaId,token,ref) {
        const info = await this.getRepoInfos(source,token);

        ref=ref||info.default_branch||"main";

        let mediaFiles=(await this.listFiles(source,token,ref)).filter(f=>{
            const path=f.path;
            return (path.startsWith("media/")||path.startsWith("screenshots/")||path.startsWith("screenshot/"))&&(path.endsWith(".jpg")||path.endsWith(".webp")||path.endsWith(".png")||path.endsWith(".webm")||path.endsWith(".mp4"));
        });

        mediaFiles=mediaFiles.map(mediaFile=>{
            mediaFile=mediaFile.path;
            return `https://raw.githubusercontent.com/${source}/${ref}/${mediaFile}`
        })

        const readme=await this.fetchReadme(source,token,ref);
        readme.content=Utils.renderMarkdown(readme.content);
        readme.content=await this.fixLinks(source,readme.content,token,ref);
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

        let buffer=await this.fetchBuffer(mediaFile,token);
        let ext=mediaFile.substring(mediaFile.lastIndexOf("."));

        const parser = new DatauriParser();
        let dataUrl=await parser.format(ext, buffer).content; 

      
        return [info,dataUrl];
        
    }
};

