
import GithubImporter from './GithubImporter.js';
import StoreImporter from './StoreImporter.js';

const IMPORTERS=[
    StoreImporter,
    GithubImporter
]
export default class AutoImporter{
    static async initApi(register){
        for(let i in IMPORTERS){
            await IMPORTERS[i].initApi(register);
        }
        
    }

    static async import(url,token){
        let data=undefined;
        for(let i in IMPORTERS){
            try{
                data=await IMPORTERS[i].cliCall(url,token);
                break;
            }catch(e){
                console.log(e);
            }
        }
        if(!data)throw new Error("Importer not found!");

    }
    
}

async function  main(){
        const data=await AutoImporter.import(url);

}

// if (require.main === module) {
//     main();
// }
