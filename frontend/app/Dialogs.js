
import Tasks from "./ui/Tasks.js";
import Ui from "./ui/ui.js";
export default class Dialogs {


    static async noMetamaskMessage() {
        return Ui.createWarningMessage("Metamask is not installed", `
        This website requires the metamask browser extension to comunicate with the blockchain.
        <br />
        Some blockchain related features regarding payments, donations and proof of ownership are temporarily disabled.
        <br/>
        <br/>
        Please install metamask from the official website 
        <a target="_blank" href="https://metamask.io/download.html">metamask.io</a> 
        to enable the blockchain related features.
    `);
    }


    static async walletNotConnectedMessage() {
        return Ui.createWarningMessage("Wallet not connected", `
                    The current metamask account is not connected to the website. Please select a connected account through the metamask interface 
                    or click the <b>[Connect current wallet]</b> button
                    to connect the current account.
                    <br /><br />
                    You will be asked to sign a message through the metamask interface, 
                    this will allow our system to verify you are the owner of the address.
                    
                `);
    }


    static async showRefundDialog( paymentChain,  contractAddr,price, callback) {
        const symbol=paymentChain.nativeCurrency.symbol;
        Tasks.completable("loadingContracts","Loading contracts...",{},true,false,undefined,false);
        const sellerContractPath = paymentChain["sellerContract"]["source"];
        const explorer = paymentChain["blockExplorerUrls"][0];
        const sellerContractCode = await fetch(sellerContractPath).then(res => res.text());
        Tasks.ok("loadingContracts");
        
        const content = Ui.toEl(`
            <span>                                           
                Your metamask extension will be instructed to send a refund request to the smart contract
                <a href="${explorer}/address/${contractAddr}" target="_blank"  class="addr">${contractAddr}</a>.
                <br />
                ${price} ${symbol} will be returned to your wallet.
                <br />
                <br />
                <i>A small fee will be paid to the blockchain to validate this transaction</i>
            </span>
        `);
    
        Ui.showDialog("Refund", content,
            [
                {
                    text: `<i class="fas fa-times"></i> Cancel`,
                    action: undefined
                },
                {
                    text: `Request a refund <i class="fas fa-caret-right"></i>`,
                    action: async () => {
                        callback();
                    }
                }
            ]
        );
    }


    static async showBuyDialog( paymentChain, onwerAddr, contractAddr,price, callback) {
        const refundDays=paymentChain.factoryContract.refundTimeDays;
        const symbol=paymentChain.nativeCurrency.symbol;
        Tasks.completable("loadingContracts","Loading contracts...",{},true,false,undefined,false);
        const sellerContractPath = paymentChain["sellerContract"]["source"];
        const explorer = paymentChain["blockExplorerUrls"][0];
        const sellerContractCode = await fetch(sellerContractPath).then(res => res.text());
        Tasks.ok("loadingContracts");
        
        const content = Ui.toEl(`
            <span>                                           
                Your metamask extension will be instructed to send a transaction 
                containing ${price} ${symbol} and <i>a 
                small fee that will be paid to the blockchain nodes</i>.
                <br />
                This is a secure user-to-user agreement regulated by the seller contract 
                <a target="_blank" href="${explorer}/address/${contractAddr}" class="addr">${contractAddr}</a> 
                owned by <a target="_blank"  href="${explorer}/address/${onwerAddr}" class="addr">${onwerAddr}</a>.
                <br />
                <br />
                You will have ${refundDays} days to obtain an automatic refund from the entry page before the purchase is finalized.
                <br />
                <br />

                Please review the smart contract below and click [Accept] to continue.
                You will be then prompted to confirm or reject the transaction on your metamask extension.
                <br />            
                <pre><code></code></pre>
            </span>
        `);
        const code = content.querySelector("code");
        code.innerHTML = Prism.highlight(sellerContractCode, Prism.languages.javascript, 'javascript');            

        Ui.showDialog("Pay", content,
            [
                {
                    text: `<i class="fas fa-times"></i> Cancel`,
                    action: undefined
                },
                {
                    text: `Accept <i class="fas fa-caret-right"></i>`,
                    action: async () => {
                        callback();
                    }
                }
            ]
        );
    }


    static async showEnableSellerDialog(userAddr, paymentChain, callback) {
        Tasks.completable("loadingContracts","Loading contracts...",{},true,false,undefined,false);
        const factoryContractPath = paymentChain["factoryContract"]["source"];
        const factoryContractAddr = paymentChain["factoryContract"]["addr"];
        const sellerContractPath = paymentChain["sellerContract"]["source"];
        const explorer = paymentChain["blockExplorerUrls"][0];

        const factoryContractCode = await fetch(factoryContractPath).then(res => res.text());
        const sellerContractCode = await fetch(sellerContractPath).then(res => res.text());
        Tasks.ok("loadingContracts");

        Ui.showDialog("Enable Seller Contract 1/3", `
        <span>
            This procedure will abilitate this user 
            to sell entries with the following address: <a target="_blank" href="${explorer}/address/${userAddr}" class="addr">${userAddr}</a>.
            <br />
            <i>The procedure will require a small fee that will 
            be paid to the blockchain nodes to perform the changes.</i>
            <br />
            <br />            
            You will be asked to review and confirm the transaction on your metamask extension.
        </span>
        `,
            [
                {
                    text: `<i class="fas fa-times"></i> Cancel`,
                    action: undefined
                },
                {
                    text: `Continue <i class="fas fa-caret-right"></i>`,
                    action: async () => {

                        const content = Ui.toEl(`
                            <span>                                           
                                Your metamask extension will be instructed 
                                to generate and activate a seller contract by 
                                performing a transaction to call the 
                                "createContract" function on our factory contract: <a href="${explorer}/address/${factoryContractAddr}" class="addr">${factoryContractAddr}</a>.
                                <br />
                                <br />
                                Please review the factory contract below and click 
                                [Use this Factory Contract] to continue:
                                <br />
                                <pre><code></code> </pre>
                            </span>
                        `);
                        const code = content.querySelector("code");
                        code.innerHTML = Prism.highlight(factoryContractCode, Prism.languages.javascript, 'javascript');            
                        Ui.showDialog("Enable Seller Contract 2/3", content,
                            [
                                {
                                    text: `<i class="fas fa-times"></i> Cancel`,
                                    action: undefined
                                },
                                {
                                    text: `Use this Factory Contract <i class="fas fa-caret-right"></i>`,
                                    action: async () => {

                                        const content = Ui.toEl(`
                                        <span>                                           
                                            The seller contract is owned by your address, 
                                            and it is the only intermediary between
                                            you and the buyers.
                                            <br />
                                            Its inner workings are defined exclusively 
                                            by its immutable code.
                                            <br />
                                            <br />
                                            Please review the contract below and 
                                            click [Accept] to continue:   
                                            <br />
                                            <pre><code></code> </pre>            
                                        </span>
                                    `);
                                        const code = content.querySelector("code");
                                        code.innerHTML = Prism.highlight(sellerContractCode, Prism.languages.javascript, 'javascript');            

                                        Ui.showDialog("Enable Seller Contract 3/3", content,
                                            [
                                                {
                                                    text: `<i class="fas fa-times"></i> Reject`,
                                                    action: undefined
                                                },
                                                {
                                                    text: `Accept <i class="fas fa-caret-right"></i>`,
                                                    action: async () => {
                                                        callback();
                                                    }
                                                }
                                            ]
                                        );
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    }
}