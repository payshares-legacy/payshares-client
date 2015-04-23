var sc = angular.module('paysharesClient');

sc.directive('disconnectedAlert', function() {
  return {
    restrict: 'E',
    transclude: true,
    scope: {},
    controller: function($scope, $timeout, PaysharesNetwork) {
      $scope.status = '';
      $scope.reconnectTime = 0;
      $scope.reconnectTimer = null;

      if(PaysharesNetwork.connected) {
        $scope.status = 'connected';
      }

      $scope.$on('payshares-network:disconnected', function() {
        $scope.status = 'disconnected';
      });

      $scope.$on('payshares-network:connected', function() {
        $scope.status = 'connected';
      });

      $scope.$on('payshares-network:connecting', function() {
        $scope.status = 'connecting';
      });

      $scope.$on('payshares-network:reconnecting', function(e, timeout) {
        $scope.status = 'reconnecting';
        $scope.reconnectTime = Date.now() + timeout;

        if($scope.reconnectTimer) {
          $timeout.cancel($scope.reconnectTimer);
        }

        $scope.reconnectTimer = $timeout(function() {
          $scope.reconnectTimer = null;

          if($scope.status === 'reconnecting') {
            $scope.status = 'connecting';
          }
        }, timeout);
      });

      $scope.timeUntilReconnect = function() {
        return Math.max($scope.reconnectTime - Date.now(), 0);
      };

      $scope.reconnect = function() {
        PaysharesNetwork.forceReconnect();
      };
    },
    templateUrl: 'templates/disconnected-alert.html'
  };
});
