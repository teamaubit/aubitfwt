// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";

/**
 * @title FreewayTokenDistributor
 * @dev This contract allows to split Ether payments among a group of accounts. The sender does not need to be aware
 * that the Ether will be split in this way, since it is handled transparently by the contract.
 *
 * The split can be in equal parts or in any other arbitrary proportion. The way this is specified is by assigning each
 * account to a number of shares. Of all the Ether that this contract receives, each account will then be able to claim
 * an amount proportional to the percentage of total shares they were assigned.
 *
 * `FreewayTokenDistributor` follows a _pull payment_ model. This means that payments are not automatically forwarded to the
 * accounts but kept in this contract, and the actual transfer is triggered as a separate step by calling the {release}
 * function.
 */
contract FreewayTokenDistributor is Initializable, Context, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event PayeeAdded(address account, uint256 shares);
    event PaymentReleased(address account, uint256 payment);
    event PaymentReceived(address from, uint256 amount);

    uint256 private _totalShares;
    uint256 private _totalReleased;

    IERC20 private _token;

    mapping(address => uint256) private _shares;
    mapping(address => uint256) private _released;
    address[] private _payees;
    

    /**
     * @dev Creates an instance of `FreewayTokenDistributor` where each account in `payees` is assigned the number of shares at
     * the matching position in the `shares` array.
     *
     * All addresses in `payees` must be non-zero. Both arrays must have the same non-zero length, and there must be no
     * duplicates in `payees`.
     */
    function initializeContract(
        IERC20 token
    ) public initializer {
        Ownable.initialize(msg.sender);
        _token = token;
    }
    

    /**
     * @dev Getter for the total shares held by payees.
     */
    function totalShares() public view returns (uint256) {
        return _totalShares;
    }

    /**
     * @dev Getter for the total amount of Ether already released.
     */
    function totalReleased() public view returns (uint256) {
        return _totalReleased;
    }

    /**
     * @dev Getter for the amount of shares held by an account.
     */
    function shares(address account) public view returns (uint256) {
        return _shares[account];
    }

    /**
     * @dev Getter for the amount of Ether already released to a payee.
     */
    function released(address account) public view returns (uint256) {
        return _released[account];
    }

    
    /**
     * @dev Creates an instance of `FreewayTokenDistributor` where each account in `payees` is assigned the number of shares at
     * the matching position in the `shares` array.
     *
     * All addresses in `payees` must be non-zero. Both arrays must have the same non-zero length, and there must be no
     * duplicates in `payees`.
     */
    function inputPayeeData(
        address[] memory payees,
        uint256[] memory amount

    ) public onlyOwner{
        // solhint-disable-next-line max-line-length
        require(
            payees.length == amount.length,
            "FreewayTokenDistributor: payees and amount length mismatch"
        );
        require(payees.length > 0, "FreewayTokenDistributor: no payees");

        for (uint256 index = 0; index < payees.length; index++) {
            _addPayee(payees[index], amount[index]);
        }
    }

    /**
     * @dev Triggers a transfer to `account` of the amount of Ether they are owed, according to their percentage of the
     * total shares and their previous withdrawals.
     */
    function distribute() public onlyOwner{
        
        require(_token.balanceOf(address(this)) >= _totalShares , "No enough balance available to distribute");

        for (uint index=0; index<_payees.length; index++) {
        
            uint256 payment = _shares[_payees[index]];

               if(payment >= 0){
                    _totalReleased = _totalReleased.add(payment);
                    _token.transfer(_payees[index],payment);

                    _released[_payees[index]] = _released[_payees[index]].add(payment);
                    delete _shares[_payees[index]];
                    emit PaymentReleased(_payees[index], payment);
                }
        }

        _payees.length = 0;
        delete _payees;
        _totalShares = 0;
    }
    

    /**
     * @dev Add a new payee to the contract.
     * @param account The address of the payee to add.
     * @param shares_ The number of shares owned by the payee.
     */
    function _addPayee(address account, uint256 shares_) private {
        require(
            account != address(0),
            "FreewayTokenDistributor: account is the zero address"
        );
        require(shares_ > 0, "FreewayTokenDistributor: shares are 0");
        
        _payees.push(account);
        _shares[account] = shares_;
        _totalShares = _totalShares.add(shares_);
        emit PayeeAdded(account, shares_);
    }


/**
     * @dev Clear payee arary list.
     */
    function clearPayees() public onlyOwner{
    for (uint index=0; index<_payees.length; index++) {
        delete _shares[_payees[index]];
    }
        _payees.length = 0;
        delete _payees;
    }
    uint256[50] private ______gap;
}
