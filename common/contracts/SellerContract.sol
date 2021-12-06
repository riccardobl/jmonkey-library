pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract SellerContract is ERC721Burnable,ERC721Enumerable{
    struct Entry{
        string id;
        uint256 price;
        bool active;
        bool exists;
        string message;
    }
    
     struct Purchase{
        string entryId;
        uint256 price;
        uint refundable;
        bool pendingWithdraw;
        bool exists;
        string buyerId;
        string message;
    }
    
    using Counters for Counters.Counter;

    address payable public seller;
    string public baseUrlData;
    string public baseUrlProof;
    string public userId;
    bool public active;
    
    
    Counters.Counter private purchaseIDCounter;
    mapping(string => Entry) private entries;
    mapping(uint256 => Purchase) private purchases;


    
    // INTERNALS

    /**
     * _seller: address that is selling the token
     * _userId: unique ID of the seller in the store
     * _name: name of this contract
     * _baseuri: base url to get token infos
     */
    constructor(address payable _seller,string memory _userId,string memory _name,string memory _baseUrlData,string memory _baseUrlProof) ERC721(_name,_name) {
        seller=_seller;
        baseUrlData=_baseUrlData;
        baseUrlProof=_baseUrlProof;
        active=true;
        userId=_userId;
        purchaseIDCounter.increment();
    }
    
    function _strcmp(string memory a, string memory b) public pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
    
    function _getEntry(string memory entryId) private view returns(Entry memory){
        Entry memory entry=entries[entryId];
        require(entry.exists,"Entry not found.");
        return entry;
    }
    
    function _getPurchase(uint256 purchaseId) private view returns(Purchase memory){
        Purchase memory purchase=purchases[purchaseId];
        require(purchase.exists,"Purchase not found.");
        return purchase;
    }
    
    
    function _isRefundable(Purchase memory purchase) private view returns( bool){
        return purchase.exists&&purchase.refundable>0&&purchase.refundable+1200>=block.timestamp;
    }
    
      
    function _isWithdrawPending(Purchase memory purchase) private pure returns( bool){
        return purchase.exists&&purchase.pendingWithdraw;
    }
    
    function _isWithdrawable(Purchase memory purchase) private view returns( bool){
        return  !_isRefundable(purchase)&&_isWithdrawPending(purchase);
    }
    
    
    // ----
    
   // READ ONLY
    
    function getSellerId() public view returns(string memory){
        return userId;
    }
    
        
    function getSellerAddr() public view returns(address){
        return seller;
    }
    
    
    function isContractActive() public view returns(bool){
        return active;
    }
    
    
    function isEntryBuyable(string memory entryId) public view returns(bool){
        Entry memory entry=entries[entryId];
        return entry.exists&&entry.active;
    }
    
    function getEntryPrice(string memory entryId) public view returns(uint256){
        Entry memory entry=_getEntry(entryId);
        return entry.price;
    }

    function getPurchasePrice(uint256 purchaseId) public view returns(uint256){
        Purchase memory purchase = _getPurchase(purchaseId);
        return purchase.price;
    }    
    
    function getPurchaseOwner(uint256 purchaseId) public view returns(address){
        return ownerOf(purchaseId);
    }
    
    function isSeller(address _seller) public view returns(bool){
        return seller==_seller;
    }
    
    
    function getPurchaseId(string memory entryId,address buyer) public view returns(uint256){
        uint256 n=countPurchases(buyer);
        for(uint256 i=0;i<n;i++){
            uint256 id=getPurchaseId(buyer,i);
            Purchase memory purchase = _getPurchase(id);
            if(_strcmp(purchase.entryId,entryId))return id;
        }
        return 0;
    }
    
    
    function countPurchases(address owner) public view returns(uint256){
        return balanceOf(owner);
    }
    
    function getPurchaseId(address owner,uint256 localIndex) public view returns(uint256){
        return tokenOfOwnerByIndex(owner,localIndex);
    }
    
    function countPurchases() public view returns(uint256){
        return purchaseIDCounter.current();
    }

    function isValidPurchase(uint256 purchaseId) public view returns(bool){
        Purchase memory purchase=purchases[purchaseId];
        return purchase.exists;
    }
    

    
    /**
     * Return true of the token is within the withdraw period
     */
    function isRefundable(uint256 purchaseId) public view returns(bool){
        Purchase memory purchase = _getPurchase(purchaseId);
        return _isRefundable(purchase);
    }
    
    
    /**
     * Return true if the payment for this nft is waiting for withdrawal
     */
    function isWithdrawPending(uint256 purchaseId) public view returns(bool){
        Purchase memory purchase=_getPurchase(purchaseId);
        return _isWithdrawPending(purchase);
    }
    
    /**
     * Return true if the payment is withdrawdable and the refund period is expired. 
     * Meaning the payment is ready to be withdrawed
     */
    function isWithdrawable(uint256 purchaseId) public view returns(bool){
        Purchase memory purchase=_getPurchase(purchaseId);
        return _isWithdrawable(purchase);
    }
    
    
    function _baseURI() internal view override returns (string memory) {
        return baseUrlData;
    }
    
    function tokenURI(uint256 purchaseId) public view override returns (string memory) {
        require(_exists(purchaseId), "ERC721Metadata: URI query for nonexistent token");
        Purchase memory purchase=_getPurchase(purchaseId);
        return  string(abi.encodePacked(_baseURI(), "entry=",userId,"/",purchase.entryId));
    }
    
    function purchaseProofURI(uint256 purchaseId)public view  returns (string memory) {
        Purchase memory purchase=_getPurchase(purchaseId);
        return  string(abi.encodePacked(baseUrlProof, "entry=",userId,"/",purchase.entryId,"&owner=",purchase.buyerId));
    }
    

    function getEntryMessage(string memory entryId) public view returns(string memory ){
        Entry memory entry=_getEntry(entryId); 
        return entry.message;
    }
    

    function getPurchaseMessage(uint256 purchaseId) public view returns(string memory){
        Purchase memory purchase=_getPurchase(purchaseId);
        return purchase.message;
    }
   

    //  WRITE
    
    function setEntry(string memory _id,uint256 _price,bool _active,string memory message) public{
        require(active,"This contract has been deactivated by the seller.");
        require(_msgSender()==seller,"Only seller can edit registered entries.");
        require(_price>1,"Price must be >1");
        Entry memory entry=Entry(_id,_price,_active,true,message);
        entries[_id]=entry;
    }
    
    
    /**
     * Active or deactive minting of new tokens
     */
    function setContractActive(bool v) public{
        require(_msgSender()==seller,"Only the seller can activate or deactivate the contract.");
        active=v;
    }
    
    // /**
    // * Active or deactive an entry 
    // */
    // function setEntryActive(string memory entryId,bool v) public{
    //     require(_msgSender()==seller,"Only seller can active or deactive an entry.");
    //     Entry memory entry=_getEntry(entryId);
    //     entry.active=v;
    //     entries[entryId]=entry;
    // }



    /**
    * Buy a token
    */
    function buy(string memory entryId,string memory buyerId) public payable returns(uint256){
        require(active,"This contract has been deactivated by the seller.");
        Entry memory entry=_getEntry(entryId); // get entry 
        require(entry.active,"Entry is not actived."); // check if active
        require(msg.value==entry.price,"Invalid payment. Price is not met"); // check if right price
        
        // Create a purchase 
        uint refundLimit=block.timestamp+(60);
        Purchase memory purchase=Purchase(entry.id,entry.price,refundLimit,true,true,buyerId,entry.message);
        
        // Generate new id for the purchase
        purchaseIDCounter.increment();
        uint256 purchaseId=purchaseIDCounter.current();
        
        // Mint token representing the purchase
        _safeMint(msg.sender,purchaseId);
        
        // Register purchase
        purchases[purchaseId]=purchase;

        return purchaseId;
    }  
    
    /**
     * Burn and refund. If refund is not possible, the token cannot be burnt
     */
    function burn(uint256 purchaseId) public override {
        require(_isApprovedOrOwner(_msgSender(), purchaseId), "ERC721Burnable: caller is not owner nor approved"); // check if caller has the right to burn
       
        Purchase memory purchase=_getPurchase(purchaseId); // get purchase
        require(_isRefundable(purchase),"Can't burn a non refundable token."); // can't burn what we can't refund.
        
        // purchase.refundable=0; // reset refundable state
        // purchase.pendingWithdraw=false; // reset withdrawdable state 
        // purchases[purchaseId]=purchase; // update state

        delete purchases[purchaseId]; // delete purchase proof
        require(purchase.price>0,"Price is <=0?");

        super.burn(purchaseId); // destroy token 
        
        payable(_msgSender()).transfer(purchase.price); // send money back
    }
    
    /**
     * Alias to burn(uint256)
     */
    function refund(uint256 purchaseId) public {
        burn(purchaseId);
    }
    
    /**
     * Withdraw. Can be called by anyone, the payment is submited to seller
     */ 
    function withdraw(uint256 purchaseId) public  {
        Purchase memory purchase=_getPurchase(purchaseId); // get purchase
        require(_isWithdrawable(purchase),"Not withdrawdable"); // check if withdraw is possible.
        
        purchase.pendingWithdraw=false;  // reset withdrawdable state 
        purchase.refundable=0; // reset refundable state
        
        purchases[purchaseId]=purchase; // update state
        require(purchase.price>0,"Price is <=0?");

        seller.transfer(purchase.price); // pay
    }
    
    /**
    * Withdraw multiple payments at once. See withdraw(uint256)
    */ 
    function batchWithdraw(uint256[] memory purchaseIds) public {
        uint256 tot=0;
        for(uint i=0;i<purchaseIds.length;i++){// check if withdraw is possible for everyitem in the array.
            uint256 purchaseId=purchaseIds[i];
            Purchase memory purchase=_getPurchase(purchaseId); // get purchase
            require(_isWithdrawable(purchase),"At least one payment is not withdrawdable"); // check if withdraw is possible.
            
            purchase.pendingWithdraw=false; // reset withdrawdable state 
            purchase.refundable=0;// reset refundable state
            
            purchases[purchaseId]=purchase;// update state

            require(purchase.price>0,"Price is <=0?");

            tot+=purchase.price;// sum total
        }
        
        seller.transfer(tot); // pay all
    }



    // Overrides
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override( ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}