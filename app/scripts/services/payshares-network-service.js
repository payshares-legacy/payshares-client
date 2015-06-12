var sc = angular.module('paysharesClient');

/**
 
 The PaysharesNetwork service is used to communicate with the Payshares network.

 @namespace  PaysharesNetwork */
sc.factory('PaysharesNetwork', function($rootScope, $timeout, $q) {
    var self                  = {};
    self.remote               = null;
    self.connected            = false;
    self.waitingForConnection = null;

    var handleDisconnect = function(e) {
        $timeout(function () {
            self.connected = false;
            $rootScope.connected = false;
            $rootScope.$broadcast('payshares-network:disconnected');
        });
    };

    var handleReconnecting = function(timeout) {
        $timeout(function () {
            $rootScope.$broadcast('payshares-network:reconnecting', timeout);
        });
    };

    var handleConnecting = function() {
        $timeout(function () {
            $rootScope.$broadcast('payshares-network:connecting');
        });
    };

    var handleConnect = function (e) {
        $timeout(function () {
            /*jshint camelcase: false */
            // TODO: need to figure out why this isn't being set when we connect to the paysharesd
            self.remote._reserve_base=50*1000000;
            self.remote._reserve_inc=10*1000000;

            self.connected = true;
            $rootScope.connected = true;
            $rootScope.$broadcast('payshares-network:connected');

            if(self.waitingForConnection) {
                self.waitingForConnection.resolve();
            }
        });
    };

    var handleTransaction = function(tx) {
      $timeout(function () {
        $rootScope.$broadcast('payshares-network:transaction', tx);
      });
    };

    var init = function () {
        self.remote = new payshares.Remote(Options.server, true);
        self.remote.connect();
        self.remote.on('connected', handleConnect);
        self.remote.on('disconnected', handleDisconnect);
        self.remote.on('reconnecting', handleReconnecting);
        self.remote.on('connecting', handleConnecting);
        self.remote.on('transaction', handleTransaction);
    };

    self.forceReconnect = function () {
        if(self.remote) {
            /* jshint camelcase:false */
            self.remote.force_reconnect();
        } else {
            init();
        }
    };

    self.shutdown = function () {
        self.remote.disconnect();
        // self.remote = null;
    };

    self.ensureConnection = function() {
        if(self.connected) { 
            return $q.when();
        } else if (self.waitingForConnection) {
            return self.waitingForConnection.promise;
        } else {
            self.waitingForConnection = $q.defer();

            if(self.remote) {
                self.remote.connect();
            } else {
                init();
            }

            return self.waitingForConnection.promise;
        }
    };

    self.request = function (method, params) {
        //TODO: throw a better error
        if (!self.remote) { throw new Error("Network is not initialized"); }
        var req = new payshares.Request(self.remote, method);

        // fold the params into the message object
        _.extend(req.message, params);

        var deferred = $q.defer();

        req.on('success', deferred.resolve);
        req.on('error', deferred.reject);


        req.request();
        return deferred.promise;
    };

    self.sendTransaction = function(tx) {
        var deferred = $q.defer();

        tx.on('success', function(response) {
            deferred.resolve(response);
        });

        tx.on('error', function (response) {
            return deferred.reject(response);
        });

        tx.submit();

        return deferred.promise;
    };

    self.getAccount = function(address) {
        var deferred = $q.defer();

        var account = self.remote.account(address);
        account.entry(function (err, data) {
            if (err) {
                deferred.reject(err);
            } else {
                /* jshint camelcase:false */
                deferred.resolve(data.account_data);
            }
        });

        return deferred.promise;
    };


    /** @namespace  PaysharesNetwork.amount */
    self.amount = {};

    /**
     * Normalizes a paysharesd native amount (which could be either a raw number
     * for XPS or a currency/value/issuer object for other currencies) into our
     * normalized {@link Structs.Amount} form.
     *
     * @param {string|number|object} nativeAmount the amount as reported from json
     *                                            originating from paysharesd
     * @return {Structs.Amount} the normalized amount
     * @memberOf PaysharesNetwork.amount
     * @function decode
     */
    self.amount.decode = function(nativeAmount) {
      var amountType = typeof nativeAmount;
  
      switch(amountType) {
        case "string":
        case "number":
          return {
            currency: "XPS",
            value: new BigNumber(nativeAmount).div(1000000).toString()
          };
        case "object":
          return _.cloneDeep(nativeAmount);
        default:
          throw new Error("invalid amount type " + amountType + ": expected a string, number, or object");
      }
    };

    /**
     * Converts a account line returned from paysharesd's account_line and
     * turns it into a amount struct
     *
     * @param {object} accountLine an accountLine object from paysharesd's account_line
     * @return {Structs.Amount} amount struct built from the account line
     * @memberOf PaysharesNetwork.amount
     * @function decodeFromAccountLine
     */
    self.amount.decodeFromAccountLine = function(accountLine) {
      if (typeof accountLine !== 'object') {
          throw new Error("invalid accountLine type " + typeof accountLine + ": expected an object");
      }

      return {
          currency: accountLine.currency,
          value: accountLine.balance,
          issuer: accountLine.account
        };
    };

    /**
     * Given a {@link Structs.Amount}, convert it back to a form that can be used
     * in communication with paysharesd
     * 
     * @param  {Structs.Amount} normalizedAmount
     * @return {string|object}                  
     * @memberOf PaysharesNetwork.amount
     * @function encode
     */
    self.amount.encode = function(normalizedAmount) {
      if(normalizedAmount.currency === "XPS") {
        var stroopAmount = new BigNumber(normalizedAmount.value).times(1000000);

        // confirm there resultant stroop value isn't fractional
        var hasFraction = !stroopAmount.ceil().equals(stroopAmount);
        if(hasFraction) {
          throw new Error("Cannot encode XPS amount: " + normalizedAmount.value);
        }

        return stroopAmount.toString();
      } else {
        return _.cloneDeep(normalizedAmount);
      }
    };


    /** @namespace  PaysharesNetwork.currency */
    self.currency = {};
    /**
     * Normalizes a paysharesd native currency (which could be either XPS or 
     * currency/issuer object for other currencies) into our normalized 
     * {@link Structs.Currency} form.
     *
     * @param {string|object} nativeCurrency 
     * @return {Structs.Currency} the normalized currency
     * @memberOf PaysharesNetwork.currency
     * @function decode
     */
    self.currency.decode = function(nativeCurrency) {
      var currencyType = typeof nativeCurrency;
  
      switch(currencyType) {
        case "string":
          return { currency: "XPS" };
        case "object":
          return nativeCurrency;
        default:
          throw new Error("invalid currency type " + currencyType + ": expected a string, or object");
      }
    };


    /**
     * Given a {@link Structs.Currency}, convert it back to a form that can be used
     * in communication with paysharesd
     * 
     * @param  {Structs.Currency} normalizedCurrency
     * @return {string|object}                  
     * @memberOf PaysharesNetwork.currency
     * @function encode
     */
    self.currency.encode = function(normalizedCurrency) {
      if(normalizedCurrency.currency === "XPS") {
        return normalizedCurrency.currency;
      } else {
        return normalizedCurrency;
      }
    };

    /** @namespace  PaysharesNetwork.offer */
    self.offer = {};

    
    self.offer.decode = function(nativeOffer) {
      var result       = {};
      result.account   = nativeOffer.Account;
      result.sequence  = nativeOffer.Sequence;
      result.takerPays = self.amount.decode(nativeOffer.TakerPays);
      result.takerGets = self.amount.decode(nativeOffer.TakerGets);

      return result;
    };


    return self;
});