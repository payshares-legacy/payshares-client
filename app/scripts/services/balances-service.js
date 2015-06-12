'use strict';

var sc = angular.module('paysharesClient');

sc.service('Balances', function($rootScope, $q, PaysharesNetwork, session) {

  var self = this,
      balances = null;

  // TODO: Find a way to fetch the balances once a user logs on. userLoaded and walletAddressLoaded aren't working fast enough

  // Broadcasts a clone of the whole balances on every new transaction
  $rootScope.$on('payshares-network:transaction', function(event, message) {
      self.fetchBalances()
        .then(function(newBalances) {
          $rootScope.$broadcast('balances:update', newBalances);
        });
  });

  /**
   * Fetches a copy of the all the user's balances (XPS and credits).
   * It is guaranteed that XPS will be present in the list of balances.
   * Use this if you want to force fetch the balances. If not, use ensureBalancesLoaded
   * 
   * @return {Promise} A promise that resolves to a clone of an unsorted array 
   *         of amount struct that represents the current user's balances.
   */
  this.fetchBalances = function() {
    var accountLines = PaysharesNetwork.request('account_lines', { 'account': session.get('address') });
    var accountInfo = PaysharesNetwork.request('account_info', { 'account': session.get('address') });
    return $q.all([accountLines, accountInfo])
      .then(function(results) {
        /*jshint camelcase: false */
        var creditBalances = _.map(results[0].lines, PaysharesNetwork.amount.decodeFromAccountLine);
        var XPSBalance = PaysharesNetwork.amount.decode(results[1].account_data.Balance);

        var newBalances = new Array(XPSBalance).concat(creditBalances);
        balances = newBalances;
        return _.cloneDeep(newBalances);
      });
  };

  /**
   * Makes sure that the internal balances state has been loaded.
   * If already loaded, the promise immediately resolves.
   * If not, it will fetch them.
   *
   * Always try to this instead of fetchBalances unless you want to force refresh
   * the balances.
   */
  this.ensureBalancesLoaded = function() {
    if (balances === null) {
      return this.fetchBalances();
    } else {
      return $q.when(_.cloneDeep(balances));
    }
  };

  /**
   * Gets the balance of an currency item. Either takes in an amount struct or 
   * a pair of currency (string) and issuer string (optional if currency is XPS)
   *
   * Returns an amount with value of 0 if it couldn't find the currency from 
   * the balances.
   *
   * @return A promise that resolves to a amount struct representing in the balance.
   */
  this.get = function(currency) {
    if(!isValidCurrency(currency)) {
      return $q.reject(new Error("invalid currency type " + typeof currency + ": expected a currency struct"));
    }

    if(!hasValidIssuer(currency)) {
      return $q.reject(new Error("invalid currency: issuer was not valid"));
    }

    return this.ensureBalancesLoaded()
      .then(function(balances) {
        var foundAmount = _.find(balances || [], currency);
        return foundAmount ? foundAmount : _.extend({value:"0"}, currency);
      });
  };

  function isValidCurrency(currency) {
    var isObject    = typeof currency === 'object';
    var hasCurrency = 'currency' in currency;
    var hasIssuer   = currency.currency === 'XPS' || ('issuer' in currency);

    if (isObject && hasCurrency && hasIssuer) {
      return true;
    } else {
      return false;
    }
  }

  function hasValidIssuer(currency) {
    /*jshint camelcase: false */
    var isPayshares      = currency.currency === 'XPS';
    var isValidAddress = payshares.UInt160.is_valid(currency.issuer);

    if(isPayshares && currency.issuer) {
      return false;
    } else if(!isPayshares && !isValidAddress) {
      return false;
    } else {
      return true;
    }
  }
});
