require('dotenv').config({path:'project-config.env'})
var HDWalletProvider = require("truffle-hdwallet-provider");
//var mnemonic = "tackle deer pause multiply mandate canal spatial fiscal lawn night deal adult";
var mnemonic = process.env.NEMONIC;
var tokenKey = process.env.INFURA_PROJECT_ID;
module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
    },
    rinkeby: {
      host: "localhost",
      provider: function () {
        return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/v3/"+tokenKey);
      },
      network_id: 4
      , gas: 6700000
      , gasPrice: 10000000000
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/v3/"+tokenKey)
      },
      network_id: 3
      , gas: 4600000
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "^0.5.5",    // Fetch exact version from solc-bin (default: truffle's version)
      optimizer: {
        enabled: true,
        runs: 200
      }
    },
  },
};
