'use strict';

/* jshint camelcase:false */
/* global JsonRewriter */

var sc = angular.module('paysharesClient');

sc.controller('SendRewardCtrl', function ($rootScope, $scope, $http, PaysharesNetwork, session, TutorialHelper) {
  $scope.reward = {
    rewardType: 3,
    status: 'incomplete',
    innerTitle: 'Learn to send paysharess',
    getCopy: function() {
      switch ($scope.reward.status) {
      case 'needs_fbauth':
      case 'sending':
      case 'sent':
        // User needs to fb auth before they can get their paysharess (when they're done, still show this message)
        return {
          title: 'Sent!',
          subtitle: 'Log in with Facebook to receive paysharess'
        };

      default:
        return {
          title: 'Send paysharess!',
          subtitle: 'Learn to send'
        };
      }
    },
    updateReward: function (status) {
      $scope.reward.status = status;
      if (status === 'sent') {
        removeSentTxListener();
      }
    }
  };
  // add this reward to the parent scope's reward array
  $scope.rewards[$scope.reward.rewardType] = $scope.reward;

  $scope.reward.template = 'templates/send-payshares.html';

  $scope.sendTutorial = function() {
    TutorialHelper.set('dashboard', 'send-tutorial');

    // Scroll up and open the send tab.
    $('html, body').animate({scrollTop: $('.dash-send-container').offset().top}, 400);
    $rootScope.openSend();
  };

  function validateTransaction(tx){
    // TODO: Make this a variable and use it in the template.
    var minAmount = 25 * 1000000;
    return tx && tx.type === "sent" && tx.amount.to_number() >= minAmount;
  }

  var turnOffTxListener;
  function setupSentTxListener() {
    turnOffTxListener = $scope.$on('payment-history:new', function (event, tx) {
      if (validateTransaction(tx)) {
        requestSentPaysharessReward();
      }
    });
  }

  function removeSentTxListener() {
    if (turnOffTxListener) {
      turnOffTxListener();
      turnOffTxListener = null;
    }
  }

  // checks if the user has any "sent" transactions, requests send reward if so
  function checkSentTransactions() {
    var remote = PaysharesNetwork.remote;
    var account = session.get('address');
    var params = {
      'account': account,
      'ledger_index_min': 0,
      'ledger_index_max': 9999999,
      'descending': true,
      'count': true
    };

    // Transactions
    remote.request_account_tx(params)
      .on('success', function (data) {
        data.transactions = data.transactions || [];

        $scope.$apply(function () {
          var sendRewardRequested = false;
          for(var i = 0; i < data.transactions.length; i++){
            var processedTxn = JsonRewriter.processTxn(data.transactions[i].tx, data.transactions[i].meta, account);
            var transaction = processedTxn.transaction;

            if (validateTransaction(transaction)) {
              requestSentPaysharessReward();
              sendRewardRequested = true;
              break;
            }
          }

          if (!sendRewardRequested) {
            setupSentTxListener();
          }
        });
      })
      .on('error', function () {})
      .request();
  }

  function requestSentPaysharessReward() {
    var data = {username: session.get('username')};

    return $http.post(Options.API_SERVER + "/claim/sendPaysharess", data)
      .success(function (response) {
        $scope.reward.status = response.message;
      });
  }

  var turnOffListener = $scope.$on("onRewardsUpdated", function () {
    if ($scope.reward.status === 'incomplete') {
      checkSentTransactions();
      turnOffListener();
    }
  });
});
