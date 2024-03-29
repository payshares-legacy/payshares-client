'use strict';
/* global loadSiftScript */

var sc = angular.module('paysharesClient');

var cache = {};

sc.service('session', function($rootScope, $http, $timeout, $analytics, $q, PaysharesNetwork, Wallet, contacts, UserPrivateInfo, Raven) {
  var Session = function() {
    this.waitingForUserInfo = $q.defer();
  };

  Session.prototype.get = function(name){ return cache[name]; };
  Session.prototype.put = function(name, value){ 
    cache[name] = value;
    return value;
  };


  /**
   * Record user activity, resetting the idle timeout
   * NOTE:  we debounce this function at the second level so we aren't
   * resetting the timer after every key press/click.  Second-level granularity
   * is enough.
   */
  Session.prototype.act = _.debounce(function() {
    if(this.get('loggedIn') === true) {
      this.clearIdleTimeout();
      this.setIdleTimeout();
    }

    var wallet = this.get('wallet');
    if (wallet && this.isPersistent()) {
      wallet.bumpLocalTimeout();
    }

  }, 1000, true);

  Session.prototype.setIdleTimeout = function() {
    var self = this;

    this.idleTimeout = $timeout(function() {
      self.logout(true);
    }, this.get('wallet').getIdleLogoutTime());
  };

  Session.prototype.clearIdleTimeout = function() {
    if (this.idleTimeout) {
      $timeout.cancel(this.idleTimeout);
    }
  };

  Session.prototype.login = function(wallet, logoutOnLegacyWallet) {
    var self = this;
    try {
      sessionStorage.displayReloadMessage = "display";
    } catch (e) {}

    // User has persisted old wallet. Logout so he can migrate to new version.
    if (logoutOnLegacyWallet && wallet.version !== 2) {
      this.logout();
      return;
    }

    this.put('wallet', wallet);

    // Wait until the username is know to start sift science analytics.
    loadSiftScript(wallet.mainData.username);

    if (this.isPersistent()) {
      wallet.saveLocal();
    } else {
      this.setIdleTimeout();
    }

    var signingKeys = wallet.keychainData.signingKeys;

    // Initialize the session with the wallet's data.
    this.put('username', wallet.mainData.username);
    this.put('signingKeys', signingKeys);
    this.put('address', signingKeys.address);


    self.identifyToAnalytics();
    self.identifyToRaven();
    $analytics.eventTrack('Account Logged In');

    // Store a user object for the currently authenticated user
    UserPrivateInfo.load(this.get('username'), this.get('wallet').keychainData.updateToken)
      .then(function (user) {
        self.put('userPrivateInfo', user);
        self.waitingForUserInfo.resolve(user);
        $rootScope.$broadcast('userLoaded');

        self.identifyToAnalytics();
      })
      .catch(function(err) {
        self.waitingForUserInfo.reject(err);
      });

    // check for the most up to date fairy address
    checkFairyAddress.bind(this)();
    $rootScope.account = {};
    $rootScope.$broadcast('walletAddressLoaded', {account: signingKeys.address, secret: signingKeys.secret});
    PaysharesNetwork.ensureConnection();

    // Set loggedIn to be true to signify that it is safe to use the session variables.
    this.put('loggedIn', true);
  };

  Session.prototype.rememberUser = function() {
    try {
      localStorage.rememberUser = true;
    } catch (err) {}
  };

  Session.prototype.isPersistent = function() {
    var rememberUser;
    try {
      rememberUser = JSON.parse(localStorage.rememberUser);
    } catch (err) {}

    return Options.PERSISTENT_SESSION || rememberUser;
  };

  Session.prototype.syncWallet = function(action) {
    var wallet = this.get('wallet');

    return wallet.sync(action)
      .then(function() {
        if (this.isPersistent()) {
          wallet.saveLocal();
        }

        $analytics.eventTrack('Account Updated');
      }.bind(this));
  };

  Session.prototype.getWalletFromStorage = function($scope) {
    try {
       return Wallet.loadLocal();
    } catch(e) {
      Wallet.purgeLocal();
      throw e;
    }
  };

  Session.prototype.logout = function(idle) {
    try {
      sessionStorage.displayReloadMessage = false;
      localStorage.rememberUser = false;
    } catch (e) {}

    Wallet.purgeLocal();
    $analytics.eventTrack('Account Logged Out');

    // HACK: Ensure that the app's state is reset by reloading the page.
    if (Options.LOGOUT_WITH_REFRESH) {
      if(idle) {
        location.search = 'idle';
      } else {
        location.href = location.origin;
      }
    } else {
      cache = {};
      delete $rootScope.account;
      PaysharesNetwork.shutdown();
      this.clearIdleTimeout();
    }
  };

  Session.prototype.getUser = function () {
    return this.get('userPrivateInfo');
  };

  Session.prototype.getUserInfo = function() {
    return this.waitingForUserInfo.promise;
  };

  Session.prototype.identifyToAnalytics = function() {
      window.analytics.identify(this.get('username'), this.getAnalyticsTraits());
  };

  Session.prototype.identifyToRaven = function() {
    Raven.setUserContext({
      id: this.get('username'),
      address: this.get('address'),
      email: this.getEmail(),
    });
  };

  Session.prototype.getAnalyticsTraits = function() {
    var traits      = {};
    traits.username = this.get("username");
    
    var privateInfo = this.get("userPrivateInfo");
    
    if(!_.isEmpty(privateInfo)) {
      traits.invites           = privateInfo.invites.length;
      traits.inviteCode        = privateInfo.inviteCode;
      traits.inviterUsername   = privateInfo.inviterUsername;
      traits.claimedInviteCode = privateInfo.claimedInviteCode;
      traits.linkedFacebook    = privateInfo.linkedFacebook;
      traits.email = this.getEmail();
    }



    return traits;
  };

  Session.prototype.getEmail = function() {
    var privateInfo = this.get("userPrivateInfo") || {};
    if(privateInfo.email) {
      return privateInfo.email.address;
    }
  };

  function checkFairyAddress() {
    /*jshint camelcase: false */
    $http.get(Options.API_SERVER + "/fairy")
    .success(function (response) {
      var federationRecord = response.data.federation_json;
      contacts.addContact(federationRecord);
    });
  }

  return new Session();
});
