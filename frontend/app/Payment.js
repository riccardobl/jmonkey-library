
import Auth from "./Auth.js";
import Msg from "./Msg.js";

import Api from "/common/Api.js";

export default class Payment {
    static init(){

    }

    static async getLnInvoice(addr,amountSats) {
        
        const lnInvoiceApi =  await this.getLnInvoiceApi();

        const msg = await lnInvoiceApi.parse("request", {
            "ln-address":addr,
            amountSatoshis:amountSats 
        });

        let res = await fetch("/pay/ln-invoice", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());

        res = await lnInvoiceApi.parse("response", res);
        if (res.error) throw res.error;

        return res.invoice;
    }

   
    static async getLnInvoiceApi(){
        return  new Api(await Msg.getDef("pay/lninvoice"));
    }

    static async getInfo(userId) {
        const payinfoGetApi = new Api(await Msg.getDef("pay/payinfo-get"));
        const payinfoApi =  new Api(await Msg.getDef("pay/payinfo"));

        const msg = await payinfoGetApi.parse("request", Auth.sign({ 
        }, userId));

        let res = await fetch("/pay/get-payinfo", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());

        res = await payinfoApi.parse("response", res);
        if (res.error) throw res.error;

        return res;
    }

    static async setInfo(userId,lnAddr,paypalId,patreonId, githubId) {
        const payinfoApi =  new Api(await Msg.getDef("pay/payinfo"));

        const msg =await payinfoApi.parse("request",  Auth.sign({ 
            "ln-address":lnAddr,
            "paypal-id":paypalId,
            "patreon-id":patreonId,
            "github-id":githubId
        }, userId));

        let res = await fetch("/pay/set-payinfo", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());

        res = await payinfoApi.parse("response", res);
        if (res.error) throw res.error;
        return res;
    }
}