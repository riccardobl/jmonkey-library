
import Utils from "/common/Utils.js";
import Msg from "./Msg.js";
import Storage from "./Storage.js";
import Api from "/common/Api.js";
import Ui from "./ui/ui.js";

export default class Auth {
    static getCurrentKey() {
        return Utils.getCookie("authKey").trim();
    }

    static getCurrentUserID() {
        return Utils.getCookie("authUserId").trim();
    }

    static getCurrentKeyID() {
        return Utils.getCookie("authKeyId").trim();
    }

    static isCurrentUserMod() {
        return Utils.getCookie("authIsMod").trim() == "true";

    }


    /**
     * Sign a request
     * @param {*} req Object containing the request
     * @param {*} onBehalfOf if defined the request will be signed on behalf of the user id specified in this field. Only mods can do that.
     * @returns 
     */
    static sign(req, onBehalfOf) {
        req.authKey = this.getCurrentKey();
        req.authId = this.getCurrentKeyID();
        if ( onBehalfOf&&onBehalfOf != this.getCurrentUserID()) {
            req.userId = onBehalfOf;
            if(this.isCurrentUserMod())req.modId = this.getCurrentUserID();
        } else {
            req.userId = this.getCurrentUserID();
        }
        return req;
    }

    /**
     * Initialize login
     * @returns 
     */
    static async login() {
        const loggedIn = await Auth.isLoggedIn();
        if (loggedIn) {
            console.log("Logged In!");
            return true;
        } else {
            console.log("Not logged!");
            window.location.href = "/auth_request";
        }
        return false;
    }

    /**
   * Logout and delete all cookies
   * @returns 
   */
    static async logout() {
        await this.deleteKey(this.getCurrentKeyID());
        Utils.setCookie("authUserId", undefined);
        Utils.setCookie("authKeyId", undefined);
        Utils.setCookie("authIsMod", undefined);
        Utils.setCookie("authKey", undefined);
    }

    /**
       * Check if current user is logged in with a valid key
       * @returns 
       */
    static async isLoggedIn() {
        try {
            const checkCredentialApi = new Api(await Msg.getDef("key/key-check"));
            const msg=this.sign({});
            console.log(msg);
            const req = await checkCredentialApi.parse("request", msg, false);
            let res = await fetch("/key/check", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(req),
            }).then(r => r.json());
            res = await checkCredentialApi.parse("response", res);
            if (res.error) throw res.error;
            return res.valid;

        } catch (e) {
            console.error(e);
            return false;
        }
    }

    /**
   * Extends duration of the current key if it is a temporary key
   * @returns 
   */
    static async keepKeyAlive() {
        const keepAliveApi = new Api(await Msg.getDef("key/key-keepalive"));
        const msg = await keepAliveApi.parse("request", this.sign({}));
        let res = await fetch("/key/key-keepalive", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());
        if (res.error) throw res.error;
    }


    static async getAllKeys() {
        const out = [];
        const keyListApi = new Api(await Msg.getDef("key/key-list"));
        const keyApi = new Api(await Msg.getDef("key/key-get"));
        const listReq = await keyListApi.parse("request", this.sign({}), false);
        await Utils.multipageFetch('/key/list', listReq, 10, async (res) => {
            if (res.keyId.length == 0) return false;
            for (let i in res.keyId) {
                const uid = res.keyId[i];
                console.log("Fetch", uid);
                const credentialReq = await keyApi.parse("request", this.sign({ keyId: uid }), false);
                let res2 = await fetch('/key/get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify(credentialReq),
                }).then(r => r.json());
                res2 = await keyApi.parse("response", res2);
                if (res2.error) throw res2.error;

                out.push(res2);
            }
        });
        return out;
    }

    static async setKey(entry) {
        console.log("Update", entry);
        const keyApi = new Api(await Msg.getDef("key/key-set"));
        const msg = await keyApi.parse("request", this.sign(entry));
        let res = await fetch("/key/add", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());
        if (res.error) throw res.error;

        if (entry.keyId == this.getCurrentKeyID()) {
            Utils.setCookie("authKey", entry.key);
        }
        return res;
    }

    static async getUser(userId) {
        const userNameApi = new Api(await Msg.getDef("user/user"));
        const msg = await userNameApi.parse("request", { userId: userId });
        let res = await fetch("/user/get", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());
        console.log(res);
        if (res.error) throw res.error;
        console.log(res);
        return res;

    }

    static async deleteKey(keyId) {
        console.log("Delete", keyId);
        const keyDeleteApi = new Api(await Msg.getDef("key/key-delete"));
        const msg = await keyDeleteApi.parse("request", this.sign({ keyId: keyId }));
        let res = await fetch("/key/delete", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(msg),
        }).then(r => r.json());
        if (res.error) throw res.error;

        if (res.keyId == this.getCurrentKeyID()) {
            Utils.setCookie("authKey", undefined);
        }

    }



}