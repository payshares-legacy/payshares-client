exports.setup = function() {
  var api = angular.module('paysharesApi', []);

  api.service('HttpMock', function($q) {
    var HttpMock = function(promise) {
      this.promise = promise;
    };

    HttpMock.prototype.success = function(callback) {
      return new HttpMock(this.promise.then(callback));
    };

    HttpMock.prototype.error = function(callback) {
      return new HttpMock(this.promise.catch(callback));
    };

    HttpMock.success = function(response) {
      return new HttpMock($q.when(response));
    };

    HttpMock.error = function(response) {
      return new HttpMock($q.reject(response));
    };

    return HttpMock;
  });

  api.service('paysharesApi', function(HttpMock) {
    var paysharesApi = {};

    paysharesApi.User = {
      validateUsername: function(username) {
        switch(username) {
          case 'existingUsername': return HttpMock.error({code: 'already_taken'});
          case 'newUsername':      return HttpMock.success({status: 'success'});
        }

        throw new Error('Unexpected username passed to paysharesApi.User.validateUsername: ' + username);
      }
    };

    return paysharesApi;
  });
};