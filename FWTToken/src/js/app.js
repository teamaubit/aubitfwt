App = {
  web3Provider: null,
  contracts: {},
  seedsaleVesting: {},
  account: '0x0',
  user: {},
  loading: false,
  tokenPrice: 10000000000000,
  tokensSold: 0,
  tokensAvailable: 750000,

  init: function () {
    console.log("App initialized...")
    return App.initWeb3();
  },

  initWeb3: function () {
    if (typeof web3 !== 'undefined') {
      // If a web3 instance is already provided by Meta Mask.
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // Specify default instance if no web3 instance provided
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContracts();
  },

  initContracts: function () {
    $.getJSON("VestingVault.json", function (vestingVault) {
      App.contracts.VestingVault = TruffleContract(vestingVault);
      App.contracts.VestingVault.setProvider(App.web3Provider);
      App.contracts.VestingVault.deployed().then(function (vestingVault) {
        App.contracts.VestingVaultInstance = vestingVault;
        // console.log("VestingVault Address:", vestingVault.address);
      });
    }).done(function () {
      $.getJSON("FreewayToken.json", function (mFTToken) {
        App.contracts.FreewayToken = TruffleContract(mFTToken);
        App.contracts.FreewayToken.setProvider(App.web3Provider);
        App.contracts.FreewayToken.deployed().then(function (token) {
          App.contracts.TokenInstance = token;
          // console.log("MFTToken Address:", mFTToken.address);
        });

        // App.listenForEvents();
        return App.render();
      });
    })
  },

  // Listen for events emitted from the contract
  listenForEvents: function () {
    App.contracts.VestingVault.deployed().then(function (instance) {
      instance.Sell({}, {
        fromBlock: 0,
        toBlock: 'latest',
      }).watch(function (error, event) {
        console.log("event triggered", event);
        App.render();
      })
    })
  },

  render: function () {

    if (App.loading) {
      return;
    }
    App.loading = true;
    var loader = $('#loader');
    var content = $('#content');

    loader.show();
    content.hide();

    // Load account data
    web3.eth.getCoinbase(function (err, account) {
      if (err === null) {
        App.account = account;
      }
    })

    App.contracts.VestingVault.deployed().then(async function (instance) {

      $('#tokenName').html((await App.contracts.TokenInstance.name()));
      $('#tokenAddress').html("Contract Address: "+ App.contracts.TokenInstance.address);
      const tokenSymbol = (await App.contracts.TokenInstance.symbol());

      console.log(App.seedsaleVesting.owner = (await App.contracts.VestingVaultInstance.owner()));
      console.log(App.seedsaleVesting.beneficiary = (await App.contracts.VestingVaultInstance.beneficiary()));
      console.log(App.seedsaleVesting.start = (await App.contracts.VestingVaultInstance.start()).toNumber());
      console.log(App.seedsaleVesting.cliff = (await App.contracts.VestingVaultInstance.cliff()).toNumber());
      console.log(App.seedsaleVesting.duration = (await App.contracts.VestingVaultInstance.duration()).toNumber());
      console.log(App.seedsaleVesting.interval = (await App.contracts.VestingVaultInstance.interval()).toNumber());
      console.log(App.seedsaleVesting.totalAmount = (await App.contracts.VestingVaultInstance.totalAmount()) / (10 ** 18).toString());
      console.log(App.seedsaleVesting.vestingAmount = (await App.contracts.VestingVaultInstance.vestingAmount()) / (10 ** 18).toString());
      console.log(App.seedsaleVesting.intervalVested = (await App.contracts.VestingVaultInstance.intervalVested()) / (10 ** 18).toString());
      console.log(App.seedsaleVesting.released = (await App.contracts.VestingVaultInstance.released(App.contracts.TokenInstance.address)) / (10 ** 18).toString());

      const stamp = (await App.contracts.VestingVaultInstance.stamp());
      const interval_in_sec = (await App.contracts.VestingVaultInstance.getCalculatedIntervalInSeconds(App.seedsaleVesting.interval, stamp)).toNumber()
      const releasable = App.findVested(
        App.seedsaleVesting.vestingAmount, App.seedsaleVesting.start,
        (App.seedsaleVesting.cliff),
        (App.seedsaleVesting.duration),
        interval_in_sec);

      console.log(App.seedsaleVesting.releasable = releasable);
      console.log(App.seedsaleVesting.revocable = (await App.contracts.VestingVaultInstance.revocable()));
      console.log(App.user.balance = (await App.contracts.TokenInstance.balanceOf(App.account)) / (10 ** 18).toString());

      let userRole = '';
      if (App.account === App.seedsaleVesting.owner) {
        userRole = ' <i style="color: #0819e2;">(User is the Owner)</i>';
      }else if (App.account === App.seedsaleVesting.beneficiary){
        userRole = ' <i style="color: #0819e2;">(User is the Beneficiary)</i>';
      }

      $('#accountAddress').html("<strong style='font-size: 18px;'>SeedSale Vesting</strong>"+userRole+" <br> Vesting's Address: " + App.contracts.VestingVaultInstance.address + "<br>Your Account: " + App.account + '<br>Balance Available: ' + App.user.balance + ' ' + tokenSymbol);

      $('#vestingOwner').html(App.seedsaleVesting.owner);
      $('#vestingBeneficiary').html(App.seedsaleVesting.beneficiary);
      $('#vestingStart').html(App.formatDate(App.seedsaleVesting.start));
      $('#vestingCliff').html(App.formatDate(App.seedsaleVesting.cliff));
      $('#vestingEnd').html(App.formatDate(App.seedsaleVesting.duration + App.seedsaleVesting.start));
      $('#vestingTotal').html(App.seedsaleVesting.vestingAmount + ' '+ tokenSymbol);
      $('#vestingReleased').html(App.seedsaleVesting.released + ' ' + tokenSymbol);
      $('#vestingReleasable').html(App.seedsaleVesting.releasable+' '+tokenSymbol + ' <button onclick="App.release(); return false;">Release</button>');
      // $('#vestingRevocable').html(App.seedsaleVesting.revocable == true ? 'Yes  <button onclick="App.revoke(); return false;">Revoke</button>' : 'No');

      if (App.seedsaleVesting.revocable) {
        if (App.seedsaleVesting.owner == App.account) {
          $('#vestingRevocable').html('Yes  <button onclick="App.revoke(); return false;">Revoke</button>');
        } else {
          $('#vestingRevocable').html('Yes');
        }
      } else {
        $('#vestingRevocable').html('No');
      }

      loader.hide();
      content.show();

    });
  },

  formatDate: function (date) {
    if (!date) return
    const milliseconds = date * 1000
    return moment(milliseconds).format("MMMM Do YYYY, h:mm:ss a (dddd)")
  },

  release: async function () {

    $('#content').hide();
    $('#loader').show();
    await App.contracts.VestingVaultInstance.release(App.contracts.TokenInstance.address, { from: App.account })
    window.location.reload(true);
  },

  revoke: async function () {

    $('#content').hide();
    $('#loader').show();
    await App.contracts.VestingVaultInstance.revoke(App.contracts.TokenInstance.address, { from: App.account })
    window.location.reload(true);
  },

  findVested: function vestedAmount(total, start, cliffDuration, duration, interval) {
    var now = new Date().getTime() / 1000;
    return (now < cliffDuration) ? 0 : (((((now - start) / (interval)) * (interval)) * (total)) / (duration));
  }
}

$(function () {
  $(window).load(function () {
    App.init();
  })
});