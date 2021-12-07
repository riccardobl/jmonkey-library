
import Utils from "../../common/Utils.js";
import Auth from "./Auth.js";
import Msg from "./Msg.js";
import Tasks from "./ui/Tasks.js";
import Ui from "./ui/ui.js";
import Abi from "/common/Abi.js";
import Api from "/common/Api.js";

export default class Payment {
    static init(config) {
        this.config = config;
        // this.keyMng = keyMng;
        this.userAddressesCache={};
        this.factory={};
        this.web3={};
        if(window.ethereum){
            window.ethereum.on('accountsChanged', function (accounts) {
                location.reload(); 
            });
        }
        const processTransactions=async ()=>{
            // console.log("Process transactions");
            // if(!this.currentChain )return;
            
            const tasks=Tasks.getTasks();
            for(let k in tasks){
                const task=tasks[k];
                const data=task.data;
                // console.log(task);
                if(!data||!data.transactionHash)continue;
                const hash=data.transactionHash;
                const chain=data.chain;
                await this._setChain(chain)
                // const cnt=async()=>{
                    const web3=await this.getWeb3();
                    const receipt=await web3.eth.getTransactionReceipt(hash);
                    if(receipt){
                        Tasks.ok(k,"Transaction completed");

                        // Ui.waitTask(k,false);
                        // Ui.waitTask(k+"ok","Transaction completed",{},false,false,1);
                    }
                // }
                // if(!){
                //     Ui.showDialog("Chain change",`
                //         We have detected a pending transaction, we will instruct your metamask extension to
                //         connect to the appropriate chain to detect its completion state.
                //     `,[{
                //         text:"Ok",
                //         action:async()=>{
                //             await this._setChain(chain);
                //             await cnt();
                //         }
                //     }]);
                // }  else{
                    // await cnt();
                // }
                break;
            }



           
            setTimeout(processTransactions,1000);
        };
        processTransactions();
        // this.web3RO={};
        // const paymentChainsConfig=config
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
        //         web3.eth.handleRevert = true;
        //         this.web3RO[chain]=web3;
        //     }else{
        //         console.error("Can't load web3 with provider",web3providerUrl,"for chain",chain,". Unsupported provider.");
        //     }
        // }
        
    }

    static async _setChain(chain) {
        this.currentChain = chain;
        const paymentConfig = this.config[chain];
        if (!paymentConfig) throw new Error("Unsupported blockchain "+chain);

        try {
            await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: paymentConfig.chainId }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                try {
                    await ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [paymentConfig]
                    });
                } catch (addError) {
                    console.error(addError);
                }
            }

        }
        return    await ethereum.request({
            method: 'eth_requestAccounts',
        });
    }

    static async fromHumanValue(v,chain){
        return (await this.getWeb3(chain)).utils.toWei(""+v);
    }


    static async toHumanValue(v,chain){
        const vv= (await this.getWeb3(chain)).utils.fromWei(typeof v=="number"?""+v:v);
        return vv;
    }

    /**
     * Get a cryptographic proof of the account ownership
     * @param {*} address 
     * @returns 
     */
    static async getProof(address) {
        const message = "Address Authentication";
        // const messageHash=(await this.getWeb3()).utils.sha3(message);
        const request = { method: "personal_sign", params: [message, address] };
        const signature = await window.ethereum.request(request);
        return signature;
    }


    /**
     * Connect the current metamask address as main address
     * @returns 
     */
    static async reconnectAddress(chain) {
        await this._setChain(chain);
        if (!this.currentChain) throw new Error("Chain unset.");
        await window.ethereum.request({
            method: "wallet_requestPermissions",
            params: [
                {
                    eth_accounts: {}
                }
            ]
        });
        let addr = await window.ethereum.request({
            method: "eth_requestAccounts",
            params: [
                {
                    eth_accounts: {}
                }
            ]
        });
        addr=addr[0];
        console.log("Connect addr",addr);
        const addrSetApi = new Api(await Msg.getDef("pay/addr-set"));

        let req = Auth.sign({
            blockchain: this.currentChain,
            signature: await this.getProof(addr)
        });


        req = await addrSetApi.parse("request", req);
        let res = await fetch("/pay/set-address", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(req),
        }).then(r => r.json());
        if (res.error) throw res.error;
        this.userAddressesCache={};
        return addr;
    }

    /**
     * Get all the addresses stored in the database for the specified user id.
     * The first value of the array is the current address.
     * @param {*} userId 
     * @param {*} chain 
     * @returns 
     */
    static async getAddresses(userId,chain) {
        if(!chain)chain=this.currentChain;
        if(!chain)throw new Error("Blockchain not set.");
        
        if(this.userAddressesCache[userId])return this.userAddressesCache[userId];

        let req = Auth.sign({
            blockchain: chain
        },userId);

        let res = await fetch("/pay/get-address", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(req),
        }).then(r => r.json());

        if (res.error) throw res.error;
        this.userAddressesCache[userId]=res.addresses;
        return res.addresses;
    }



    /**
     * Get web3 instance that uses metamask as provider
     * @param {*} chain 
     * @returns 
     */
    static async getWeb3(chain,silent) {
        if(!chain)chain=this.currentChain;
        if (!chain) throw new Error("Chain unset.");

        if (this.web3[chain]) return this.web3[chain];
        if(!silent)await window.ethereum.send('eth_requestAccounts');
        this.web3[chain] = new Web3(window.ethereum);
        this.web3[chain].eth.handleRevert = true;
        return this.web3[chain];
    }


    /**
     * Obtain smart contract instance from given address
     * @param {*} addr 
     * @param {*} abi 
     * @param {*} chain 
     * @returns 
     */
    static async getContract(addr, abi,chain) {
        if(!chain)chain=this.currentChain;
        if (!chain) throw new Error("Chain unset.");
        const web3 = await this.getWeb3(chain);
        return new web3.eth.Contract(abi, addr);
    }

    /**
     * Get contract factory of the specified blockchain
     * @param {*} chain 
     * @returns 
     */
    static async getFactory(chain) {
        if(!chain)chain=this.currentChain;
        if (!chain) throw new Error("Chain unset.");

        if (!this.factory[chain]) {
            const addr = this.config[chain].factoryContract.addr;
            const abi = await Abi.get(chain,this.config[chain].factoryContract.abi);
            console.log(abi);
            this.factory[chain] = await this.getContract(addr, abi,chain);
        }
        return this.factory[chain];
    }


    /**
     * Get balance of seller contract associated to this address and id
     * @param {*} sellerAddr 
     * @param {*} sellerId 
     * @param {*} chain 
     * @returns 
     */
    static async getSellerContractBalance(sellerAddr, sellerId,chain) {
        const web3=await this.getWeb3(chain);

        const out={
            locked:web3.utils.toBN(0),
            available:web3.utils.toBN(0),
            total:web3.utils.toBN(0)
        }
        if(!chain)chain=this.currentChain;
        if (!chain) throw new Error("Chain unset.")
        const contract = await this.getSellerContract(sellerAddr,sellerId,chain);
        const np=await this.read(contract.methods.countPurchases());
        console.log("Found",np,"purchases... parsing...");
        for(let id=1;id<=np;id++){
            try{
                if(!await this.read(contract.methods.isValidPurchase(id)))continue;
                const refundable=await this.read(contract.methods.isRefundable(id));
                const withdradable=await this.read(contract.methods.isWithdrawPending(id));
                const price=web3.utils.toBN(await this.read(contract.methods.getPurchasePrice(id)));
                if(refundable){
                    out.locked=out.locked.add(price);
                }else if(withdradable){
                    out.available=out.available.add(price);
                }else{
                    out.total=out.total.add(price);
                }           
            }catch(e){
                console.log(e);
            }
        }
        return out;
    }

    static async getCurrentLocalWalletAddr(chain){
        if(!this.isMetamaskEnabled())return undefined;
        const web3=await this.getWeb3(chain,true);
        const accounts = await web3.eth.getAccounts();
        if(accounts==0)return undefined;
        const currentAddr= accounts[0];
        return currentAddr;
    }

    static async isCurrentWalletConnected(chain){
        if(!this.isMetamaskEnabled())return false;
        try{
            const addrs=await this.getAddresses(Auth.getCurrentUserID(),chain);
            const lastAddr=addrs[0];        
            const currentAddr= await this.getCurrentLocalWalletAddr(chain);
            return currentAddr&&lastAddr==currentAddr;
        }catch(e){
            return false;
        }
    }

    static isMetamaskEnabled(){
        const { ethereum } = window;
        return Boolean(ethereum && ethereum.isMetaMask);
    }

    /**
     * Create seller contract for this user
     * @param {*} chain 
     */
    static async createSellerContract(chain){
        await this._setChain(chain);
        if(!chain)chain=this.currentChain;
        if (!chain) throw new Error("Chain unset.")
        // const abi = await Abi.get(chain,this.config[chain].sellerContract.abi);
        const factory = await this.getFactory(chain);
        await this.transact(factory.methods.createContract(Auth.getCurrentUserID()));
    }


    /**
     * Get seller contract associated with this addr and user id on the specified blockchain
     * @param {*} sellerAddr 
     * @param {*} sellerId 
     * @param {*} chain 
     * @returns 
     */
    static async getSellerContract(sellerAddr, sellerId, chain) {
        if(!chain)chain=this.currentChain;
        if (!chain) throw new Error("Chain unset.")

        const abi = await Abi.get(chain,this.config[chain].sellerContract.abi);
        const factory = await this.getFactory(chain);
        const addr = await this.read(factory.methods.getContractAddr(sellerAddr, sellerId));
        if((await this.getWeb3(chain)).utils.toBN(addr).eqn(0))return undefined;
         const contract = await this.getContract( addr,abi,chain);
        return contract;

    }


    // /**
    //  * Get all the contracts asociated to the specified userId and multiple addresses on the specified chain
    //  * @param {*} addrs List of addresses
    //  * @param {*} userId 
    //  * @param {*} chain 
    //  * @returns 
    //  */
    // static async getSellerContracts(addrs,userId,chain) {
    //     if(!chain)chain=this.currentChain;
    //     if (!chain) throw new Error("Chain unset.")
    //     // const addrs = await this.getAddresses(userId?userId:Auth.getCurrentUserID(),chain);
    //     const contracts = [];
    //     for (let i in addrs) {
    //         const addr = addrs[i];
    //         const contract = await this.getSellerContract(addr, userId,chain);
    //         contracts.push(contract);
    //     }
    //     return contracts;
    // }

    /**
     * Sell something
     * @param {*} entryId 
     * @param {*} price 
     */
    static async sell(entryId,price,message,chain){
        if(price<=1)throw new Error("Can't sell for nothing. Price must be >1");
        await this._setChain(chain);

        const addr=(await this.getAddresses(Auth.getCurrentUserID(),chain))[0];
        
        const contract=await this.getSellerContract(addr,Auth.getCurrentUserID(),chain);

              
        await this.transact(contract.methods.setEntry(entryId,price,true,message));
        

    }

    /**
     * Disable selling of something
     * @param {*} entryId 
     */
    static async unsell(entryId,chain){
        await this._setChain(chain);

        const addr=(await this.getAddresses(Auth.getCurrentUserID(),chain))[0];
        const contract=await this.getSellerContract(addr,Auth.getCurrentUserID(),chain);

        const currentPrice=await this.getPrice(Auth.getCurrentUserID(),entryId,chain);
        const currentMessage=await this.getMessage(Auth.getCurrentUserID(),entryId,chain);
        if(currentPrice&&currentMessage){
            await this.transact( contract.methods.setEntry(entryId,currentPrice,false,currentMessage));
        }
    }

    static async isSellerContractEnabled(sellerAddr,sellerId,chain){
        if(!sellerAddr)return false;
        if(!chain)throw new Error("Blockchain not specified");
        const contract=await this.getSellerContract(sellerAddr,sellerId,chain);
        if(!contract)return false;
        // const addrs=await this.getAddresses(userId,chain);
        // const currentAddr=addrs[0];
        // const contract=await this.getSellerContract(currentAddr,userId,chain);
        return await this.read(contract.methods.isContractActive());
    }


    static async setSellerContractEnabled(v,sellerAddr,sellerId,chain){
        await this._setChain(chain);
        if(!chain)throw new Error("Blockchain not specified");
        const contract=await this.getSellerContract(sellerAddr,sellerId,chain);
        // const addrs=await this.getAddresses(userId,chain);
        // const currentAddr=addrs[0];
        // const contract=await this.getSellerContract(currentAddr,userId,chain);
        return await this.transact(contract.methods.setContractActive(v),undefined,sellerAddr);
    }


    /**
     * Get price of something that is being sold
     * @param {*} userId 
     * @param {*} entryId 
     * @param {*} chain 
     * @returns 
     */
    static async getPrice(userId,entryId,chain){
        
        const addrs=await this.getAddresses(userId,chain);
        const sellerAddr=addrs[0];
        if(!sellerAddr)return undefined;
            if(!await this.isSellerContractEnabled(sellerAddr,userId,chain)) return undefined;
       
        const contract=await this.getSellerContract(sellerAddr,userId,chain);

        if(!await this.read(contract.methods.isEntryBuyable(entryId)))return undefined;
        
        const currentPrice=await this.read(contract.methods.getEntryPrice(entryId));
        if(currentPrice<=1)throw new Error("Invalid price");

        return currentPrice;
    }


    static async getMessage(userId,entryId,chain){
        const addrs=await this.getAddresses(userId,chain);
        const sellerAddr=addrs[0];
        if(!sellerAddr)return undefined;

        if(!await this.isSellerContractEnabled(sellerAddr,userId,chain)) return undefined;

        const contract=await this.getSellerContract(sellerAddr,userId,chain);

        if(!await this.read(contract.methods.isEntryBuyable(entryId)))return undefined;
        
        let msg=await this.read(contract.methods.getEntryMessage(entryId));
        msg=Utils.sanitize(msg,{html:false});

        return msg;
    }





    static async _forFirstSellerContract(sellerId,chain,action){
        const addrs=await this.getAddresses(sellerId,chain);
        for(let i in addrs){
            const sellerAddr=addrs[i];       
 
            const contract=await this.getSellerContract(sellerAddr,sellerId,chain);
            try{
                const v=await action(contract);
                return v;
            }catch(e){

            }
        }
        return undefined;
    }

    static async getPurchasePrice(sellerId,purchaseId,chain){
        return await this._forFirstSellerContract(sellerId,chain,async (contract)=>{
            return this.read(contract.methods.getPurchasePrice(purchaseId));
        });       
    }

    static async getPurchaseMessage(sellerId,purchaseId,chain){
        return await this._forFirstSellerContract(sellerId,chain,async (contract)=>{
            return this.read(contract.methods.getPurchaseMessage(purchaseId));
        });  
       
    }

    static async isPurchaseRefundable(sellerId,purchaseId,chain){
        return await this._forFirstSellerContract(sellerId,chain,async (contract)=>{
            return this.read(contract.methods.isRefundable(purchaseId));
        });  

    }

    static async getPurchaseId(sellerId,entryId,buyerId,chain){
        const buyerAddrs=await this.getAddresses(buyerId,chain);
        return await this._forFirstSellerContract(sellerId,chain,async (contract)=>{
            for(let i in buyerAddrs){
                const addr=buyerAddrs[i];
                try{
                    const id= await this.read(contract.methods.getPurchaseId(entryId,addr));
                    if(id>0)return id;
                }catch{

                }
            }
            return undefined;
        });  
       
    }


    static async withdraw(sellerAddr,sellerUserId,chain){
        await this._setChain(chain);
        const contract=await this.getSellerContract(sellerAddr,sellerUserId,chain);
        const np=await this.read(contract.methods.countPurchases());
        const purchasIds=[];
        for(let i = 1;i<=np;i++){
            if(
                await this.read(contract.methods.isValidPurchase(i))
                &&await this.read(contract.methods.isWithdrawable(i))
            ){
                purchasIds.push(i);
            }
        }
        await this.transact(contract.methods.batchWithdraw(purchasIds));
    }

    static async buy(userId,entryId,chain){

        await this._setChain(chain);

        const addr=(await this.getAddresses(Auth.getCurrentUserID(),chain))[0];

        const contract=await this.getSellerContract(addr,Auth.getCurrentUserID(),chain);

        const price=await this.getPrice(userId,entryId,chain);
        if(!price)throw new Error("Entry is not priced correctly or doesn't exist");
        let putchaseId=await this.getPurchaseId(userId,entryId,Auth.getCurrentUserID(),chain);
        if(putchaseId)throw new Error("Already bought.");
        // purchaseId=await contract.methods.buy(entryId,Auth.getCurrentUserID()).send({
            
        // });
        purchaseId= await this.transact(contract.methods.buy(entryId,Auth.getCurrentUserID()),price);

        return purchaseId;
    }

    static async read(method){
        console.log("Calling",method)
        return  method.call(); 
    }

    static async transact(method,value,from){
        const data={
            from:from?from:((await this.getAddresses())[0]        )    ,
            value:value
        };
        data.gas= await method.estimateGas(data);        
        const tr=method.send(data); 
        Tasks.completable("sendTransaction","Submitting transaction")

        tr.once('error',(error)=>{
            Tasks.error("sendTransaction",`Transaction failed
            <sub>
            ${(error+"").substring(100)}
            </sub>`);

            // Ui.waitTask("sendTransaction",false);
        });

        tr.once('transactionHash',(hash)=>{
            Tasks.ok("sendTransaction");


            console.log("Transaction",hash);
            Tasks.completable("tr"+Utils.uuidv4(),`Waiting for transaction...
            <sub>
                Transaction ${hash} was sent to the blockchain and is now waiting for confirmations.
                <br />
                This might take some minutes. You can wait here or close the window and come back later.            
            </sub>
            
            
            `,{
                transactionHash:hash,
                chain:this.currentChain
            },true,true,1000*60*60);            
        });
       

        return tr;
    }

    static async refund(userId,entryId,chain){

        await this._setChain(chain);

        const addr=(await this.getAddresses(Auth.getCurrentUserID(),chain))[0];
        const contract=await this.getSellerContract(addr,Auth.getCurrentUserID(),chain);
        const price=await this.getPrice(userId,entryId,chain);
        if(!price)throw new Error("Entry is not priced correctly or doesn't exist");
        let putchaseId=await this.getPurchaseId(userId,entryId,Auth.getCurrentUserID(),chain);
        if(!putchaseId)throw new Error("Not bought.");
        await this.transact(contract.methods.refund(putchaseId));
    }


    // const getContract = async (abiUrl, addr) => {

    //     let abi = await fetch(abiUrl).then(res => res.json());
    //     abi = abi["abi"] || abi;
    //     const web3=await getWeb3();
    //     const factoryContract = new web3.eth.Contract(abi, addr);
    //     return factoryContract;
    //   }

    //   const _setChain = async () => {
    //     try {
    //       await ethereum.request({
    //         method: 'wallet_switchEthereumChain',
    //         params: [{ chainId: paymentConfig.chainId }],
    //       });
    //     } catch (switchError) {
    //       // This error code indicates that the chain has not been added to MetaMask.
    //       if (switchError.code === 4902) {
    //         try {
    //           await ethereum.request({
    //             method: 'wallet_addEthereumChain',
    //             params: [paymentConfig]
    //           });
    //         } catch (addError) {
    //           console.error(addError);
    //         }
    //       }
    //     }

    //     const addr=          (await window.ethereum.send('eth_requestAccounts')).result[0];

    //     const web3=await getWeb3();
    //     console.log("Use account",addr);
    //     const factoryCtr = await getContract(paymentConfig.factoryContract.abi, paymentConfig.factoryContract.addr);
    //     const call = factoryCtr.methods.createContract(Auth.getCurrentUserID());
    //     console.log(await call.send({
    //       from: addr,
    //     }));


    //   }

    //   Ui.setClickAction(connectBtn, async () => {
    //     await _setChain();
    //     if (!window.ethereum) alert("Metamask not installed!");
    //     await window.ethereum.request({
    //       method: "wallet_requestPermissions",
    //       params: [
    //         {
    //           eth_accounts: {}
    //         }
    //       ]
    //     });
    //     const addr = await window.ethereum.request({
    //       method: "eth_requestAccounts",
    //       params: [
    //         {
    //           eth_accounts: {}
    //         }
    //       ]
    //     });

    //     // get seller contract or create


    //   });
}