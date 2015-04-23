var sc = angular.module('paysharesClient');

sc.directive('flashMessages', function() {
  return {
    restrict: 'E',
    templateUrl: 'templates/flash-message-container.html',
    controller: 'FlashMessageCtrl'
  };
});
