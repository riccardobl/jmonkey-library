import Utils from "/common/Utils.js";
const API_VERSION=1.4;
export default class Msg {
    // static setApiVersion(v){
    //     this.v=v;
    // }
    static async getDef(name) {
        const key=`api-${name}`;
        let content;
        try{
            content = localStorage.getItem(key);
            console.log(content);
            if(content){
                const cache = JSON.parse(content);
                if(cache.v!=API_VERSION)throw "Old cache.";
                if(!cache.content)throw "Invalid cache.";
                return cache.content;
            }
        }catch(e){
            console.warn(e);
        }
        content=await fetch("/common/messages/" + name + ".json").then(r => r.json());
        localStorage.setItem(key, JSON.stringify({
            v:this.v,
            content:content
        }));

        return content;
    }



}