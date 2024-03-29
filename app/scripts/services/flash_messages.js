var sc = angular.module('paysharesClient');

sc.factory('FlashMessages', function($rootScope) {
  var result = {};
  result.messages = [];

  $rootScope.$on('flashMessage', function(e, message) {
    result.messages.push(message);
  });

  result.dismiss = function(index) {
    result.messages.splice(index, 1);
  };

  result.add = function(message) {
    var defaults = {
      showCloseIcon: true
    };
    message = _.extend(defaults, message);
    $rootScope.$broadcast('flashMessage', message);
  };

  result.dismissAll = function() {
    result.messages = [];
  };

  result.dismissById = function(id) {
    result.messages = result.messages.filter(function(message) {
      return message.id !== id;
    });
  };

  return result;
});