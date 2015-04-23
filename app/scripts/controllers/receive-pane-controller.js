'use strict';

var sc = angular.module('paysharesClient');

sc.controller('ReceivePaneCtrl', function($scope, session) {
  $scope.showAddress = false;

  $scope.currentAddress = function() {
    return session.get('address');
  };

  $scope.toggleAddress = function() {
  	$scope.showAddress = !$scope.showAddress;
  };
});
