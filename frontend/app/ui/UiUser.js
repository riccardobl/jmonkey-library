import Ui from './ui.js';
import Entries from "../Entries.js";
import Auth from "../Auth.js";
import Media from "../Media.js";
import Utils from "/common/Utils.js";
import Payment from "../Payment.js"
import Abi from "/common/Abi.js";
import Tasks from "./Tasks.js";
import UrlParams from '../UrlParams.js';
export default class UiUser {


    static async load(parentEl, config) {
        // Ui.waitTask("loading","Loading user...",{},false,false,10000);
        Tasks.completable("loading","Loading user...",{},true,false,undefined,false);

        // Ui.loading(true, "Loading... ", 10000);
        await parentEl.clear();
        parentEl.setAttribute("id","userPage");

 
        const user = await Auth.getUser(Auth.getCurrentUserID());

        const userInfoEl = Ui.createSection(parentEl, ["responsiveWidth", "hlist", "list", "settings", "center"]);

        const userEl = Ui.createUserProfile(user);
        userInfoEl.append(userEl);



        const assetsEl = Ui.createSection(parentEl, ["responsiveWidth", "list", "responsive", "vlist", "settings"]);
        const publishedAssetsEl = Ui.createArticle("entries", "fas  fa-copyright", "Published Assets");
        assetsEl.appendChild(publishedAssetsEl)
        const publishedAssetsTableEl = publishedAssetsEl.content.appendChild(Ui.createTable(["UserID", "EntryID","Name","Version","Status", ""]));

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



        await this.loadPayInfo(settingsEl,config,user);
        await this.loadKeys(settingsEl,config);
        // Ui.loading(false);
        Tasks.ok("loading");
        // await parentEl.show();
    }


    static async loadPayInfo(settingsEl,config,user) {




        const walletEl = Ui.createArticle("wallet", "fas fa-wallet", "Funding");
        settingsEl.appendChild(walletEl);
        walletEl.content.innerHTML=`
        From here you can configure the ways users can fund your content.        
        `;
        const payinfo=await Payment.getInfo(user.userId);
       
             // const headerEl=Ui.createVList();
            // walletEl.appendChild(headerEl);
        walletEl.content.appendChild(Ui.createSubTitle(`<i class="fas fa-bolt"></i> Bitcoin Lightning`));
        walletEl.content.appendChild(Ui.createParagraph(`
        A lightning address or LNURL to receive p2p donations throught the ₿itcoin lightning network.
        <br>
        You can obtain a lightning address or lnurl from one of the <a target="_blank"  href="https://lightningaddress.com/#providers" target="_blank">providers</a> 
        that supports the standard.
        <br>
        Such as the browser wallet add-on <a target="_blank" href="https://getalby.com">Alby</a> or the mobile wallet <a target="_blank"  href="https://www.walletofsatoshi.com/">Wallet of Satoshi</a>.
        <br>
        <i>Leave empty to disable.</i>
        
        `));
        const lnAddrEl = Ui.createInputField();
        lnAddrEl.value = payinfo["ln-address"]||"";
        lnAddrEl.placeholder="user@yournode.ln"
        walletEl.content.appendChild(lnAddrEl);
   
        // let row = Ui.createHList();
        // walletEl.content.appendChild(row);
        // row.appendChild(Ui.createText("Lightning Address:    "));
        // const lnAddr = Ui.createInputField();
        // lnAddr.value = payinfo["ln-address"]||"";
        // row.appendChild(lnAddr);

        walletEl.content.appendChild(Ui.createSubTitle(`<i class="fab fa-paypal"></i> PayPal`));
        walletEl.content.appendChild(Ui.createParagraph(`The URL to a PayPal donation page.
            <br>
        You can generate a donation URL from this page: <a target="_blank" href="https://www.paypal.com/donate/buttons?type=S&fromManage=true">PayPal - Donate Button</a>.
        <br>
        <i>Leave empty to disable.</i>
        `));
        const paypalUrlEl = Ui.createInputField();
        paypalUrlEl.value = payinfo["paypal-id"]?"https://www.paypal.com/donate/?hosted_button_id="+payinfo["paypal-id"]:"";
        paypalUrlEl.placeholder="https://www.paypal.com/donate/?hosted_button_id=XXXXXXXX"
        walletEl.content.appendChild(paypalUrlEl);

        walletEl.content.appendChild(Ui.createSubTitle(`<i class="fab fa-patreon"></i> Patreon Page`));
        walletEl.content.appendChild(Ui.createParagraph(`Your patreon page.    
        <br>
        <i>Leave empty to disable.</i>

        `));
        const patreonUrlEl = Ui.createInputField();
        patreonUrlEl.value = payinfo["patreon-id"]?"https://patreon.com/"+payinfo["patreon-id"]:"";
        patreonUrlEl.placeholder="https://patreon.com/XXXXXXXX"
        walletEl.content.appendChild(patreonUrlEl);


        walletEl.content.appendChild(Ui.createSubTitle(`<i class="fab fa-paypal"></i> GitHub Sponsor`));
        walletEl.content.appendChild(Ui.createParagraph(`A github username that can receive sponsorship through GitHub Sponsor.
        <br>
        This user needs to be opted-in to GitHub Sponsor <a href="https://github.com/sponsors" target="_blank">Click here to learn more</a>.
            <br>

        <i>Leave empty to disable.</i>
        `));
        const githubUrlEl = Ui.createInputField();
        githubUrlEl.value = payinfo["github-id"]?payinfo["github-id"]:"";
        githubUrlEl.placeholder="octocat"
        walletEl.content.appendChild(githubUrlEl);


        walletEl.content.appendChild( Ui.createText("<br><br>"));
        walletEl.content.appendChild(Ui.createButton("","Save changes","Save changes.",async ()=>{
            let lnAddr=lnAddrEl.value;
            let paypalId=paypalUrlEl.value;
            if(paypalId){
                paypalId=paypalId.split("?hosted_button_id=")[1];
            }
            let patreonId=patreonUrlEl.value;
            if(patreonId){
                patreonId=patreonId.split("patreon.com/")[1].split("/")[0];
            }

            let githubId=githubUrlEl.value;
            if(githubId&&githubId.startsWith("https://github.com/")){
                githubId=githubId.split("github.com/")[1].split("/")[0];
            }

            try{
                Tasks.completable("savingPayinfo","Saving...",{},true);
                await Payment.setInfo(user.userId,lnAddr,paypalId,patreonId, githubId);
                Tasks.ok("savingPayinfo");
            }catch(e){
                Tasks.error("savingPayinfo",e+"");
                Tasks.error("savingPayinfoErr",e+"");
            }

        }));
    }


    static async loadKeys(settingsEl,config) {

        const keysEl = Ui.createArticle("userKeys", "fas fa-key", "Auth Keys", []);
     
        keysEl.content.appendChild(Ui.toEl(`
        <p>
            From here you can create Auth Keys to use the library apis.
            <br>
            <i> You should create one Auth Key per app or service. </i>
        </p>
        `));
        settingsEl.appendChild(keysEl);
        const keysTableEl = keysEl.content.appendChild(Ui.createTable(["UserID", "AuthID", "AuthKey", "Description", "IP Whitelist (csv)", ""]));
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
            keyId.addEventListener("click",()=>{
                keyId.setCustomValidity(`The name of this key.`);
                keyId.reportValidity();              
            });

            row.addCell(keyId);
            const key = Ui.createInputField();
            const value=Utils.uuidv4();
            key.value = value;
            key.addEventListener("input",()=>{
                key.value=value;
            });

            key.addEventListener("click",()=>{
                key.setCustomValidity(`An auto-generated unique passphrase.`);
                key.reportValidity();              
            });
            row.addCell(key);
            const desc = Ui.createInputField();
            desc.addEventListener("click",()=>{
                desc.setCustomValidity(`An optional annotation to describe where and why this key is used.`);
                desc.reportValidity();              
            });
            
            row.addCell(desc);
            const ips = Ui.createInputField();
            ips.addEventListener("click",()=>{
                ips.setCustomValidity(`A CSV list of IPs that can use this key. Leave empty to whitelist every IP.`);
                ips.reportValidity();              
            });
            row.addCell(ips);

            const actionsEl = document.createElement("div");
            actionsEl.className = "hlist";

            const deleteBtn = Ui.createButton(undefined, "+", "Create new Key");
            actionsEl.appendChild(deleteBtn);
            Ui.setClickAction(deleteBtn, async () => {
                try{
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
                }catch(e){
                    Tasks.error("createKey",""+e);
                }
                //reload
            })
            row.addCell(actionsEl);
        }


    }
}