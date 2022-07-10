import EntriesManager from "../EntriesManager.js";
import fetch from 'node-fetch';
import PaymentManager from "../pay/PaymentManager.js";

export default class SplitDonations{
    static async loadBase() {
        return [
            {
                "type": "github-org-team",
                "id":"jMonkeyEngine/teams/core",
                "org": "jMonkeyEngine",
                "teams": [
                    "core"
                ],
                "autorefresh": true,
                "description": "jMonkeyEngine Core Team",
                "weight": 0.2
            },
            {
                "type": "github-org-team",
                "id":"jMonkeyEngine/teams/documentalists",
                "org": "jMonkeyEngine",
                "teams": [
                    "documentalists"
                ],
                "autorefresh": true,
                "description": "jMonkeyEngine Documentation Maintainers",
                "weight": 0.2
            },
            {
                "type": "github-org-team",
                "id":"jMonkeyEngine/teams/sdk-maintainers",
                "org": "jMonkeyEngine",
                "autorefresh": true,
                "teams": [
                    "sdk-maintainers"
                ],
                "description": "jMonkeyEngine SDK Maintainers",
                "weight": 0.2
            },
            {
                "type": "github-repo",
                "id":"jMonkeyEngine/contributors/top",
                "modifier": "top-alltime",
                "limit": 30,
                "autorefresh": true,
                "org": "jMonkeyEngine",
                "repos": [
                    "jmonkeyengine",
                    "sdk",
                    "wiki",
                    "jmonkeyengine-website",
                    "jme-initializer"
                ],
                "description": "jMonkeyEngine top 30 contributors",
                "message": "",
                "weight": 0.2
            },
            {
                "type": "github-repo",
                "id":"jMonkeyEngine/contributors/top-monthly",
                "modifier": "top-monthly",
                "limit": 10,
                "org": "jMonkeyEngine",
                "autorefresh": true,
                "repos": [
                    "jmonkeyengine",
                    "sdk",
                    "wiki",
                    "jmonkeyengine-website",
                    "jme-initializer"
                ],
                "description": "jMonkeyEngine top 10 monthly contributors",
                "weight": 0.4
            },
            {
                "type": "opencollective",
                "id":"jMonkeyEngine/opencollective",
                "collective": "jmonkeyengine",
                "minSats": 5034,
                "description": "jMonkeyEngine opencollective",
                "weight": 0.0
            }
        ];
    }

    static async get(){ 
        const targets=await this.loadBase();
        for(let i=0;;i+=100){
            const entries=await EntriesManager.list(undefined,i,100,false);
            if(entries.entryId.length==0)break;
            for(let j=0;j<entries.entryId.length;j++){
                const entry=await EntriesManager.get(entries.userId[j],entries.entryId[j]);
                if(!entry.funding||entry.suspended||entry.banned) continue;
                const payInfo = await PaymentManager.get(entry.userId);
                if(payInfo["ln-address"]){
                    const target = {
                        "type": "lightning-address",
                        "description": entry.name,
                        "id":entry.userId+"/"+entry.entryId,
                        "enabled":false,
                        "weight": 0.6
                    };
                    targets.unshift(target);              
                }
            }
        }
        return targets;
    }

    static async init (server){
        server.get("/ext/splitdonation/targets.json", async (req, res) => {
            res.setHeader("Cache-Control","no-cache");
            res.json(await this.get())
            res.end();
        });
    }
}