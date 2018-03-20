'use strict';

angular.module('paysharesClient').controller('Lost2FADeviceCtrl', function($scope, singletonPromise) {
  $scope.error = null;
  $scope.sent = false;

  $scope.sendRequest = function($event) {
    $event.preventDefault();
    $scope.asyncRequest();
  };

  $scope.asyncRequest = singletonPromise(function() {
    $scope.error = null;

    PaysharesWallet.lostTotpDevice({
      server: Options.WALLET_SERVER+'/v2',
      username: $scope.username+'@payshares.org',
      password: $scope.password
    }).then(function() {
      $scope.sent = true;
    }).catch(PaysharesWallet.errors.WalletNotFound, function() {
      $scope.sent = true;
    }).catch(PaysharesWallet.errors.MissingField, function() {
      $scope.error = 'Please fill in all fields.';
    }).catch(PaysharesWallet.errors.ConnectionError, function() {
      $scope.error = 'Problems connecting wallet server. Please try again later.';
    }).catch(function(e) {
      Raven.captureMessage('PaysharesWallet.lostTotpDevice unknown error', {
        extra: {
          error: e
        }
      });
      $scope.error = 'Unknown error. Please try again later.';
    }).finally(function() {
      $scope.$apply();
    });
  });
});
