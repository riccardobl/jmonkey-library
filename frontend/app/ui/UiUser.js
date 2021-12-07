import Ui from './ui.js';
import Entries from "../Entries.js";
import Auth from "../Auth.js";
import Media from "../Media.js";
import Utils from "/common/Utils.js";
import Payment from "../Payment.js"
import Abi from "/common/Abi.js";
import Tasks from "./Tasks.js";
import UrlParams from '../UrlParams.js';
import Dialogs from '../Dialogs.js';
export default class UiUser {


    static async load(parentEl, config) {
        // Ui.waitTask("loading","Loading user...",{},false,false,10000);
        Tasks.completable("loading","Loading user...",{},true,false,undefined,false);

        // Ui.loading(true, "Loading... ", 10000);
        await parentEl.clear();
        parentEl.setAttribute("id","userPage");

 
        const user = await Auth.getUser(Auth.getCurrentUserID());

        const userInfoEl = Ui.createSection(parentEl, ["responsiveWidth", "hlist", "list", "settings"]);

        const userEl = Ui.createUserProfile(user);
        userInfoEl.append(userEl);



        const assetsEl = Ui.createSection(parentEl, ["responsiveWidth", "list", "responsive", "vlist", "settings"]);
        const publishedAssetsEl = Ui.createArticle("entries", "fas  fa-copyright", "Published Assets");
        assetsEl.appendChild(publishedAssetsEl)
        const publishedAssetsTableEl = publishedAssetsEl.content.appendChild(Ui.createTable(["UserID", "AssetId","Name","Version","Status", ""]));

        const entryIds = (await Entries.listIds("@" + user.userId,true));
        for (let i in entryIds) {
            const entryId = entryIds[i].entryId;
            const userId = entryIds[i].userId;
            // const entryId = entryIds[i];
            const entry = await Entries.get(user.userId, entryId);

            const row = publishedAssetsTableEl.addRow();
            row.addCell(Ui.createText(entry.userId));
            row.addCell(Ui.createText(entry.entryId));
            row.addCell(Ui.createText(entry.name));
            row.addCell(Ui.createText(entry.version));
            if(entry.suspended){
                row.addCell(Ui.createText("SUSPENDED",["warnText"]));
            }else if(entry.banned){
                row.addCell(Ui.createText("BLOCKED",["errText"]));

            }else{
                row.addCell(Ui.createText("PUBLISHED",["okText"]));

            }

            const actionsEl = document.createElement("div");
            actionsEl.className = "hlist";

            const goBtn = Ui.createButton(null, ">", "Go to Page");
            actionsEl.appendChild(goBtn);
            Ui.setClickAction(goBtn, "#!entry=" + entry.userId + "/" + entry.entryId);
            row.addCell(actionsEl);

        }


        // const boughtAssetsEl = Ui.createArticle(assetsEl, "fas fa-dollar-sign", "Bought Assets");
        // const boughtAssetsTableEl = boughtAssetsEl.appendChild(Ui.createTable(["UserID", "AssetId", ""]));

      

        const settingsEl = Ui.createSection(parentEl, ["responsiveWidth", "list", "responsive", "vlist", "settings"]);



        await this.loadWallets(settingsEl,config);
        await this.loadKeys(settingsEl,config);
        // Ui.loading(false);
        Tasks.ok("loading");
        // await parentEl.show();
    }


    static async loadWallets(settingsEl,config) {
        const paymentConfig=config.paymentChains;
        const walletEl = Ui.createArticle("wallet", "fas fa-wallet", "Wallet");
        settingsEl.appendChild(walletEl);

        if(!await Payment.isMetamaskEnabled()){
            const warn=await Dialogs.noMetamaskMessage();
            walletEl.content.appendChild(warn);
            return;
        }

 
        // const connectTable = Ui.createTable(["Blockchain","Wallets","Seller"], ["breakable"]);
        for (let chain in paymentConfig) {
       
            
            // const headerEl=Ui.createVList();
            // walletEl.appendChild(headerEl);
            const chainTitle = Ui.createSubTitle(paymentConfig[chain].nativeCurrency.icon + " " + paymentConfig[chain].chainName);
            walletEl.content.appendChild(chainTitle);

            if(!await Payment.isCurrentWalletConnected(chain)){
                const warn=await Dialogs.walletNotConnectedMessage();
                walletEl.content.appendChild(warn);
            }


            // row = connectWalletTable.addRow();
            // row.addCell(Ui.createText(chain));
            const currentWal=await Payment.getCurrentLocalWalletAddr(chain);
            // if(!currentWal){
            //     const connectBtn = Ui.createButton("fas fa-plug",
            //     "Unlock metamask", async () => {
            //             await Payment.getCurrentLocalWalletAddr(chain);
            //             Ui.reload();
            //         });
            //     walletEl.content.appendChild(connectBtn);
            // }else{
                const isCurrentWalConnected=await Payment.isCurrentWalletConnected(chain);
                const connectBtn = Ui.createButton("fas fa-plug",
                !isCurrentWalConnected?"Connect current wallet: "+(currentWal?currentWal:""):
                "The current wallet "+currentWal+" is connected.", "Connect via metamask", async () => {
                        const addrs = await Payment.getAddresses(Auth.getCurrentUserID(), chain);
                        for (let i = 1; i < addrs.length; i++) {
                            if (await Payment.isSellerContractEnabled(addrs[i], Auth.getCurrentUserID(), chain)) {
                                await Payment.setSellerContractEnabled(false, addrs[i], Auth.getCurrentUserID(), chain);
                            }
                        }
                        await Payment.reconnectAddress(chain);
                        Ui.reload();
                    },[isCurrentWalConnected?"disabled":"enabled"]);
                walletEl.content.appendChild(connectBtn);
            // }




            const addrs = await Payment.getAddresses(Auth.getCurrentUserID(), chain);
            for (let i = 0; i < addrs.length; i++) {
                const addr = addrs[i];

                walletEl.content.appendChild(Ui.createSubSubTitle('<i class="fas fa-cube"></i> Address: ' + addr+(i!=0?" (disconnected)":""), ["breakable"]));
                // row = addressesTable.addRow();
                // row.addCell(Ui.createText(chain));
                // row.addCell(Ui.createText(addr));

                const sellerContract = await Payment.getSellerContract(addr, Auth.getCurrentUserID(), chain);
                // console.log(sellerContract);
                if (sellerContract) {
                    const isEnabled = await Payment.isSellerContractEnabled(addr, Auth.getCurrentUserID(), chain);

                    let row = Ui.createHList();
                    walletEl.content.appendChild(row);
                    row.appendChild(Ui.createText("Account Type:"));
                    row.appendChild(Ui.createText("Buyer & Seller" + (!isEnabled ? "(disabled)" : "")));

                    row = Ui.createHList();
                    walletEl.content.appendChild(row);

                    row.appendChild(Ui.createText("Seller Contract:    "));
                    row.appendChild(Ui.createText(sellerContract.options.address));


                    const balances = await Payment.getSellerContractBalance(addr, Auth.getCurrentUserID(), chain);
                    row = Ui.createHList();
                    walletEl.content.appendChild(row);
                    row.appendChild(Ui.createText("Balance in contract Free/Locked:    "));
                    row.appendChild(Ui.createText(`${await Payment.toHumanValue(balances.available,chain)} ${paymentConfig[chain].nativeCurrency.symbol} / ${await Payment.toHumanValue(balances.available.add(balances.locked),chain)} ${paymentConfig[chain].nativeCurrency.symbol}`));

                    row = Ui.createHList();
                    walletEl.content.appendChild(row);
                    row.appendChild(Ui.createText("Earnings since contract creation:    "));
                    row.appendChild(Ui.createText(`${await Payment.toHumanValue(balances.total,chain)} ${paymentConfig[chain].nativeCurrency.symbol}`));

                    row = Ui.createHList();
                    walletEl.content.appendChild(row);

                    const withdrawBtn=Ui.createButton("fas fa-money-check-alt", `Withdraw ${await Payment.toHumanValue(balances.available,chain)} ${paymentConfig[chain].nativeCurrency.symbol}`, "", async () => {
                        await Payment.withdraw(addr, Auth.getCurrentUserID(),chain);
                    });
                    if(balances.available<=0){
                        withdrawBtn.classList.add("disabled");
                    }
                    row.appendChild(withdrawBtn);
                    

                    if (isEnabled) {
                        if(addr==await Payment.getCurrentLocalWalletAddr(chain)){
                            row.appendChild(Ui.createButton("fas fa-window-close", "Disable Seller Contract", "", async () => {
                                // console.log("Disable",addr);
                                await Payment.setSellerContractEnabled(false, addr, Auth.getCurrentUserID(), chain);
                            }));
                        }
                    } else if (i == 0) {
                        row.appendChild(Ui.createButton("fas fa-window-close", "Enable Seller Contract", "", async () => {
                            Dialogs.showEnableSellerDialog(addr,paymentConfig[chain],async ()=>{
                                await Payment.setSellerContractEnabled(true, addr, Auth.getCurrentUserID(), chain);
                            });
                                    

                    
                        }));
                    }
                 } else if (i == 0) {
                    let row = Ui.createHList();
                    walletEl.content.appendChild(row);
                    row.appendChild(Ui.createText("Account Type:"));
                    row.appendChild(Ui.createText("Buyer"));
                    row = Ui.createHList();
                    walletEl.content.appendChild(row);

                    row.appendChild(Ui.createButton("fas fa-money-check-alt", "Enable Seller Contract", "", async () => {
                        // await Payment.setChain(chain);
                        if(addr!=await Payment.getCurrentLocalWalletAddr(chain)){
                            alert("Please select the account "+addr+ " on metamask");
                        }else{
                            await Payment.createSellerContract(chain);
                        }
                        // Ui.reload();

                    }));
                }
            }
        }
    }


    static async loadKeys(settingsEl,config) {

        const keysEl = Ui.createArticle("userKeys", "fas fa-key", "Access Keys", []);
        settingsEl.appendChild(keysEl);
        const keysTableEl = keysEl.content.appendChild(Ui.createTable(["UserID", "KeyID", "KEY", "Description", "IPs", ""]));
        const keys = (await Auth.getAllKeys());
        keys.forEach(key => {
            const row = keysTableEl.addRow();
            row.addCell(Ui.createText(key.userId));
            row.addCell(Ui.createText(key.keyId));
            row.addCell(Ui.createText("*****"));
            row.addCell(Ui.createText(key.description));
            row.addCell(Ui.createText(key.ips ? key.ips.join(",") : ""));

            const actionsEl = document.createElement("div");
            actionsEl.className = "hlist";

            const deleteBtn = Ui.createButton(null, "X", "Remove this key");
            actionsEl.appendChild(deleteBtn);
            Ui.setClickAction(deleteBtn, async () => {
                Tasks.completable("deleteKey","Deleting key...",{},true);
                await Auth.deleteKey(key.keyId);
                Tasks.ok("deleteKey");
                
                //reload
            })


            row.addCell(actionsEl);

        });

        {

            let row = keysTableEl.addRow();
            row.addCell(Ui.createText(Auth.getCurrentUserID()));
            const keyId = Ui.createInputField();
            keyId.value = "New_Key" + keys.length;
            row.addCell(keyId);
            const key = Ui.createInputField();
            key.value = Utils.uuidv4();
            row.addCell(key);
            const desc = Ui.createInputField();
            row.addCell(desc);
            const ips = Ui.createInputField();
            row.addCell(ips);

            const actionsEl = document.createElement("div");
            actionsEl.className = "hlist";

            const deleteBtn = Ui.createButton(undefined, "+", "Create new Key");
            actionsEl.appendChild(deleteBtn);
            Ui.setClickAction(deleteBtn, async () => {
                Tasks.completable("createKey","Creating key...",{},true);

                const ipss = ips.value.split(",");

                await Auth.setKey({
                    userId: Auth.getCurrentUserID(),
                    keyId: keyId.value,
                    key: key.value,
                    description: desc.value,
                    ips: ipss.length > 0 ? ipss : undefined
                });
                Tasks.ok("createKey");

                //reload
            })
            row.addCell(actionsEl);
        }


    }
}