
import Fs from 'fs';
import Database from '../Database.js';
import Api from '../../common/Api.js';
import KeysManager from '../KeysManager.js';
import Abi from "../../common/Abi.js";
import Web3 from 'web3';
import LnUrlPay from 'lnurl-pay';
export default  class PaymentManager{
    static init(register){

        this.db=new Database("payinfo.json");
        this.payinfoApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/payinfo.json")));
        this.payinfoGetApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/payinfo-get.json")));
        this.lnInvoiceApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/lninvoice.json")));
        register("/pay/get-payinfo",this.payinfoGetApi,this.payinfoApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onGetPayInfo(d,ip,checkReqPerms));
        register("/pay/set-payinfo",this.payinfoApi,this.payinfoApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onSetPayInfo(d,ip,checkReqPerms));
        register("/pay/ln-invoice",this.lnInvoiceApi,this.lnInvoiceApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onGetInvoice(d,ip,checkReqPerms));

    }




    static async set(userId,lnAddr,paypalId,patreonId,githubId){

        let entry=(await this.db.get(userId,userId))[0];
        if(!entry){
            entry={
                userId:userId
            };
        }

        entry["ln-address"]=lnAddr;
        entry["paypal-id"]=paypalId;
        entry["patreon-id"]=patreonId;
        entry["github-id"]=githubId;
        
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
        console.info("Generate invoice for "+lnAddr+" for "+amount+" satoshis");   
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
        return this.set(data.userId,data["ln-address"],data["paypal-id"],data["patreon-id"],data["github-id"]);      
    }

    static async onGetPayInfo(dataIn,ip,checkReqPerms){
        const data=await this.get(dataIn.userId);     
        return data;    
    }
}
