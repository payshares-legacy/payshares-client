'use strict';

angular.module('paysharesClient').controller('SettingsTotpCtrl', function($scope, session) {
  var wallet = session.get('wallet').walletV2;

  $scope.reset = function ($event) {
    if ($event) {
      $event.preventDefault();
    }
    $scope.error = null;
    $scope.enabling = false;
    $scope.code = null;
    $scope.password = null;
    $scope.disabling = false;
  };
  $scope.reset();
  $scope.$on('settings-refresh', $scope.reset);

  var key;

  $scope.$on('settings-totp-clicked', function($event, toggle) {
    if (toggle.on) {
      disableTotp();
    } else {
      enableTotp();
    }
  });

  function enableTotp() {
    $scope.enabling = true;
    key = PaysharesWallet.util.generateRandomTotpKey();
    // Partition string into 4 chars segments
    $scope.key = key.match(/.{4}/g).join(' ');
    $scope.uri = PaysharesWallet.util.generateTotpUri(key, {
      issuer: 'Payshares Development Foundation',
      accountName: session.get('username')
    });
  }

  $scope.confirmEnableTotp = function($event) {
    $event.preventDefault();
    $scope.error = null;

    var params = {
      server: Options.WALLET_SERVER+'/v2',
      username: wallet.getUsername(),
      password: $scope.password,
      totpCode: $scope.code
    };

    PaysharesWallet.getWallet(params).then(function() {
      return wallet.enableTotp({
        totpKey: key,
        totpCode: $scope.code,
        secretKey: session.get('wallet').keychainData.signingKeys.secretKey
      });
    }).then(function() {
      $scope.reset();
      $scope.$emit('settings-totp-toggled', true);
    }).catch(PaysharesWallet.errors.Forbidden,
             PaysharesWallet.errors.TotpCodeRequired,
             PaysharesWallet.errors.InvalidTotpCode,
             PaysharesWallet.errors.MissingField, function() {
      $scope.error = "Password or TOTP code incorrect.";
    }).catch(PaysharesWallet.errors.ConnectionError, function() {
      $scope.error = 'Connection error. Please try again.';
    }).catch(function(e) {
      Raven.captureMessage('confirmEnableTotp unknown error', {
        extra: {
          error: e
        }
      });
      $scope.error = 'Unknown error. Please try again.';
    }).finally(function() {
      $scope.$apply();
    });
  };

  function disableTotp() {
    $scope.disabling = true;
  }

  $scope.confirmDisableTotp = function($event) {
    $event.preventDefault();
    $scope.error = null;

    var params = {
      server: Options.WALLET_SERVER+'/v2',
      username: wallet.getUsername(),
      password: $scope.password,
      totpCode: $scope.code
    };

    PaysharesWallet.getWallet(params).then(function() {
      return wallet.disableTotp({
        totpCode: $scope.code,
        secretKey: session.get('wallet').keychainData.signingKeys.secretKey
      });
    }).then(function() {
      $scope.reset();
      $scope.$emit('settings-totp-toggled', false);
    }).catch(PaysharesWallet.errors.Forbidden,
             PaysharesWallet.errors.TotpCodeRequired,
             PaysharesWallet.errors.InvalidTotpCode,
             PaysharesWallet.errors.MissingField, function() {
      $scope.error = "Password or TOTP code incorrect.";
    }).catch(PaysharesWallet.errors.ConnectionError, function() {
      $scope.error = 'Connection error. Please try again.';
    }).catch(function(e) {
      Raven.captureMessage('confirmDisableTotp unknown error', {
        extra: {
          error: e
        }
      });
      $scope.error = 'Unknown error. Please try again.';
    }).finally(function() {
      $scope.$apply();
    });
  };
});