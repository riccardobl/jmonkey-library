pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract SellContract is ERC721Burnable,ERC721Enumerable{
    using Counters for Counters.Counter;

    string public uid;
    uint256 public price;
    address payable public seller;
    bool public active;
    string public baseUri;
    
    Counters.Counter private tokenIDCounter;
    
    
    mapping(uint256 => uint) private refundable;
    mapping(uint256 => bool) private pendingWithdraw;

    /**
     * seller: address that is selling the token
     * uid: unique ID of the entity in the store (ie userId/entityId)
     * price: exact price to pay to mint a token
     */
    constructor(address payable _seller,string memory _uid,string memory _name,uint256 _price,string memory _baseuri) ERC721(_name,_uid) {
        require(_price>0);
        price=_price;
        uid=_uid;
        seller=_seller;
        baseUri=_baseuri;
        active=true;
    }
    
    
   // READ ONLY
    
    /**
     * Return true of the token is within the withdraw period
     */
    function isRefundable(uint256 tokenId) public view returns(bool){
        return refundable[tokenId]>0&&refundable[tokenId]+1200>=block.timestamp;
    }
    
    /**
     * Return true if the payment for this nft is waiting for withdrawal
     */
    function isWithdrawPending(uint256 tokenId) public view returns(bool){
        return pendingWithdraw[tokenId];
    }
    
    /**
     * Return true if the payment is withdrawdable and the refund period is expired. 
     * Meaning the payment is ready to be withdrawed
     */
    function isWithdrawable(uint256 tokenId) public view returns(bool){
        return !isRefundable(tokenId)&&isWithdrawPending(tokenId);
    }
    
    
    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return  string(abi.encodePacked(_baseURI(), uid,"?",tokenId));
    }
    
    
    // READ & WRITE
    
    /**
     * Active or deactive minting of new tokens
     */
    function setActive(bool v) public{
        require(_msgSender()==seller,"Only seller can active or deactive the contract.");
        active=v;
    }
    
    /**
    * Buy a token
    */
    function buy() public payable returns(uint){
        require(active,"This contract has been deactivated by the seller.");
        require(msg.value==price,"Invalid payment. Price is not met");
        // Generate new token id
        tokenIDCounter.increment();
        uint256 tokenId=tokenIDCounter.current();
        // Set uri
        // _setTokenURI(tokenId,string(abi.encodePacked("https://library.jmonkeyengine.org/nft/", uid)));
        // Mint token
        _safeMint(msg.sender,tokenId);
        // Make it refundable
        refundable[tokenId]=block.timestamp+(60); // in seconds
        // Mark it for withdraw
        pendingWithdraw[tokenId]=true;
        return tokenId;
    }  
    
    /**
     * Burn and refund. If refund is not possible, the token cannot be burnt
     */
    function burn(uint256 tokenId) public override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721Burnable: caller is not owner nor approved"); // check if caller has the right to burn
        require(isRefundable(tokenId),"Can't burn a non refundable token."); // can't burn what we can't refund.
        delete refundable[tokenId]; // reset refundable state
        delete pendingWithdraw[tokenId]; // reset withdrawdable state 
        super.burn(tokenId); // destroy token 
        payable(_msgSender()).transfer(price); // send money back
    }
    
    /**
     * Alias to burn(uint256)
     */
    function refund(uint256 tokenId) public {
        burn(tokenId);
    }
    
    /**
     * Withdraw. Can be called by anyone, the payment is submited to seller
     */ 
    function withdraw(uint256 tokenId) public  {
        require(isWithdrawable(tokenId),"Not withdrawdable"); // check if withdraw is possible.
        delete pendingWithdraw[tokenId]; // reset withdrawdable state 
        delete refundable[tokenId]; // reset refundable state
        seller.transfer(price); // pay
    }
    
    /**
    * Withdraw multiple payments at once. See withdraw(uint256)
    */ 
    function batchWithdraw(uint256[] memory tokenIds) public {
        for(uint i=0;i<tokenIds.length;i++){// check if withdraw is possible for everyitem in the array.
            uint256 tokenId=tokenIds[i];
            require(isWithdrawable(tokenId),"At least one payment is not withdrawdable"); 
            delete pendingWithdraw[tokenId]; // reset withdrawdable state 
            delete refundable[tokenId]; // reset refundable state
        }
        seller.transfer(tokenIds.length*price); // pay all
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