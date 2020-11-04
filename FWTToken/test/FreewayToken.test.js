const { BN, constants, expectRevert } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

const FreewayToken = artifacts.require('FreewayToken');
const ECDSAMock = artifacts.require('ECDSAMock');

contract('FreewayToken', accounts => {

    const [creator, ben1, ...others] = accounts;
    const _decimals_zeros = '000000000000000000';

    beforeEach(async function () {
        this.token = await FreewayToken.new();
        this.token.initialize(creator);
    });

    context('Freeway Token details', function () {

        it('has a name', async function () {
            expect(await this.token.name()).to.equal('FreewayToken');
        });

        it('has a symbol', async function () {
            expect(await this.token.symbol()).to.equal('FWT');
        });

        it('has 18 decimals', async function () {
            expect(await this.token.decimals()).to.be.bignumber.equal('18');
        });

        it('assigns the initial total supply to the creator', async function () {
            const totalSupply = await this.token.totalSupply();
            const creatorBalance = await this.token.balanceOf(creator);
            expect(creatorBalance).to.be.bignumber.equal(totalSupply);
        });

    });

    context('Freeway Token Additional Improvements', function () {

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

});
