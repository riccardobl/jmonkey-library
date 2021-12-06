export default {
    get: (key) => {
        let item;
        // if(sessionStorage){
        //     item=sessionStorage[key];
        // }
        // if(!item){
        item = localStorage[key];
        // }
        console.log("Get", key, item);
        try {
            if (item) item = JSON.parse(item);

            if (item && (!item.expire || item.expire > Date.now())) return item.value;
        } catch (e) {
            console.log(e);
        }
        return undefined;
    },
    set: (key, v, expire) => {
        const data = v ? {
            value: v,
            expire: expire
        } : undefined;
        // let done=false;
        // if(!data||(session&&sessionStorage)){
        //     sessionStorage.setItem(key,data);
        //     if(data)done=true;
        // }
        // if(!done){
        console.log("Set", key, data);
        localStorage.setItem(key, data ? JSON.stringify(data) : undefined);
        // }
    }
}
