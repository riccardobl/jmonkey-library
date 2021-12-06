let crypto;
let marked;
let fetch;
let DOMPurify ;


export default class Utils {
    static  init(_crypto,_marked,_fetch,_DOMPurify){
        crypto=_crypto;
        marked=_marked;
        fetch=_fetch;
        DOMPurify=_DOMPurify; 

        this.loadingQueue=[];
        const loadNext=async ()=>{
            if(this.loadingQueue.length>0) {
                try{
                    const action=this.loadingQueue.shift();
                    await action();
                }catch(e){
                    console.error(e);
                }
            } 
            setTimeout(loadNext,100);
        };
        loadNext();
        

    }

    static enqueue(action){
        this.loadingQueue.push(action);
    }
    static uuidv4() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }


    static setCookie(cname, cvalue, exdays) {
        const d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    }

    static getCookie(cname) {
        let name = cname + "=";
        let decodedCookie = decodeURIComponent(document.cookie);
        let ca = decodedCookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1);
            }
            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    }

    static setLocalData(key,value){
        if(typeof value=="undefined"){
            localStorage.removeItem(key);
        }else{
            localStorage.setItem(key,JSON.stringify(value));
        }
        // console.log("Set data",key,value);
        // this.getLocalData(key);
        // console.trace();
    }

    static getLocalData(key){
        const value=localStorage.getItem(key);
        // console.log("Get data",key,value);
        return value?JSON.parse(value):undefined;
    }

    static async multipageFetch(uri, req, limit, callback) {
        if (!limit) limit = 50;
        let page = -1;
        while (true) {
            page++;
            req.page = page;
            req.limit = limit;
            const res = await fetch(uri, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(req),
            }).then(r => r.json());
            if (!await callback(res)) break;
        }
    }
    static renderMarkdown(text) {
        console.log(text);
        text = marked.parse(text);
        return this.sanitize(text,{html:true});
    }

    static getSummary(text,length){
        // text=this.renderMarkdown(text);
        text=this.sanitize(text,{
            html:false
        });
        return text.substring(0,length||150)+"...";
    }
    static sanitize(text, mode) {
        const html = mode.html;
        if (typeof html != "undefined") {
            if (!html) {
                text = DOMPurify.sanitize(text, { USE_PROFILES: { html: false } });
            } else {
                text = DOMPurify.sanitize(text, { 
                    ALLOWED_TAGS: [
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 
                        'br', 'b', 'i', 'strong', 'em', 'a', 'pre', 'code', 'img', 'div', 'ins', 
                        'del', 'sup', 'sub', 'p', 'ol', 'ul', 'table', 'thead', 'tbody', 
                        'tfoot', 'blockquote', 'dl', 'dt', 'dd',  'q', 'samp', 'var', 'hr', ,  'li', 'tr',
                        'td', 'th', 's', 'strike', 'summary', 'details'
                    ],
                    ALLOWED_ATTR: ["class","tabindex",'href','src','alt','type','height','width','controls','lang']
                } );
            }
        }
        return text.trim();
    }

    static clone(data){
        return JSON.parse(JSON.stringify(data));
    }

    // FIXME: This is broken JSDOM won't preserve attribute order.
    // static checkString(text, options) {
    //     const filter = options.filter;
    //     if (filter) {
    //         if (!new RegExp("^" + filter + "$").test(text)) {
    //             console.trace();
    //             throw "Invalid string. "+text+" Filtered by " + filter;
    //         }
    //     }

    //     text=text.trim();
    //     // const html = options.html;
    //     let newText,newText2;
            
    //     newText = this.sanitize(text, options);
  
    //     if (newText != text
    //     ) {
    //         throw new Error("Invalid string. Contains blacklisted html. With filter"+JSON.stringify(options));
    //     }
        

    //     return true;
    // }
}

