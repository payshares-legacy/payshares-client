var sc = angular.module('paysharesClient');
/**
 * Low-level, stateless trading operations service that other portions
 * of the trading components can depend upon for interacting with the
 * payshares network
 *
 * @namespace TradingOps
 * 
 */
sc.service('TradingOps', function(session, PaysharesNetwork, TransactionCurator) {

  this.createOffer = function(takerPays, takerGets) {
    var tx = PaysharesNetwork.remote.transaction();
    tx.offerCreate({
      "account":    session.get("address"),
      "taker_pays": PaysharesNetwork.amount.encode(takerPays),
      "taker_gets": PaysharesNetwork.amount.encode(takerGets),
    });

    return PaysharesNetwork.sendTransaction(tx).then(function (tx) {
      return {
        result: TransactionCurator.offerStateFromOfferCreate(tx),
        offer: TransactionCurator.offerFromOfferCreate(tx)
      };
    });
  };

  this.myOffers = function() {
    var account = session.get("address");

    return PaysharesNetwork.request("account_offers", {
      account: account
    }).then(function(response) {
        var normalizedOffers = response.offers.map(function (nativeOffer) {
          /*jshint camelcase: false */
          return {
            account:   account,
            sequence:  nativeOffer.seq,
            takerPays: PaysharesNetwork.amount.decode(nativeOffer.taker_pays),
            takerGets: PaysharesNetwork.amount.decode(nativeOffer.taker_gets),
          };
        });

        return normalizedOffers;
    });
  };


  this.cancelOffer = function(sequence) {
    var tx = PaysharesNetwork.remote.transaction();

    tx.offerCancel({
      "account":  session.get("address"),
      "sequence": sequence,
    });

    return PaysharesNetwork.sendTransaction(tx);
  };
});