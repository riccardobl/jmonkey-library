export default class Config{
    static async get(){
        if(!this.config){
            const commonConfig=await fetch("/config.json").then(res=>res.json());
            this.config=commonConfig;
        }
        return this.config;
    }
}