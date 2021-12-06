
import Fs from 'fs';
import Database from '../Database.js';
import Api from '../../common/Api.js';
import KeysManager from '../KeysManager.js';
import Abi from "../../common/Abi.js";
import Web3 from 'web3';

export default  class PaymentManager{
    static init(register,paymentChainsConfig){
        
        this.config=paymentChainsConfig;
        
        
        this.web3s={};

        for(let chain in paymentChainsConfig){
            const web3providerUrl=paymentChainsConfig[chain].rpcUrls[0];
            let web3provider;
            if (web3providerUrl.startsWith("https://")) {
                web3provider = new Web3.providers.HttpProvider(web3providerUrl, {
                    keepAlive: true,
                    withCredentials: false,
                });
            } else {
                web3provider = new Web3.providers.WebsocketProvider(web3providerUrl, {
                    clientConfig: {      
                        keepalive: true,
                        keepaliveInterval: 1000
                    },
                    reconnect: {
                        auto: true,
                        delay: 1000,
                        maxAttempts: 999,
                        onTimeout: false
                    }
                });
            }
            if(web3providerUrl){
                console.log("Load web3 with provider",web3providerUrl,"for chain",chain);
            
                const web3 = new Web3(web3provider);
                this.web3s[chain]=web3;
            }else{
                console.error("Can't load web3 with provider",web3providerUrl,"for chain",chain,". Unsupported provider.");
            }
        }
        

               
        
        this.db=new Database("payments.json");
        this.setAddrApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/addr-set.json")));
        this.addrApi=new Api(JSON.parse(Fs.readFileSync("./common/messages/pay/addr.json")));
        this.factories={};

        register("/pay/set-address",this.setAddrApi,this.setAddrApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onSetRequest(d,ip,checkReqPerms));
        register("/pay/get-address",this.addrApi,this.addrApi,(d,ip,checkReqPerms,checkRespPerms)=>this.onGetRequest(d,ip,checkReqPerms));
        
             
        
    }


    static async getContract(chain,addr,abi){
        const web3=this.getWeb3(chain);
        return new web3.eth.Contract(abi,addr);
    }

    static async getFactory(chain){
        if(!this.factories[chain]){
            const config=this.config[chain];
            if(!config)throw new Error("Unsupported blockchain.");
            const addr=config.factoryContract.addr;
            const abi=await Abi.get(config.factoryContract.abi);
            this.factories[chain]=await this.getContract(chain,addr,abi);
        }
        return this.factories[chain];
    }

    static async getSellerContract(chain,sellerAddr,sellerId){
        const config=this.config[chain];
        if(!config)throw new Error("Unsupported blockchain.");
        const abi=await Abi.get(config.sellerContract.abi);

        const factory=await this.getFactory(chain);
        const addr=await factory.methods.getContractAddr(sellerAddr,sellerId).call();
        const contract=await this.getContract(chain,abi,addr);
        return contract;
    }

    static getWeb3(chain){
        const web3= this.web3s[chain];
        if(!web3)throw new Error("Unsupported chain!");
        return web3;
    }

    static async getAddress(chain,signature){
        const message="Address Authentication";
        const web3=this.getWeb3(chain);
        // const messageHash=web3.utils.sha3(message);
        return web3.eth.accounts.recover(message,signature);
    }
    
    static async checkPaymentStatus(sellerAddr,userId,entryId,buyedSignature){
        for(let chain in this.config){
            const buyerAddr=await this.getAddress(chain,buyedSignature);
            const contract=await this.getSellerContract(chain,sellerAddr,userId);
            const status=contract.methods.checkPurchaseProof(entryId,buyerAddr).call();
            if(status)return true;
        }
        return false;      
    }


    static async set(userId,blockchain,signature){
        if(!this.config[blockchain])throw new Error("Unsupported blockchain "+blockchain);
        const addr=await this.getAddress(blockchain,signature);

        let entry=(await this.db.get(userId,blockchain))[0];
        if(!entry){
            entry={
                userId:userId,
                blockchain:blockchain,
                addresses:[]
            };
        }

        entry.addresses=entry.addresses.filter(caddr=>caddr!=addr);
        entry.addresses.unshift(addr);

        entry=await this.addrApi.parse("database",entry);
        await this.db.set(entry.userId,entry.blockchain,entry);
        return {};
    }

    static async get(userId,blockchain){        
        const data=(await this.db.get(userId,blockchain))[0];
        if(!data){
            return {
                userId:userId,
                blockchain:blockchain,
                addresses:[]
            };
        }
        return data;
    }


    static async onSetRequest(data,ip,checkReqPerms){
        const hints=[];
        const canEdit=await KeysManager.canEdit(undefined,data.userId,data.authId,data.authKey,ip,hints);
        if(!canEdit) throw new Error("Unauthorized");
        checkReqPerms(hints);
        return this.set(data.userId,data.blockchain,data.signature);      
    }

    static async onGetRequest(dataIn,ip,checkReqPerms){
        const data=await this.get(dataIn.userId,dataIn.blockchain);     
        return data;    
    }
}
