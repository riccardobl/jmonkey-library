export default class BackendUtils{
    static init(config){
        this.config=config;
    }
    static getIp(req){
        let ip;
        if(this.config.ipInHeader){
            ip=req.headers[ this.config.ipInHeader.toLowerCase()];
        }        
        if(!ip) ip =  req.socket.remoteAddress;
        if(!ip)throw "No ip??";
        if(ip.startsWith("::ffff:"))ip=ip.substring("::ffff:".length);
        return ip;
    }
}