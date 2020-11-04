// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

contract FreewayToken is Initializable, Context, ERC20, ERC20Detailed {
    /**
     * @dev Constructor that gives _msgSender() all of existing tokens.
     */
    function initialize(address sender) public initializer {
        ERC20Detailed.initialize("FreewayToken", "FWT", 18);
        _mint(sender, 10000000000 * (10**uint256(decimals())));
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

    function approve(address _spender, uint256 _value) public returns (bool success) {
        if ((_value != 0) && (allowance(msg.sender, _spender) != 0)) {
            return false;
        }
        super.approve(_spender, _value);
        return true;
    }

    uint256[50] private ______gap;
}
