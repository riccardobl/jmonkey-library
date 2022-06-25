
import Fs from 'fs';
import Database from '../Database.js';
import Api from '../../common/Api.js';
import KeysManager from '../KeysManager.js';
import Abi from "../../common/Abi.js";
import Web3 from 'web3';
import LnUrlPay from 'lnurl-pay';
export default  class PaymentManager{
    static init(register,paymentChainsConfig){
        
        // this.config=paymentChainsConfig;
        
        
        // this.web3s={};

        // for(let chain in paymentChainsConfig){
        //     const web3providerUrl=paymentChainsConfig[chain].rpcUrls[0];
        //     let web3provider;
        //     if (web3providerUrl.startsWith("https://")) {
        //         web3provider = new Web3.providers.HttpProvider(web3providerUrl, {
        //             keepAlive: true,
        //             withCredentials: false,
        //         });
        //     } else {
        //         web3provider = new Web3.providers.WebsocketProvider(web3providerUrl, {
        //             clientConfig: {      
        //                 keepalive: true,
        //                 keepaliveInterval: 1000
        //             },
        //             reconnect: {
        //                 auto: true,
        //                 delay: 1000,
        //                 maxAttempts: 999,
        //                 onTimeout: false
        //             }
        //         });
        //     }
        //     if(web3providerUrl){
        //         console.log("Load web3 with provider",web3providerUrl,"for chain",chain);
            
        //         const web3 = new Web3(web3provider);
        //         this.web3s[chain]=web3;
        //     }else{
        //         console.error("Can't load web3 with provider",web3providerUrl,"for chain",chain,". Unsupported provider.");
        //     }
        // }
        

               
        
        // this.db=new Database("payments.json");
        // this.setAddrApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/addr-set.json")));
        // this.addrApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/addr.json")));
        // this.factories={};

        // register("/pay/set-address",this.setAddrApi,this.setAddrApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onSetRequest(d,ip,checkReqPerms));
        // register("/pay/get-address",this.addrApi,this.addrApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onGetRequest(d,ip,checkReqPerms));
        
        this.db=new Database("payinfo.json");
        this.payinfoApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/payinfo.json")));
        this.payinfoGetApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/payinfo-get.json")));
        this.lnInvoiceApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/lninvoice.json")));
        register("/pay/get-payinfo",this.payinfoGetApi,this.payinfoApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onGetPayInfo(d,ip,checkReqPerms));
        register("/pay/set-payinfo",this.payinfoApi,this.payinfoApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onSetPayInfo(d,ip,checkReqPerms));
        register("/pay/ln-invoice",this.lnInvoiceApi,this.lnInvoiceApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onGetInvoice(d,ip,checkReqPerms));

    }




    static async set(userId,lnAddr,paypalId,patreonId){

        let entry=(await this.db.get(userId,userId))[0];
        if(!entry){
            entry={
                userId:userId
            };
        }

        entry["ln-address"]=lnAddr;
        entry["paypal-id"]=paypalId;
        entry["patreon-id"]=patreonId;
        
        entry=await this.payinfoApi.parse("database",entry);
        await this.db.set(entry.userId,entry.userId,entry);
        return entry;
    }

    static async get(userId){        
        const data=(await this.db.get(userId,userId))[0];
        if(!data){
            return {
                userId:userId              
            };
        }
        return data;
    }

    static async generateInvoice(lnAddr,amount){        
        const { invoice, params, successAction } = await LnUrlPay.requestInvoice({
            lnUrlOrAddress:lnAddr,
            tokens: amount, // satoshis
        });
        console.info(invoice,params);
        return {
            invoice:invoice
        };
    }

  
    static async onGetInvoice(data,ip,checkReqPerms){   
        try{
            const amount=data.amountSatoshis    
            const lnAddr=data["ln-address"];
            return await this.generateInvoice(lnAddr,amount);
        }catch(e){
            console.error("Can't generate LN invoice: "+e);
            return {
                error:e+""
            }
        }

    }

    static async onSetPayInfo(data,ip,checkReqPerms){
        const hints=[];
        const canEdit=await KeysManager.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        if(!canEdit) throw new Error("Unauthorized "+data.userId);
        checkReqPerms(hints);
        return this.set(data.userId,data["ln-address"],data["paypal-id"],data["patreon-id"]);      
    }

    static async onGetPayInfo(dataIn,ip,checkReqPerms){
        const data=await this.get(dataIn.userId);     
        return data;    
    }
}
