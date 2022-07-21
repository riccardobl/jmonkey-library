import EntriesManager from "../EntriesManager.js";
import fetch from 'node-fetch';
export default class JmeInitializerIndex{


    static async loadBaseLibraries() {
        if (process.env.JME_INITIALIZER_LIBRARIES_PATH) {
            const path=process.env.JME_INITIALIZER_LIBRARIES_PATH;
            if(path.startsWith("https://")||path.startsWith("http://")){
                return fetch(path).then(r=>r.json());
            }else{
                let data = await Fs.readFile(Path.join(process.env.JME_INITIALIZER_LIBRARIES_PATH));
                data = JSON.parse(data);
                return data;
            }           
        } else {
            let data = process.env.JME_INITIALIZER_LIBRARIES;
            if (!data) throw "Please export JME_INITIALIZER_LIBRARIES env variable";
            data = JSON.parse(data);
            return data;
        }
    }

    static async getLibrary(config){ 
        const libraries=await this.loadBaseLibraries();
        for(let i=0;;i+=100){
            const entries=await EntriesManager.list(undefined,i,100,false);
            console.log(entries);
            if(entries.entryId.length==0)break;
            for(let j=0;j<entries.entryId.length;j++){
                const entry=await EntriesManager.get(entries.userId[j],entries.entryId[j]);
                if(!entry.initializerCategory)continue;
                
                if(entry["maven-artifacts"]&&!entry.suspended&&!entry.banned){
                    const compatiblePlatforms=[];
                    const compatibleDeployments=[];
                    for(const platform of entry.platforms){
                        if(platform.startsWith("DESKTOP_")){
                            if(compatiblePlatforms.indexOf("JME_DESKTOP")==-1){
                                compatiblePlatforms.push("JME_DESKTOP");
                            }
                        }else if(platform.startsWith("VR")){
                            if(compatiblePlatforms.indexOf("JME_VR")==-1){
                                compatiblePlatforms.push("JME_VR");
                            }
                        }else if(platform=="MOBILE_ANDROID"){
                            if(compatiblePlatforms.indexOf("JME_ANDROID")==-1){
                                compatiblePlatforms.push("JME_ANDROID");
                            }
                        }

                        if(platform.endsWith("_LINUX")){
                            if(compatibleDeployments.indexOf("LINUX")==-1){
                                compatibleDeployments.push("LINUX");
                            }
                        }else   if(platform.endsWith("_WINDOWS")){
                            if(compatibleDeployments.indexOf("WINDOWS")==-1){
                                compatibleDeployments.push("WINDOWS");
                            }
                        } else if (platform.endsWith("_MACOS")) {
                            if (compatibleDeployments.indexOf("MACOS") == -1) {
                                compatibleDeployments.push("MACOS");
                            }
                        }

                    };

                    const artifacts = [];

                    for (const ar of entry["maven-artifacts"]) {
                        if(!ar)continue;
                        const [group, artifact, version] = ar.split(":");
                        artifacts.push({
                            "groupId": group,
                            "artifactId": artifact,
                            "pinVersion": version.replace("$VERSION", entry.version)
                        });
                    }

                    const repos = [];
                    if (entry["maven-repos"]) {
                        for (const repo of entry["maven-repos"]) {
                            if(!repo)continue;
                            if (repo.startsWith("https://github.com/")) {
                                const [, , , ghowner, ghrepo,] = repo.split("/");
                                repos.push(`maven githubPackage.invoke("${ghowner}/${ghrepo}")`);
                            } else if (repo.startsWith("http")) {
                                repos.push(`maven { url "${repo}" }`);
                            } else {
                                repos.push(repo);
                            }
                        }
                    }

                    if(artifacts.length>0){
                        const library={
                            key: entry.userId + "/" + entry.entryId,
                            displayName: `${entry.name} <i class="fa-solid fa-puzzle-piece" title="Community library" ></i> - <a target="_blank" href="${config.libraryUrl}/#!entry=${entry.userId}/${entry.entryId}" title="Open library page"><i class="fa-solid fa-question"></i></a>`,
                            category: entry.initializerCategory,
                            descriptionText: entry.descriptionSummary,
                            artifacts: artifacts,
                            additionalMavenRepos: repos,
                            compatiblePlatforms: compatiblePlatforms,
                            compatibleDeployments: compatibleDeployments
                        };
                        if(!libraries.find(l=>l.key==library.key)){
                            libraries.push(library);
                        }
                    }
                }


            }
        }
        return libraries;
    }

    static async init (server,config){
        server.get("/ext/initializer/libraries.json", async (req, res) => {
            res.setHeader("Cache-Control","no-cache");
            res.json(await this.getLibrary(config));
            res.end();
        });
    }
}