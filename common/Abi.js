



export default class Abi{
    static init(abiRoot,reader){
        this.abiRoot=abiRoot;
        this.reader=reader;
        this.cache={};
    }


    static async get(chain,path){
        let chainCache=this.cache[chain];
        if(!chainCache) this.cache[chain]=chainCache={};
        let abi=chainCache[path];
        if(!abi){
            abi=await this.reader(this.abiRoot,path);
            abi=abi["abi"]||(abi["output"]&&abi["output"]["abi"])||abi;
            chainCache[path]=abi;
        }
        return abi;           
    }

}