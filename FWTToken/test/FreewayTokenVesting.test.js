const FreewayToken = artifacts.require("FreewayToken");
const VestingVault = artifacts.require('VestingVault');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

contract('FreewayToken', accounts => {

    const [owner, beneficiary1, beneficiary2, ...otherbenefciaries] = accounts;
    const _name = "FreewayToken";
    const _symbol = "FWT";
    const _decimals = 18;
    const _decimals_in_zeros = 10 ** _decimals;
    const _decimals_zeros = '000000000000000000';
    const ZERO_BAL = new BN(0);

    // Seed Sale Token Vesting Details
    const SEED_SALE_BENEFICIARY = beneficiary1;
    const SEED_SALE_TOTAL_AMOUNT = new BN('600000000' + _decimals_zeros);// 10% released from day one.
    const SEED_SALE_VESTING_AMOUNT = new BN('540000000' + _decimals_zeros);// 90% of Total Amount
    const SEED_SALE_CLIFF_DURATION = time.duration.seconds(0);// No locking preiod as 0
    const SEED_SALE_TOTAL_DURATION = time.duration.days(300);// 30 days per month, so 10 months
    const SEED_SALE_INTERVAL_DURATION = 1;// 9% monthly for 10 subsequent months from total amount
    const SEED_SALE_INTERVAL_STAMP = 'M';// Interval is monthly
    const SEED_SALE_REVOCABLE = true;// Vesting is revocable

    // Private Pre sale Token Vesting Details
    const PRIVATE_PRE_SALE_BENEFICIARY = beneficiary2;
    const PRIVATE_PRE_SALE_TOTAL_AMOUNT = new BN('1800000000' + _decimals_zeros);// 15% released from day one
    const PRIVATE_PRE_SALE_VESTING_AMOUNT = new BN('1530000000' + _decimals_zeros);// 85% of Total Amount
    const PRIVATE_PRE_SALE_CLIFF_DURATION = time.duration.seconds(0);// No locking preiod as 0
    const PRIVATE_PRE_SALE_TOTAL_DURATION = time.duration.days(150);// 30 days per month, so 5 months
    const PRIVATE_PRE_SALE_INTERVAL_DURATION = 1;// 17% monthly for 5 subsequent months from total amount
    const PRIVATE_PRE_SALE_INTERVAL_STAMP = 'M';// Interval is monthly
    const PRIVATE_PRE_SALE_REVOCABLE = true;// Vesting is revocable

    const messageHash = web3.utils.sha3('Freeway Token Beneficiary Only');
    const MESSAGE_HASH = toEthSignedMessageHash(messageHash);
    console.log(MESSAGE_HASH);

    beforeEach(async function () {

        this.TIME_START = (await time.latest()).add(time.duration.minutes(1));

        this.token = await FreewayToken.new();
        this.token.initialize(owner);

        // Vesting for Seed sale initiated
        const SEEDSALE_SIGNATURE = fixSignature(await web3.eth.sign(messageHash, SEED_SALE_BENEFICIARY));
        this.seed_sale_vesting = await VestingVault.new();
        this.seed_sale_vesting.initialize(
            SEED_SALE_BENEFICIARY, SEED_SALE_VESTING_AMOUNT,
            this.TIME_START, SEED_SALE_CLIFF_DURATION, SEED_SALE_TOTAL_DURATION,
            SEED_SALE_INTERVAL_DURATION, SEED_SALE_INTERVAL_STAMP, SEED_SALE_REVOCABLE,
            { from: owner });
        console.log("Called Before Each");
        await this.seed_sale_vesting.verifyAddress(MESSAGE_HASH, SEEDSALE_SIGNATURE,{ from: owner });

        // Token are minted for the vesting contracts
        await this.token.transfer(this.seed_sale_vesting.address, SEED_SALE_VESTING_AMOUNT, { from: owner });
        this.interval_in_seconds_for_seedsale = (await this.seed_sale_vesting.getCalculatedIntervalInSeconds(SEED_SALE_INTERVAL_DURATION, SEED_SALE_INTERVAL_STAMP));

    });

    describe('VestingVault', function () {

        context('1. Token Vesting For Seed Sale', function () {

            it('1.1 Should verify the vesting details fo seed sale', async function () {
                expect(await this.seed_sale_vesting.beneficiary()).to.equal(SEED_SALE_BENEFICIARY);
                expect(await this.seed_sale_vesting.vestingAmount()).to.be.bignumber.equal(SEED_SALE_VESTING_AMOUNT);
                expect(await this.seed_sale_vesting.start()).to.be.bignumber.equal(this.TIME_START);
                expect(await this.seed_sale_vesting.cliff()).to.be.bignumber.equal(this.TIME_START.add(SEED_SALE_CLIFF_DURATION));
                expect(await this.seed_sale_vesting.duration()).to.be.bignumber.equal(SEED_SALE_TOTAL_DURATION);
                expect((await this.seed_sale_vesting.interval()).toNumber()).to.equal(SEED_SALE_INTERVAL_DURATION);
                expect(await this.seed_sale_vesting.stamp()).to.equal(SEED_SALE_INTERVAL_STAMP);
                expect(await this.seed_sale_vesting.revocable()).to.equal(SEED_SALE_REVOCABLE);
                expect(await this.seed_sale_vesting.beneficiaryVerified()).to.equal(true);
            });

            it('1.2 cannot be released before cliff', async function () {
                // console.log("1.2 -> "+(await time.latest()));
                await expectRevert(this.seed_sale_vesting.release(this.token.address),
                    'VestingVault: you have not passed the lock period yet.'
                );
            });

            it('1.3 Should Verify the balance of vesting contract & benefeciary before & after vesting\'s release', async function () {

                // console.log("1.3 -> "+(await time.latest()));
                expect(await this.token.balanceOf(SEED_SALE_BENEFICIARY)).to.be.bignumber.equal(ZERO_BAL);
                expect(await this.token.balanceOf(this.seed_sale_vesting.address)).to.be.bignumber.equal(SEED_SALE_VESTING_AMOUNT);
                expect(await this.seed_sale_vesting.released(this.token.address)).to.be.bignumber.equal(ZERO_BAL);

                const expectedVesting = vestedAmount(
                    SEED_SALE_VESTING_AMOUNT,
                    await time.latest(),
                    this.TIME_START,
                    this.TIME_START.add(SEED_SALE_CLIFF_DURATION),
                    SEED_SALE_TOTAL_DURATION,
                    this.interval_in_seconds_for_seedsale,
                );

                expect(await this.token.balanceOf(SEED_SALE_BENEFICIARY)).to.be.bignumber.equal(expectedVesting);
                expect(await this.seed_sale_vesting.released(this.token.address)).to.be.bignumber.equal(expectedVesting);
            });

            it('1.4 can be released after cliff', async function () {
                await time.increaseTo(this.TIME_START.add(SEED_SALE_CLIFF_DURATION).add(time.duration.days(31)));
                // console.log("1.4 -> "+(await time.latest()));

                const { logs } = await this.seed_sale_vesting.release(this.token.address);
                expectEvent.inLogs(logs, 'TokensReleased', {
                    token: this.token.address,
                    amount: await this.token.balanceOf(SEED_SALE_BENEFICIARY),
                });
            });

            it('1.5 should release proper amount after interval', async function () {
                await time.increaseTo(this.TIME_START.add(SEED_SALE_CLIFF_DURATION).add(time.duration.days(31)));
                await this.seed_sale_vesting.release(this.token.address);

                // console.log("1.5 -> "+(await time.latest()));

                const expectedVesting = vestedAmount(
                    SEED_SALE_VESTING_AMOUNT,
                    await time.latest(),
                    this.TIME_START,
                    this.TIME_START.add(SEED_SALE_CLIFF_DURATION),
                    SEED_SALE_TOTAL_DURATION,
                    this.interval_in_seconds_for_seedsale,
                );
                // const expectedVesting = await this.seed_sale_vesting.getVestedAmountNow();

                expect(await this.token.balanceOf(SEED_SALE_BENEFICIARY)).to.be.bignumber.equal(expectedVesting);
                expect(await this.seed_sale_vesting.released(this.token.address)).to.be.bignumber.equal(expectedVesting);
            });

            it('1.6 should linearly release tokens during vesting period', async function () {
                // const vestingPeriod = this.duration.sub(await time.latest());
                const checkpoints = 4;
                // console.log("1.6 -> "+(await time.latest()));

                for (let i = 1; i <= checkpoints; i++) {
                    const now = (await time.latest()).add(this.interval_in_seconds_for_seedsale).add(time.duration.days(1));
                    await time.increaseTo(now);

                    // console.log("1.6 - "+i+" -> "+(await time.latest()));
                    await this.seed_sale_vesting.release(this.token.address);
                    // const expectedVesting = amount.mul(now.sub(this.start)).div(this.duration);
                    const expectedVesting = vestedAmount(
                        SEED_SALE_VESTING_AMOUNT,
                        await time.latest(),
                        this.TIME_START,
                        this.TIME_START.add(SEED_SALE_CLIFF_DURATION),
                        SEED_SALE_TOTAL_DURATION,
                        this.interval_in_seconds_for_seedsale,
                    );
                    // console.log("ReleasedAmount -> " + expectedVesting);

                    expect(await this.token.balanceOf(SEED_SALE_BENEFICIARY)).to.be.bignumber.equal(expectedVesting);
                    expect(await this.seed_sale_vesting.released(this.token.address)).to.be.bignumber.equal(expectedVesting);
                }
            });

            it('1.7 should have released all after end', async function () {
                await time.increaseTo(this.TIME_START.add(SEED_SALE_TOTAL_DURATION));
                await this.seed_sale_vesting.release(this.token.address);
                expect(await this.token.balanceOf(SEED_SALE_BENEFICIARY)).to.be.bignumber.equal(SEED_SALE_VESTING_AMOUNT);
                expect(await this.seed_sale_vesting.released(this.token.address)).to.be.bignumber.equal(SEED_SALE_VESTING_AMOUNT);
            });

            it('1.8 should be revoked by owner if revocable is set', async function () {
                const { logs } = await this.seed_sale_vesting.revoke(this.token.address, { from: owner });
                expectEvent.inLogs(logs, 'TokenVestingRevoked', { token: this.token.address });
                expect(await this.seed_sale_vesting.revoked(this.token.address)).to.equal(true);
            });

            it('1.9 should fail to be revoked by owner if revocable not set', async function () {
                this.tempVest = await VestingVault.new();
                this.tempVest.initialize(
                    SEED_SALE_BENEFICIARY, SEED_SALE_VESTING_AMOUNT,
                    this.TIME_START, SEED_SALE_CLIFF_DURATION, SEED_SALE_TOTAL_DURATION,
                    SEED_SALE_INTERVAL_DURATION, SEED_SALE_INTERVAL_STAMP, false, { from: owner }
                );

                await expectRevert(this.tempVest.revoke(this.token.address, { from: owner }),
                    'VestingVault: cannot revoke'
                );
            });

            it('1.10 should return the non-vested tokens when revoked by owner', async function () {
                await time.increaseTo(this.TIME_START.add(SEED_SALE_CLIFF_DURATION).add(this.interval_in_seconds_for_seedsale).add(time.duration.days(1)));

                let beforeRevoke = await this.token.balanceOf(owner);
                await this.seed_sale_vesting.revoke(this.token.address, { from: owner });
                const expectedAmt = beforeRevoke.add(SEED_SALE_VESTING_AMOUNT.sub((await this.token.balanceOf(this.seed_sale_vesting.address))));
                expect(await this.token.balanceOf(owner)).to.be.bignumber.equal(expectedAmt);
            });

            it('1.11 should keep the vested tokens when revoked by owner', async function () {
                await time.increaseTo(this.TIME_START.add(SEED_SALE_CLIFF_DURATION).add(this.interval_in_seconds_for_seedsale).add(time.duration.days(1)));

                const vestedPre = vestedAmount(
                    SEED_SALE_VESTING_AMOUNT,
                    await time.latest(),
                    this.TIME_START,
                    this.TIME_START.add(SEED_SALE_CLIFF_DURATION),
                    SEED_SALE_TOTAL_DURATION,
                    this.interval_in_seconds_for_seedsale,
                );

                await this.seed_sale_vesting.revoke(this.token.address, { from: owner });

                //Still after revoke the vesting contract should have the vestedPre Amount.
                expect(await this.token.balanceOf(this.seed_sale_vesting.address)).to.be.bignumber.equal(vestedPre);

                await this.seed_sale_vesting.release(this.token.address);

                //After release the balance should be transfered from vesting contract to beneficiary.
                expect(await this.token.balanceOf(SEED_SALE_BENEFICIARY)).to.be.bignumber.equal(vestedPre);
            });

            it('1.12 should fail to be revoked a second time', async function () {
                await this.seed_sale_vesting.revoke(this.token.address, { from: owner });
                await expectRevert(this.seed_sale_vesting.revoke(this.token.address, { from: owner }),
                    'VestingVault: token already revoked'
                );
            });

            it('1.13 should release proper amount after interval', async function () {

                // Vesting for Private pre sale initiated
                const PRIVATE_PRESALE_SIGNATURE = fixSignature(await web3.eth.sign(messageHash, PRIVATE_PRE_SALE_BENEFICIARY));
                this.private_pre_sale_vesting = await VestingVault.new();
                this.private_pre_sale_vesting.initialize(
                    PRIVATE_PRE_SALE_BENEFICIARY, PRIVATE_PRE_SALE_VESTING_AMOUNT,
                    this.TIME_START, PRIVATE_PRE_SALE_CLIFF_DURATION, PRIVATE_PRE_SALE_TOTAL_DURATION,
                    PRIVATE_PRE_SALE_INTERVAL_DURATION, PRIVATE_PRE_SALE_INTERVAL_STAMP, PRIVATE_PRE_SALE_REVOCABLE,
                    { from: owner });
                await this.private_pre_sale_vesting.verifyAddress(MESSAGE_HASH, PRIVATE_PRESALE_SIGNATURE,{ from: owner });
                await this.token.transfer(this.private_pre_sale_vesting.address, PRIVATE_PRE_SALE_VESTING_AMOUNT, { from: owner });
                this.interval_in_seconds_for_privatepresale = (await this.private_pre_sale_vesting.getCalculatedIntervalInSeconds(PRIVATE_PRE_SALE_INTERVAL_DURATION, PRIVATE_PRE_SALE_INTERVAL_STAMP));

                await time.increaseTo(this.TIME_START.add(SEED_SALE_CLIFF_DURATION).add(time.duration.days(31)));
                
                // The time interval for both seed sale & private pre sale is 1 month only, so here i will release both of them 
                await this.seed_sale_vesting.release(this.token.address);
                await this.private_pre_sale_vesting.release(this.token.address);

                // console.log("1.5 -> "+(await time.latest()));

                const expectedVesting = vestedAmount(
                    SEED_SALE_VESTING_AMOUNT,
                    await time.latest(),
                    this.TIME_START,
                    this.TIME_START.add(SEED_SALE_CLIFF_DURATION),
                    SEED_SALE_TOTAL_DURATION,
                    this.interval_in_seconds_for_seedsale,
                );
                const expectedVesting_privatepresale = vestedAmount(
                    PRIVATE_PRE_SALE_VESTING_AMOUNT,
                    await time.latest(),
                    this.TIME_START,
                    this.TIME_START.add(PRIVATE_PRE_SALE_CLIFF_DURATION),
                    PRIVATE_PRE_SALE_TOTAL_DURATION,
                    this.interval_in_seconds_for_privatepresale,
                );

                expect(await this.token.balanceOf(SEED_SALE_BENEFICIARY)).to.be.bignumber.equal(expectedVesting);
                expect(await this.seed_sale_vesting.released(this.token.address)).to.be.bignumber.equal(expectedVesting);
                expect(await this.token.balanceOf(PRIVATE_PRE_SALE_BENEFICIARY)).to.be.bignumber.equal(expectedVesting_privatepresale);
                expect(await this.private_pre_sale_vesting.released(this.token.address)).to.be.bignumber.equal(expectedVesting_privatepresale);
            });
        // });

        // context('ECDSA Verify Vesting Contract\'s Beneficiary', function () {

            it('1.14 should fail to verify the beneficiary address with invalid address signature', async function () {

                const SEEDSALE_SIGNATURE = await web3.eth.sign(messageHash, SEED_SALE_BENEFICIARY);
                this.tempVest = await VestingVault.new();
                this.tempVest.initialize(
                    this.token.address, SEED_SALE_VESTING_AMOUNT,
                    this.TIME_START, SEED_SALE_CLIFF_DURATION, SEED_SALE_TOTAL_DURATION,
                    SEED_SALE_INTERVAL_DURATION, SEED_SALE_INTERVAL_STAMP, false, { from: owner });
                await expectRevert(this.tempVest.verifyAddress(MESSAGE_HASH, SEEDSALE_SIGNATURE,{ from: owner }),
                    'VestingVault: ECDSA Recover Failed, Beneficiary Address Signature is invalid'
                );

            });

            it('1.15 if beneficiary address not verfied then can\' release tokens', async function () {

                const SEEDSALE_SIGNATURE = await web3.eth.sign(messageHash, SEED_SALE_BENEFICIARY);
                this.tempVest = await VestingVault.new();
                this.tempVest.initialize(
                    this.token.address, SEED_SALE_VESTING_AMOUNT,
                    this.TIME_START, SEED_SALE_CLIFF_DURATION, SEED_SALE_TOTAL_DURATION,
                    SEED_SALE_INTERVAL_DURATION, SEED_SALE_INTERVAL_STAMP, true, { from: owner });

                await expectRevert(this.tempVest.release(this.token.address),
                    'VestingVault: Beneficiary signature not yet verified'
                );

            });

            function vestedAmount(total, now, start, cliffDuration, duration, interval) {
                return (now.lt(cliffDuration)) ? new BN(0) : (now.sub(start)).div(interval).mul(interval).mul(total).div(duration);
            }

        });

    });

    function toEthSignedMessageHash(messageHex) {
        const messageBuffer = Buffer.from(messageHex.substring(2), 'hex');
        const prefix = Buffer.from(`\u0019Ethereum Signed Message:\n${messageBuffer.length}`);
        return web3.utils.sha3(Buffer.concat([prefix, messageBuffer]));
    }

    function fixSignature(signature) {
        // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
        // signature malleability if version is 0/1
        // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
        let v = parseInt(signature.slice(130, 132), 16);
        if (v < 27) {
            v += 27;
        }
        const vHex = v.toString(16);
        return signature.slice(0, 130) + vHex;
    }

});