var api = angular.module('paysharesApi', []);

api.service('paysharesApi', function(http, User) {
  var paysharesApi = {};

  paysharesApi.User = User;

  return paysharesApi;
});