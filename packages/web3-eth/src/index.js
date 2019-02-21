/*
 This file is part of web3.js.

 web3.js is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 web3.js is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * @file index.js
 * @author Fabian Vogelsteller <fabian@ethereum.org>
 * @date 2017
 */

"use strict";

var _ = require('underscore');
var core = require('web3-core');
var helpers = require('web3-core-helpers');
var Subscriptions = require('web3-core-subscriptions').subscriptions;
var Method = require('web3-core-method');
var utils = require('web3-utils');
var Net = require('web3-net');

var Personal = require('web3-eth-personal');
var BaseContract = require('web3-eth-contract');
var Iban = require('web3-eth-iban');
var Accounts = require('web3-eth-accounts');
var abi = require('web3-eth-abi');

var getNetworkType = require('./getNetworkType.js');
var formatter = helpers.formatters;


var blockCall = function (args) {
    return (_.isString(args[0]) && args[0].indexOf('0x') === 0) ? "owt_getBlockByHash" : "owt_getBlockByNumber";
};

var transactionFromBlockCall = function (args) {
    return (_.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'owt_getTransactionByBlockHashAndIndex' : 'owt_getTransactionByBlockNumberAndIndex';
};

var uncleCall = function (args) {
    return (_.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'owt_getUncleByBlockHashAndIndex' : 'owt_getUncleByBlockNumberAndIndex';
};

var getBlockTransactionCountCall = function (args) {
    return (_.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'owt_getBlockTransactionCountByHash' : 'owt_getBlockTransactionCountByNumber';
};

var uncleCountCall = function (args) {
    return (_.isString(args[0]) && args[0].indexOf('0x') === 0) ? 'owt_getUncleCountByBlockHash' : 'owt_getUncleCountByBlockNumber';
};


var Eth = function Eth() {
    var _this = this;

    // sets _requestmanager
    core.packageInit(this, arguments);

    // overwrite setProvider
    var setProvider = this.setProvider;
    this.setProvider = function () {
        setProvider.apply(_this, arguments);
        _this.net.setProvider.apply(_this, arguments);
        _this.personal.setProvider.apply(_this, arguments);
        _this.accounts.setProvider.apply(_this, arguments);
        _this.Contract.setProvider(_this.currentProvider, _this.accounts);
    };


    var defaultAccount = null;
    var defaultBlock = 'latest';

    Object.defineProperty(this, 'defaultAccount', {
        get: function () {
            return defaultAccount;
        },
        set: function (val) {
            if(val) {
                defaultAccount = utils.toChecksumAddress(formatter.inputAddressFormatter(val));
            }

            // also set on the Contract object
            _this.Contract.defaultAccount = defaultAccount;
            _this.personal.defaultAccount = defaultAccount;

            // update defaultBlock
            methods.forEach(function(method) {
                method.defaultAccount = defaultAccount;
            });

            return val;
        },
        enumerable: true
    });
    Object.defineProperty(this, 'defaultBlock', {
        get: function () {
            return defaultBlock;
        },
        set: function (val) {
            defaultBlock = val;
            // also set on the Contract object
            _this.Contract.defaultBlock = defaultBlock;
            _this.personal.defaultBlock = defaultBlock;

            // update defaultBlock
            methods.forEach(function(method) {
                method.defaultBlock = defaultBlock;
            });

            return val;
        },
        enumerable: true
    });


    this.clearSubscriptions = _this._requestManager.clearSubscriptions;

    // add net
    this.net = new Net(this.currentProvider);
    // add chain detection
    this.net.getNetworkType = getNetworkType.bind(this);

    // add accounts
    this.accounts = new Accounts(this.currentProvider);

    // add personal
    this.personal = new Personal(this.currentProvider);
    this.personal.defaultAccount = this.defaultAccount;

    // create a proxy Contract type for this instance, as a Contract's provider
    // is stored as a class member rather than an instance variable. If we do
    // not create this proxy type, changing the provider in one instance of
    // web3-eth would subsequently change the provider for _all_ contract
    // instances!
    var Contract = function Contract() {
        BaseContract.apply(this, arguments);
    };

    Contract.setProvider = function() {
        BaseContract.setProvider.apply(this, arguments);
    };

    // make our proxy Contract inherit from web3-eth-contract so that it has all
    // the right functionality and so that instanceof and friends work properly
    Contract.prototype = Object.create(BaseContract.prototype);
    Contract.prototype.constructor = Contract;

    // add contract
    this.Contract = Contract;
    this.Contract.defaultAccount = this.defaultAccount;
    this.Contract.defaultBlock = this.defaultBlock;
    this.Contract.setProvider(this.currentProvider, this.accounts);

    // add IBAN
    this.Iban = Iban;

    // add ABI
    this.abi = abi;


    var methods = [
        new Method({
            name: 'getProtocolVersion',
            call: 'owt_protocolVersion',
            params: 0
        }),
        new Method({
            name: 'getCoinbase',
            call: 'owt_coinbase',
            params: 0
        }),
        new Method({
            name: 'isMining',
            call: 'owt_mining',
            params: 0
        }),
        new Method({
            name: 'getHashrate',
            call: 'owt_hashrate',
            params: 0,
            outputFormatter: utils.hexToNumber
        }),
        new Method({
            name: 'isSyncing',
            call: 'owt_syncing',
            params: 0,
            outputFormatter: formatter.outputSyncingFormatter
        }),
        new Method({
            name: 'getGasPrice',
            call: 'owt_gasPrice',
            params: 0,
            outputFormatter: formatter.outputBigNumberFormatter
        }),
        new Method({
            name: 'getAccounts',
            call: 'owt_accounts',
            params: 0,
            outputFormatter: utils.toChecksumAddress
        }),
        new Method({
            name: 'getBlockNumber',
            call: 'owt_blockNumber',
            params: 0,
            outputFormatter: utils.hexToNumber
        }),
        new Method({
            name: 'getBalance',
            call: 'owt_getBalance',
            params: 2,
            inputFormatter: [formatter.inputAddressFormatter, formatter.inputDefaultBlockNumberFormatter],
            outputFormatter: formatter.outputBigNumberFormatter
        }),
        new Method({
            name: 'getStorageAt',
            call: 'owt_getStorageAt',
            params: 3,
            inputFormatter: [formatter.inputAddressFormatter, utils.numberToHex, formatter.inputDefaultBlockNumberFormatter]
        }),
        new Method({
            name: 'getCode',
            call: 'owt_getCode',
            params: 2,
            inputFormatter: [formatter.inputAddressFormatter, formatter.inputDefaultBlockNumberFormatter]
        }),
        new Method({
            name: 'getBlock',
            call: blockCall,
            params: 2,
            inputFormatter: [formatter.inputBlockNumberFormatter, function (val) { return !!val; }],
            outputFormatter: formatter.outputBlockFormatter
        }),
        new Method({
            name: 'getUncle',
            call: uncleCall,
            params: 2,
            inputFormatter: [formatter.inputBlockNumberFormatter, utils.numberToHex],
            outputFormatter: formatter.outputBlockFormatter,

        }),
        new Method({
            name: 'getBlockTransactionCount',
            call: getBlockTransactionCountCall,
            params: 1,
            inputFormatter: [formatter.inputBlockNumberFormatter],
            outputFormatter: utils.hexToNumber
        }),
        new Method({
            name: 'getBlockUncleCount',
            call: uncleCountCall,
            params: 1,
            inputFormatter: [formatter.inputBlockNumberFormatter],
            outputFormatter: utils.hexToNumber
        }),
        new Method({
            name: 'getTransaction',
            call: 'owt_getTransactionByHash',
            params: 1,
            inputFormatter: [null],
            outputFormatter: formatter.outputTransactionFormatter
        }),
        new Method({
            name: 'getTransactionFromBlock',
            call: transactionFromBlockCall,
            params: 2,
            inputFormatter: [formatter.inputBlockNumberFormatter, utils.numberToHex],
            outputFormatter: formatter.outputTransactionFormatter
        }),
        new Method({
            name: 'getTransactionReceipt',
            call: 'owt_getTransactionReceipt',
            params: 1,
            inputFormatter: [null],
            outputFormatter: formatter.outputTransactionReceiptFormatter
        }),
        new Method({
            name: 'getTransactionCount',
            call: 'owt_getTransactionCount',
            params: 2,
            inputFormatter: [formatter.inputAddressFormatter, formatter.inputDefaultBlockNumberFormatter],
            outputFormatter: utils.hexToNumber
        }),
        new Method({
            name: 'sendSignedTransaction',
            call: 'owt_sendRawTransaction',
            params: 1,
            inputFormatter: [null]
        }),
        new Method({
            name: 'signTransaction',
            call: 'owt_signTransaction',
            params: 1,
            inputFormatter: [formatter.inputTransactionFormatter]
        }),
        new Method({
            name: 'sendTransaction',
            call: 'owt_sendTransaction',
            params: 1,
            inputFormatter: [formatter.inputTransactionFormatter]
        }),
        new Method({
            name: 'sign',
            call: 'owt_sign',
            params: 2,
            inputFormatter: [formatter.inputSignFormatter, formatter.inputAddressFormatter],
            transformPayload: function (payload) {
                payload.params.reverse();
                return payload;
            }
        }),
        new Method({
            name: 'call',
            call: 'owt_call',
            params: 2,
            inputFormatter: [formatter.inputCallFormatter, formatter.inputDefaultBlockNumberFormatter]
        }),
        new Method({
            name: 'estimateGas',
            call: 'owt_estimateGas',
            params: 1,
            inputFormatter: [formatter.inputCallFormatter],
            outputFormatter: utils.hexToNumber
        }),
        new Method({
            name: 'getCompilers',
            call: 'owt_getCompilers',
            params: 0
        }),
        new Method({
            name: 'compile.solidity',
            call: 'owt_compileSolidity',
            params: 1
        }),
        new Method({
            name: 'compile.lll',
            call: 'owt_compileLLL',
            params: 1
        }),
        new Method({
            name: 'compile.serpent',
            call: 'owt_compileSerpent',
            params: 1
        }),
        new Method({
            name: 'submitWork',
            call: 'owt_submitWork',
            params: 3
        }),
        new Method({
            name: 'getWork',
            call: 'owt_getWork',
            params: 0
        }),
        new Method({
            name: 'getPastLogs',
            call: 'owt_getLogs',
            params: 1,
            inputFormatter: [formatter.inputLogFormatter],
            outputFormatter: formatter.outputLogFormatter
        }),

        // subscriptions
        new Subscriptions({
            name: 'subscribe',
            type: 'eth',
            subscriptions: {
                'newBlockHeaders': {
                    // TODO rename on RPC side?
                    subscriptionName: 'newHeads', // replace subscription with this name
                    params: 0,
                    outputFormatter: formatter.outputBlockFormatter
                },
                'pendingTransactions': {
                    subscriptionName: 'newPendingTransactions', // replace subscription with this name
                    params: 0
                },
                'logs': {
                    params: 1,
                    inputFormatter: [formatter.inputLogFormatter],
                    outputFormatter: formatter.outputLogFormatter,
                    // DUBLICATE, also in web3-eth-contract
                    subscriptionHandler: function (output) {
                        if(output.removed) {
                            this.emit('changed', output);
                        } else {
                            this.emit('data', output);
                        }

                        if (_.isFunction(this.callback)) {
                            this.callback(null, output, this);
                        }
                    }
                },
                'syncing': {
                    params: 0,
                    outputFormatter: formatter.outputSyncingFormatter,
                    subscriptionHandler: function (output) {
                        var _this = this;

                        // fire TRUE at start
                        if(this._isSyncing !== true) {
                            this._isSyncing = true;
                            this.emit('changed', _this._isSyncing);

                            if (_.isFunction(this.callback)) {
                                this.callback(null, _this._isSyncing, this);
                            }

                            setTimeout(function () {
                                _this.emit('data', output);

                                if (_.isFunction(_this.callback)) {
                                    _this.callback(null, output, _this);
                                }
                            }, 0);

                            // fire sync status
                        } else {
                            this.emit('data', output);
                            if (_.isFunction(_this.callback)) {
                                this.callback(null, output, this);
                            }

                            // wait for some time before fireing the FALSE
                            clearTimeout(this._isSyncingTimeout);
                            this._isSyncingTimeout = setTimeout(function () {
                                if(output.currentBlock > output.highestBlock - 200) {
                                    _this._isSyncing = false;
                                    _this.emit('changed', _this._isSyncing);

                                    if (_.isFunction(_this.callback)) {
                                        _this.callback(null, _this._isSyncing, _this);
                                    }
                                }
                            }, 500);
                        }
                    }
                }
            }
        })
    ];

    methods.forEach(function(method) {
        method.attachToObject(_this);
        method.setRequestManager(_this._requestManager, _this.accounts); // second param means is eth.accounts (necessary for wallet signing)
        method.defaultBlock = _this.defaultBlock;
        method.defaultAccount = _this.defaultAccount;
    });

};

core.addProviders(Eth);


module.exports = Eth;

