import Nedb from '@seald-io/nedb';
import Path from 'path';
import Fs from 'fs/promises';
import { constants as FsConstants }  from 'fs';
export default  class Database{
    static async setBasePath(path){
        this.basePath=path;
        if(!await Fs.access(this.basePath, FsConstants.F_OK).then(() => true).catch(() => false)){
            await Fs.mkdir( this.basePath, { recursive: true });
        }
    }
    constructor(dbPath){
        const joinedPath=Database.basePath?Path.join(Database.basePath,dbPath):undefined;
        console.log("Load db",joinedPath)
        let options={
            inMemoryOnly:true
        };
        if(joinedPath){
            options.filename=joinedPath;
            options.inMemoryOnly=false;
            options.autoload=true;          
        }
        this.db= new Nedb(options);
        this.expireLoop();
    } 
    // deleteEntry(namespace,uid){
    //     const key={uid:uid,namespace:namespace};

    // }

    async get(namespace,uid,skip,limit,query,filter,sort){
        return new Promise((resolve, reject) => {
            // console.log("Get document with uid",uid,"namespace",namespace);

            const orq=[];
            const andq=[];
            if(query){
                for(let i in query){
                    const k=Object.keys(query[i])[0];
                    const v=query[i][k];
                    // console.log(k,v);
                    const qq={};
                    qq[`data.${k}`]=v;
                    orq.push(qq);

                }
            }

            if(filter){
                for(let i in filter){
                    const k=Object.keys(filter[i])[0];
                    const v=filter[i][k];
                    const qq={};
                    qq[`data.${k}`]=v;
                    andq.push(qq);
                }
            }

            const key={ };


            if(orq.length>0){
                key.$or=orq;
            }

            if(andq.length>0){
                key.$and=andq;
            }
          
            console.log("Query data",JSON.stringify(key));

            if(uid)key["uid"]=uid;
            if(namespace)key["namespace"]=namespace;
            // console.log("User key",key);
            const cursor=this.db.find(key);
            if(sort){
                const ss={};
                for(let k in sort){
                    ss[`data.${k}`]=sort[k];
                }
                cursor.sort(ss);
            }
            
            if(skip)cursor.skip(skip);
            if(limit)cursor.limit(limit);
     
            cursor.exec((err,docs)=>{
                if(err)reject(err);
                // console.log("Found",docs);
                return resolve(docs.map(d=>d.data));
                
                
            });
        });
    }
    async expireLoop(){
        this.db.remove({expire:{$lt:Date.now()}}, { multi: true },(err,docs)=>{
            if(docs&&docs.length>0){
                console.log(`Removed ${docs.length} expired documents: ${docs}`);
            }
        });
        setTimeout(()=>this.expireLoop(),1000);
    }
    async  unset(namespace,uid){
        this.db.remove({namespace:namespace,uid:uid});
    }
    async  set(namespace,uid,entry,expire){
        return new Promise((resolve,reject)=>{
        const dbEntry={
            type:0,
            namespace:namespace,
            uid:uid,
            data:entry,
            timestamp:Date.now(),
            history:[]
        };
        if(expire){
            dbEntry.expire=expire;
        }
        if(!dbEntry.uid||!dbEntry.namespace){
            return reject("Can't set entry "+dbEntry+" uid or namespace undefined");
        }
        const key={type:0,uid:dbEntry.uid,namespace:dbEntry.namespace};
        this.db.findOne(key,(err,docs)=>{
            if(err)console.error(err);
            if(!docs){//||docs.length==0){
                // console.log(`Insert new entry ${JSON.stringify(dbEntry)}`);
                // if(entry.update&&entry.update.value)return console.error("Cant update entries that do not exist");
                this.db.insert(dbEntry);
            }else{
                // console.log(`Update entry ${dbEntry}`);
                // if(!entry.update||!entry.update.value)return console.error("Entry already inserted");
                const doc=docs;
                if(dbEntry.timestamp-doc.timestamp>10000){
                    dbEntry.history.push({
                        timestamp:doc.timestamp,
                        data:JSON.parse(JSON.stringify(doc.data))
                    });
                }
                doc.data=dbEntry.data;
                // for(let k in dbEntry.data){
                //     doc.data[k]=dbEntry.data[k];
                // }            
                dbEntry.data=docs.data;
                this.db.update(key,dbEntry);

            }
            if(expire){
                // console.log(`Mark for expiration`);
                this.db.ensureIndex({fieldName:"expire",sparse:true,unique:false},(err)=>{
                    if(err)console.error(err);
                });
            }
            return resolve();
        });    
     

    });

    }

}
// module.exports=Database;