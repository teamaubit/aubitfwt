pragma solidity ^0.5.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/cryptography/ECDSA.sol";

/**
 * @title VestingVault
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract VestingVault is Initializable, Ownable {
    // The vesting schedule is time-based (i.e. using block timestamps as opposed to e.g. block numbers), and is
    // therefore sensitive to timestamp manipulation (which is something miners can do, to a certain degree). Therefore,
    // it is recommended to avoid using short time durations (less than a minute). Typical vesting schemes, with a
    // cliff period of a year and a duration of four years, are safe to use.
    // solhint-disable not-rely-on-time

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    event TokensReleased(address token, uint256 amount);
    event TokenVestingRevoked(address token);
    event TokenVestingBeneficiaryVerified(address beneficiary);

    // beneficiary of tokens after they are released
    address private _beneficiary;
    uint256 private _vestingAmount;
    uint256 private _intervalVested;
    uint256 private _cliff;
    uint256 private _start;
    uint256 private _interval;
    string private _stamp;
    uint256 private _duration;
    bool private _revocable;
    bool private _beneficiaryVerified;

    // Durations and timestamps are expressed in UNIX time, the same units as block.timestamp.
    uint32 private constant SECONDS_PER_MINUTE = 60;
    uint32 private constant MINUTES_PER_HOUR = 60;
    uint32 private constant SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
    uint32 private constant HOURS_PER_DAY = 24;
    uint32 private constant SECONDS_PER_DAY = HOURS_PER_DAY * SECONDS_PER_HOUR; // 86400 seconds per day
    uint32 private constant DAYS_PER_MONTH = 30;
    uint32 private constant SECONDS_PER_MONTH = DAYS_PER_MONTH * SECONDS_PER_DAY; // Month here is of 30 days period or 2592000 seconds per month.
    uint32 private constant DAYS_PER_YEAR = 365;
    uint32 private constant SECONDS_PER_YEAR = DAYS_PER_YEAR * SECONDS_PER_DAY; // Year here is of 365 days period.

    mapping(address => uint256) private _released;
    mapping(address => bool) private _revoked;

    /**
     * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
     * beneficiary, gradually in a linear fashion until start + duration. By then all
     * of the balance will have vested.
     * @param beneficiary address of the beneficiary to whom vested tokens are transferred
     * @param vestingAmount vesting amount of the benefeciary to be recieved
     * @param cliffDuration duration in seconds of the cliff in which tokens will begin to vest
     * @param start the time (as Unix time) at which point vesting starts
     * @param duration duration in seconds of the period in which the tokens will vest
     * @param interval The time period at which the tokens has to be vested
     * @param stamp the interval is in Minutes(MIN)/Hours(H)/Days(D)/Months(M)/Years(Y)
     * @param revocable whether the vesting is revocable or not
     */
    function initialize(
        address beneficiary,
        uint256 vestingAmount,
        uint256 start,
        uint256 cliffDuration,
        uint256 duration,
        uint256 interval,
        string memory stamp,
        bool revocable
    ) public initializer {

        require(
            beneficiary != address(0),
            "VestingVault: beneficiary is the zero address"
        );
        require(duration > 0, "VestingVault: duration is 0");
        // solhint-disable-next-line max-line-length
        require(
            cliffDuration <= duration,
            "VestingVault: cliff is longer than duration"
        );
        // solhint-disable-next-line max-line-length
        require(
            start.add(duration) > block.timestamp,
            "VestingVault: final time is before current time"
        );
        require(
            keccak256(abi.encodePacked(stamp)) == keccak256("MIN") ||
            keccak256(abi.encodePacked(stamp)) == keccak256("H") ||
            keccak256(abi.encodePacked(stamp)) == keccak256("D") ||
            keccak256(abi.encodePacked(stamp)) == keccak256("M") ||
            keccak256(abi.encodePacked(stamp)) == keccak256("Y"),
            "VestingVault: Interval Stamp can be Minutes(MIN)/Hours(H)/Days(D)/Months(M)/Years(Y)"
        );
        uint256 interval_in_sec = getCalculatedIntervalInSeconds(interval, stamp);
        require(
            ((cliffDuration % interval_in_sec == 0) && (duration % interval_in_sec == 0)) ,
            "VestingVault: duration & cliffDuration should multiplication of interval"
        );

        Ownable.initialize(msg.sender);

        _beneficiary = beneficiary;
        _revocable = revocable;
        _vestingAmount = vestingAmount;
        _duration = duration;
        _cliff = start.add(cliffDuration);
        _interval = interval;
        _stamp = stamp;
        _start = start;
        _beneficiaryVerified = false;
        setCalculatedVestedAmountPerInterval(vestingAmount, duration, interval, stamp);
    }

    /**
     * @return the beneficiary of the tokens vesting.
     */
    function beneficiary() public view returns (address) {
        return _beneficiary;
    }

    /**
     * @return the beneficiaryVerified of the tokens vesting.
     */
    function beneficiaryVerified() public view returns (bool) {
        return _beneficiaryVerified;
    }

    /**
     * @return the vesting amount of the benefeciary.
     */
    function vestingAmount() public view returns (uint256) {
        return _vestingAmount;
    }

    /**
     * @return the amount of token to be vested for the benefeciary per interval.
     */
    function intervalVested() public view returns (uint256) {
        return _intervalVested;
    }

    /**
     * @return the cliff time of the token vesting.
     */
    function cliff() public view returns (uint256) {
        return _cliff;
    }

    /**
     * @return the interval time of the token vesting in seconds.
     */
    function interval() public view returns (uint256) {
        return _interval;
    }

    /**
     * @return the interval time is respect to Minutes(MIN)/Hours(H)/Days(D)/Months(M)/Years(Y).
     */
    function stamp() public view returns (string memory) {
        return _stamp;
    }

    /**
     * @return the start time of the token vesting.
     */
    function start() public view returns (uint256) {
        return _start;
    }

    /**
     * @return the duration of the token vesting.
     */
    function duration() public view returns (uint256) {
        return _duration;
    }

    /**
     * @return true if the vesting is revocable.
     */
    function revocable() public view returns (bool) {
        return _revocable;
    }

    /**
     * @return the amount of the token released.
     */
    function released(address token) public view returns (uint256) {
        return _released[token];
    }

    /**
     * @return true if the token is revoked.
     */
    function revoked(address token) public view returns (bool) {
        return _revoked[token];
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param token ERC20 token which is being vested
     */
    function releasable(IERC20 token) public view returns (uint256) {
        return _vestedAmount(token).sub(_released[address(token)]);
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param token ERC20 token which is being vested
     */
    function release(IERC20 token) public {

        require(_beneficiaryVerified == true, "VestingVault: Beneficiary signature not yet verified");

        require(block.timestamp > _cliff, "VestingVault: you have not passed the lock period yet");

        uint256 unreleased = _releasableAmount(token);

        require(unreleased > 0, "VestingVault: no tokens are due");

        _released[address(token)] = _released[address(token)].add(unreleased);

        token.safeTransfer(_beneficiary, unreleased);

        emit TokensReleased(address(token), unreleased);
    }

    /**
     * @notice Allows the owner to revoke the vesting. Tokens already vested
     * remain in the contract, the rest are returned to the owner.
     * @param token ERC20 token which is being vested
     */
    function revoke(IERC20 token) public onlyOwner {
        require(_revocable, "VestingVault: cannot revoke");
        require(
            !_revoked[address(token)],
            "VestingVault: token already revoked"
        );

        uint256 balance = token.balanceOf(address(this));

        uint256 unreleased = _releasableAmount(token);
        uint256 refund = balance.sub(unreleased);

        _revoked[address(token)] = true;

        token.safeTransfer(owner(), refund);

        emit TokenVestingRevoked(address(token));
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param token ERC20 token which is being vested
     */
    function _releasableAmount(IERC20 token) private view returns (uint256) {
        return _vestedAmount(token).sub(_released[address(token)]);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param token ERC20 token which is being vested
     */
    function _vestedAmount(IERC20 token) private view returns (uint256) {
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 totalBalance = currentBalance.add(_released[address(token)]);

        if (block.timestamp < _cliff) {
            return 0;
        } else if (
            block.timestamp >= _start.add(_duration) || _revoked[address(token)]
        ) {
            return totalBalance;
        } else {
            return getBatchTimestamp().mul(totalBalance).div(_duration);
        }
    }

    /**
     * @return Retrieves the duration passed from start till now according to interval in seconds.
     */
    function getBatchTimestamp() private view returns (uint256) {
        require(
            block.timestamp > _start,
            "VestingVault: Current timestamp is smaller than start time"
        );

        uint256 INTERVAL_TIMESTAMP = getCalculatedIntervalInSeconds(_interval,_stamp);
        uint256 ADJUSTED_INTERVAL = (block.timestamp.sub(_start)).div(INTERVAL_TIMESTAMP);

        uint256 START_TILL_NOW = ADJUSTED_INTERVAL.mul(INTERVAL_TIMESTAMP);
        return START_TILL_NOW;
    }

    /**
     * @return Timestamp in Interval.
     */
    function getCalculatedIntervalInSeconds(uint256 interval__, string memory stamp__) public pure returns (uint256) {
        if (keccak256(abi.encodePacked(stamp__)) == keccak256("MIN")) {
            return (SECONDS_PER_MINUTE * interval__);
        } else if (keccak256(abi.encodePacked(stamp__)) == keccak256("H")) {
            return (SECONDS_PER_HOUR * interval__);
        } else if (keccak256(abi.encodePacked(stamp__)) == keccak256("D")) {
            return (SECONDS_PER_DAY * interval__);
        } else if (keccak256(abi.encodePacked(stamp__)) == keccak256("M")) {
            return (SECONDS_PER_MONTH * interval__);
        } else if (keccak256(abi.encodePacked(stamp__)) == keccak256("Y")) {
            return (SECONDS_PER_YEAR * interval__);
        }
    }

    /**
     * @dev Sets the calculated vesting amount per interval.
     * @param vestedAmount The total amount that is to be vested. 
     * @param duration_ The total duration in which the veted tokens will be released.
     * @param interval_ The intervals at which the token will be released.
     * @param stamp_ The intervals mentioned are in Minutes(MIN)/Hours(H)/Days(D)/Months(M)/Years(Y).
     */
    function setCalculatedVestedAmountPerInterval(
        uint256 vestedAmount,
        uint256 duration_,
        uint256 interval_,
        string memory stamp_
    ) private {
        uint256 diff = vestedAmount;

        if (keccak256(abi.encodePacked(stamp_)) == keccak256("MIN")) {
            _intervalVested = (
                diff.div(duration_.div(SECONDS_PER_MINUTE).div(interval_))
            );
        } else if (keccak256(abi.encodePacked(stamp_)) == keccak256("H")) {
            _intervalVested = (
                diff.div(duration_.div(SECONDS_PER_HOUR).div(interval_))
            );
        } else if (keccak256(abi.encodePacked(stamp_)) == keccak256("D")) {
            _intervalVested = (
                diff.div(duration_.div(SECONDS_PER_DAY).div(interval_))
            );
        } else if (keccak256(abi.encodePacked(stamp_)) == keccak256("M")) {
            _intervalVested = (
                diff.div(duration_.div(SECONDS_PER_MONTH).div(interval_))
            );
        } else if (keccak256(abi.encodePacked(stamp_)) == keccak256("Y")) {
            _intervalVested = (
                diff.div(duration_.div(SECONDS_PER_YEAR).div(interval_))
            );
        }
    }

    function getVestedAmountNow() public view returns (uint256) {
        return getBatchTimestamp().mul(_vestingAmount).div(_duration);
    }

    function verifyAddress(bytes32 hash, bytes memory signature) public returns (bool) {
        // bytes32 tmpHash = toEthSignedMessageHash(hash);
        address tempAddress = recover(hash, signature);
        require(tempAddress == _beneficiary, "VestingVault: ECDSA Recover Failed, Beneficiary Address Signature is invalid");
        _beneficiaryVerified = true;
        emit TokenVestingBeneficiaryVerified(_beneficiary);
        return true;
    }

    function recover(bytes32 hash, bytes memory signature) public pure returns (address) {
        return hash.recover(signature);
    }

    function toEthSignedMessageHash(bytes32 hash) public pure returns (bytes32) {
        return hash.toEthSignedMessageHash();
    }
    
    uint256[50] private ______gap;
}
