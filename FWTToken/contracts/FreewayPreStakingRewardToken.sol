pragma solidity ^0.5.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "D:/Kartik/ERC-Tokens/ERC-20/Upgradable/FWTToken/contracts/BurnerRole.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "D:/Kartik/ERC-Tokens/ERC-20/Upgradable/FWTToken/contracts/DeployerRole.sol";

contract FreewayPreStakingRewardToken is Initializable, Context, ERC20, ERC20Mintable , ERC20Detailed, BurnerRole, DeployerRole {

    using SafeERC20 for IERC20;

    /**
     * @dev Constructor that gives sender initial tokens and respective roles.
     */
    function initialize(address sender) public initializer {
        ERC20Detailed.initialize("FreewayPreStakingReward", "FPR", 18);
        ERC20Mintable.initialize(sender);
        BurnerRole.initialize(sender);
        DeployerRole.initialize(sender);
        _mint(sender, 500000 * (10**uint256(decimals())));
    }

    modifier onlyPayloadSize(uint256 numwords) {
        assert(msg.data.length == numwords * 32 + 4);
        _;
    }

    function transfer(address _to, uint256 _value)
        public
        onlyPayloadSize(2)
        returns (bool)
    {
        super.transfer(_to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value)
        public
        returns (bool success)
    {
        if ((_value != 0) && (allowance(msg.sender, _spender) != 0)) {
            return false;
        }
        super.approve(_spender, _value);
        return true;
    }

    function burnToken(address account, uint256 amount) public onlyBurner returns (bool) {
        require(!super.isDeployer(account), "FreewayPreStakingRewardToken: Account address have the Deployer role");
        _burn(account, amount);
        return true;
    }

    function renounceMinter() public {
        require(!super.isDeployer(_msgSender()), "FreewayPreStakingRewardToken: Caller have the Deployer role");
        super.renounceMinter();
    }

    function renounceBurner() public {
        require(!super.isDeployer(_msgSender()), "FreewayPreStakingRewardToken: Caller have the Deployer role");
        super.renounceBurner();
    }

    function removeMinterRole(address account) public onlyDeployer returns (bool) {
        require(!super.isDeployer(account), "FreewayPreStakingRewardToken: Account address have the Deployer role");
        _removeMinter(account);
        return true;
    }

     function removeBurnerRole(address account) public onlyDeployer returns (bool) {
         require(!super.isDeployer(account), "FreewayPreStakingRewardToken: Account address have the Deployer role");
        _removeBurner(account);
        return true;
    }

    /**
     * @dev Recover all the stranded tokens using transfer method.
     * @param tokenAddress The token contract address
     * @param toAddress The to address
     * @param tokenAmount Number of tokens to be sent
     */
    function recoverERC20(address tokenAddress, address toAddress, uint256 tokenAmount) public onlyDeployer {
        IERC20(tokenAddress).transfer(toAddress, tokenAmount);
    }

    /**
     * @dev Recover all the stranded tokens using safeTransfer method.
     * @param tokenAddress The token contract address
     * @param toAddress The to address
     * @param tokenAmount Number of tokens to be sent
     */
    function recoverSafeERC20(address tokenAddress, address toAddress, uint256 tokenAmount) public onlyDeployer {
        IERC20(tokenAddress).safeTransfer(toAddress, tokenAmount);
    }

    uint256[50] private ______gap;
}
