var sc = angular.module('paysharesClient');

sc.controller('GatewayListCtrl', function($scope) {

  $scope.hasGateways = function() {
    return _.any($scope.gateways);
  };

});
