
export default class UrlParams {

    static lockPage(msg,callback){
        this.pageLock={
            msg:msg,
            callback:callback,
        };
    }

    static unlockPage(){
        this.pageLock=null;
    }

    static init() {
        this.params={};
        this.onHashChange = [];
        this.silent = false;
        this.parse();
        window.addEventListener("hashchange",  async ()=> {
            if(this.pageLock) {
                
                const res=confirm(this.pageLock.msg);
                if(this.pageLock.callback) {
                    if(!this.pageLock.callback(res))return;
                }else{
                    if(!res)return;
                }                 
                this.unlockPage();
            }

            if (this.silent) {
                this.silent = false;
                return;
            }
            this.parse();
            this.onHashChange.forEach(l => l());
        });

    }

    static addListener(l) {
        this.onHashChange.push(l);
    }


    static parse() {
        if (!window.location.hash) return {};

        this.params = {};
        let parts = window.location.hash.split("!");
        this.anchor=parts[0];
        parts = parts[1];
        parts = parts ? parts.split("&") : [];
        parts.forEach(p => {
            const [k, v] = p.split("=");
            this.params[decodeURIComponent(k)]=decodeURIComponent(v ? v : "");
        });
    }



    static recomputeHash() {
        let hash = this.anchor||"";
        if (!hash.startsWith("#")) hash = "#"+hash;

        let hash2 = "";
        for (let k in this.params) {
            if (hash2 != "") hash2 += "&";
            hash2 += encodeURIComponent(k) + "=" +encodeURIComponent(this.params[k]);
        }
        console.log(hash,hash2);
        hash += "!" + hash2;
        
        window.location.hash = hash;
    }

    static getAnchor() {
        return this.anchor;
    }

    static setAnchor(v, silent) {
        console.log("Set anchor",v);
        if (this.anchor != v) {
            this.silent = this.silent || silent;
            this.anchor = v;
            this.recomputeHash();
        }
    }

    static get(k) {
        return this.params[k];
    }

    static replace(kv,silent) {
        this.params={};
        this.set(kv,silent);
    }

    static set(kv, silent) {
        let changed = false;
        for (let k in kv) {
            const v = kv[k];
            console.log("Set ",k,v);

            if (this.params[k] != v) {
                this.params[k] = v;
                changed = true;
            }
        }
        if (changed) {
            this.silent = this.silent || silent;
            this.recomputeHash();
        }
    }


}