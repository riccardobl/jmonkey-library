pragma solidity ^0.8.0;
import "./SellerContract.sol";

contract FactoryContract {

    mapping(address => SellerContract) private addressXContract;
    mapping(address => bool) private addressXContractLock;


    string public baseUrlData;
    string public baseUrlProof;
    string public prefix;
    
    function _compareStrings(string memory a, string memory b) private pure returns(bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }

    //"https://library.jmonkeyengine.org/nft/" "jme:"
    constructor(string memory _baseUrlData, string memory _baseUrlProof,string memory _prefix){
        baseUrlData=_baseUrlData; 
        baseUrlProof=_baseUrlProof; 
        prefix=_prefix;
    }
     
    /**
     * Create a new contract
     */
    function createContract(string memory ownerUserId) public returns(address contractAddr){
        address payable seller=payable(msg.sender);
        require(!addressXContractLock[seller],"Contract already created for this address.");
        SellerContract sellContract=new SellerContract(seller,ownerUserId,string(abi.encodePacked(prefix,ownerUserId)),baseUrlData,baseUrlProof);
        addressXContract[seller]=sellContract;
        addressXContractLock[seller]=true;
        return address(sellContract);
    }
    
    /**
     * Get contract for address
     */
    function getContractAddr(address  owner,string memory ownerUserId ) public view returns(address contractAddr){
        if(!addressXContractLock[owner])return address(0);
        SellerContract ctr=addressXContract[owner];
        require(_compareStrings(ctr.getSellerId(),ownerUserId),"Invalid owner id?");
        return address(ctr);
    }
    
}