App = {
  web3Provider: null,
  contracts: {},
  privatepresaleVesting: {},
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
    $.getJSON("VestingVaultPrivatePreSale.json", function (vestingVault) {
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

      console.log(App.privatepresaleVesting.owner = (await App.contracts.VestingVaultInstance.owner()));
      console.log(App.privatepresaleVesting.beneficiary = (await App.contracts.VestingVaultInstance.beneficiary()));
      console.log(App.privatepresaleVesting.start = (await App.contracts.VestingVaultInstance.start()).toNumber());
      console.log(App.privatepresaleVesting.cliff = (await App.contracts.VestingVaultInstance.cliff()).toNumber());
      console.log(App.privatepresaleVesting.duration = (await App.contracts.VestingVaultInstance.duration()).toNumber());
      console.log(App.privatepresaleVesting.interval = (await App.contracts.VestingVaultInstance.interval()).toNumber());
      console.log(App.privatepresaleVesting.totalAmount = (await App.contracts.VestingVaultInstance.totalAmount()) / (10 ** 18).toString());
      console.log(App.privatepresaleVesting.vestingAmount = (await App.contracts.VestingVaultInstance.vestingAmount()) / (10 ** 18).toString());
      console.log(App.privatepresaleVesting.intervalVested = (await App.contracts.VestingVaultInstance.intervalVested()) / (10 ** 18).toString());
      console.log(App.privatepresaleVesting.released = (await App.contracts.VestingVaultInstance.released(App.contracts.TokenInstance.address)) / (10 ** 18).toString());

      const stamp = (await App.contracts.VestingVaultInstance.stamp());
      const interval_in_sec = (await App.contracts.VestingVaultInstance.getCalculatedIntervalInSeconds(App.privatepresaleVesting.interval, stamp)).toNumber()
      const releasable = App.findVested(
        App.privatepresaleVesting.vestingAmount, App.privatepresaleVesting.start,
        (App.privatepresaleVesting.cliff),
        (App.privatepresaleVesting.duration),
        interval_in_sec);

      console.log(App.privatepresaleVesting.releasable = releasable);
      console.log(App.privatepresaleVesting.revocable = (await App.contracts.VestingVaultInstance.revocable()));
      console.log(App.user.balance = (await App.contracts.TokenInstance.balanceOf(App.account)) / (10 ** 18).toString());

      let userRole = '';
      if (App.account === App.privatepresaleVesting.owner) {
        userRole = ' <i style="color: #0819e2;">(User is the Owner)</i>';
      }else if (App.account === App.privatepresaleVesting.beneficiary){
        userRole = ' <i style="color: #0819e2;">(User is the Beneficiary)</i>';
      }

      $('#accountAddress').html("<strong style='font-size: 18px;'>Private Presale Vesting</strong>"+userRole+" <br> Vesting's Address: " + App.contracts.VestingVaultInstance.address + "<br>Your Account: " + App.account + '<br>Balance Available: ' + App.user.balance + ' ' + tokenSymbol);

      $('#vestingOwner').html(App.privatepresaleVesting.owner);
      $('#vestingBeneficiary').html(App.privatepresaleVesting.beneficiary);
      $('#vestingStart').html(App.formatDate(App.privatepresaleVesting.start));
      $('#vestingCliff').html(App.formatDate(App.privatepresaleVesting.cliff));
      $('#vestingEnd').html(App.formatDate(App.privatepresaleVesting.duration + App.privatepresaleVesting.start));
      $('#vestingTotal').html(App.privatepresaleVesting.vestingAmount + ' '+ tokenSymbol);
      $('#vestingReleased').html(App.privatepresaleVesting.released + ' ' + tokenSymbol);
      $('#vestingReleasable').html(App.privatepresaleVesting.releasable+' '+tokenSymbol + ' <button onclick="App.release(); return false;">Release</button>');
      // $('#vestingRevocable').html(App.privatepresaleVesting.revocable == true ? 'Yes  <button onclick="App.revoke(); return false;">Revoke</button>' : 'No');

      if (App.privatepresaleVesting.revocable) {
        if (App.privatepresaleVesting.owner == App.account) {
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