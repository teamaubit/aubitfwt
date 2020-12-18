const { BN, constants, expectRevert } = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const FreewayPreStakingRewardToken = artifacts.require('FreewayPreStakingRewardToken');

contract('FreewayPreStakingRewardToken', accounts => {

    const [creator, ben1, ...others] = accounts;
    const _decimals_zeros = '000000000000000000';

    beforeEach(async function () {
        this.token = await FreewayPreStakingRewardToken.new();
        this.token.initialize(creator);
    });

    context('Freeway Pre Staking Reward Token details', function () {

        it('has a name', async function () {
            expect(await this.token.name()).to.equal('FreewayPreStakingReward');
        });

        it('has a symbol', async function () {
            expect(await this.token.symbol()).to.equal('FPR');
        });

        it('has 18 decimals', async function () {
            expect(await this.token.decimals()).to.be.bignumber.equal('18');
        });

        it('assigns the initial total supply to the creator', async function () {
            const totalSupply = await this.token.totalSupply();
            const creatorBalance = await this.token.balanceOf(creator);
            this.totalSupply = totalSupply;
            expect(creatorBalance).to.be.bignumber.equal(totalSupply);
        });

    });

    context('Freeway Pre Staking Reward Token Additional Improvements', function () {

        it('transfers with proper amount', async function () {
            const amt = new BN('100' + _decimals_zeros);
            await this.token.transfer(ben1, amt, { from: creator });
            expect(await this.token.balanceOf(ben1)).to.be.bignumber.equal(amt);
        });

        it('should not have a (from) short address 0xab1234', async function () {
            const amt = new BN('10' + _decimals_zeros);
            await expectRevert(this.token.transfer(ben1, amt, { from: "0xab1234" }), "invalid, the capitalization checksum test failed");
        });

        it('should not have a (to) short address 0xab1234', async function () {
            const amt = new BN('10' + _decimals_zeros);
            await expectRevert(this.token.transfer("0xab1234", amt, { from: creator }), "invalid address");
        });

    });

    context('Freeway Pre Staking Reward Token Minter Roles', function () {

        it('Only the token creator has the minter role', async function () {
            expect(await this.token.isMinter(creator)).to.equal(true);
            expect(await this.token.isMinter(ben1)).to.equal(false);
        });

        it('Only the Minter can add Minter Role to new Address', async function () {
            
            expect(await this.token.isMinter(ben1)).to.equal(false);
            
            await expectRevert(this.token.addMinter(ben1, { from: ben1 }), "MinterRole: caller does not have the Minter role");
            
            await this.token.addMinter(ben1, { from: creator });

            expect(await this.token.isMinter(ben1)).to.equal(true);
        });

        it('Only the User/Wallet with Minter role can issue/mint new tokens', async function () {

            // Current Supply before mining new tokens
            const preMiningTotalSupply = await this.token.totalSupply();
            // The Amount of tokens to be mined
            const amt = new BN('100000' + _decimals_zeros);
            // Minting of new tokens will fail 
            await expectRevert(this.token.mint(ben1, amt, { from: ben1 }), "MinterRole: caller does not have the Minter role");
            expect(await this.token.totalSupply()).to.be.bignumber.equal(preMiningTotalSupply);
            // We can mint tokens which has minter role.
            await this.token.mint(ben1, amt, { from: creator });
            // Current Supply after mining new tokens
            const postMiningTotalSupply = await this.token.totalSupply();
            expect(postMiningTotalSupply).to.be.bignumber.equal(preMiningTotalSupply.add(amt));
        });

    });

    context('Freeway Pre Staking Reward Token Burner Roles', function () {

        it('Only the token creator has the Burner role', async function () {
            expect(await this.token.isBurner(creator)).to.equal(true);
            expect(await this.token.isBurner(ben1)).to.equal(false);
        });

        it('Only the Burner can add Burner Role to new Address', async function () {
            
            expect(await this.token.isBurner(ben1)).to.equal(false);
            
            await expectRevert(this.token.addBurner(ben1, { from: ben1 }), "BurnerRole: caller does not have the Burner role");
            
            await this.token.addBurner(ben1, { from: creator });

            expect(await this.token.isBurner(ben1)).to.equal(true);
        });

        it('Only the User/Wallet with Burner role can burn tokens of a address', async function () {

            // Current Supply before burning tokens
            const preBurningTotalSupply = await this.token.totalSupply();
            // The Amount of tokens to be mined
            const amt = new BN('100000' + _decimals_zeros);
            await this.token.transfer(ben1, amt, { from: creator });
            expect(await this.token.balanceOf(ben1)).to.be.bignumber.equal(amt);
            // Burning of tokens will fail 
            await expectRevert(this.token.burnToken(ben1, amt, { from: ben1 }), "BurnerRole: caller does not have the Burner role");
            expect(await this.token.totalSupply()).to.be.bignumber.equal(preBurningTotalSupply);
            // We can burn tokens with address which has burner role.
            await this.token.burnToken(ben1, amt, { from: creator });
            // Current Supply after mining new tokens
            const postBurningTotalSupply = await this.token.totalSupply();
            expect(postBurningTotalSupply).to.be.bignumber.equal(preBurningTotalSupply.sub(amt));
        });

    });

    context('Freeway Pre Staking Reward Token Deployer Roles', function () {

        it('Only the token creator has the Deployer role', async function () {
            expect(await this.token.isDeployer(creator)).to.equal(true);
            expect(await this.token.isDeployer(ben1)).to.equal(false);
        });

        it('Only the Deployer can recover stranded tokens from Freeway PreStaking Reward Token Contract', async function () {
            
            const amt = new BN('100000' + _decimals_zeros);
            const preTransferCreatorBalance = await this.token.balanceOf(creator);
           
            // Transfer tokens to Freeway PreStaking Contract
            await this.token.transfer(this.token.address, amt, { from: creator });
            expect(await this.token.balanceOf(this.token.address)).to.be.bignumber.equal(amt);
            expect(await this.token.balanceOf(creator)).to.be.bignumber.equal(preTransferCreatorBalance.sub(amt));

            // Revoke tokens from Freeway PreStaking Contract using Deployer Role
            await this.token.recoverERC20(this.token.address, creator, amt, { from: creator });
            expect(await this.token.balanceOf(this.token.address)).to.be.bignumber.equal(new BN(0));
            expect(await this.token.balanceOf(creator)).to.be.bignumber.equal(preTransferCreatorBalance);

        });

    });

});
