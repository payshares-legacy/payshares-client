// Standalone version of: https://github.com/ripple/ripple-client/blob/7cbe63d/src/js/util/jsonrewriter.js
/* jshint camelcase:false */
/* jshint bitwise:false */
/* jshint laxbreak:true */

/**
 * Ripple trading default currency pairs.
 *
 * This list is a bit arbitrary, but it's basically the Majors [1] from forex
 * trading with some XPS pairs added.
 *
 * [1] http://en.wikipedia.org/wiki/Currency_pair#The_Majors
 *
 * @memberOf Data
 * @constant
 */
var pairs = [
    {name: 'BTC/XPS', order: 1},
    {name: 'XPS/USD', order: 1},
    {name: 'XPS/EUR', order: 1},
    {name: 'XPS/JPY', order: 0},
    {name: 'XPS/GBP', order: 0},
    {name: 'XPS/AUD', order: 0},
    {name: 'XPS/CHF', order: 0},
    {name: 'XPS/CAD', order: 0},
    {name: 'XPS/CNY', order: 0},
    {name: 'BTC/USD', order: 0},
    {name: 'BTC/EUR', order: 0},
    {name: 'EUR/USD', order: 0},
    {name: 'USD/JPY', order: 0},
    {name: 'GBP/USD', order: 0},
    {name: 'AUD/USD', order: 0},
    {name: 'USD/CHF', order: 0}
  ];

/**
 * Calculate executed order price
 *
 * @param effect
 * @returns {*}
 */
var getPrice = function(effect, referenceDate){
  var g = effect.got ? effect.got : effect.gets;
  var p = effect.paid ? effect.paid : effect.pays;
  var price;

  _.find(pairs, function(pair){
    if (pair.name === g.currency().to_human() + '/' + p.currency().to_human()) {
      price = p.ratio_human(g, {reference_date: referenceDate});
    }
  });

  if (!price) {
    price = g.ratio_human(p, {reference_date: referenceDate});
  }

  return price;
};

/**
 * Determine if the transaction is a "rippling" transaction based on effects
 *
 * @param effects
 */
var isRippling = function(effects){
  if (
    effects
    && effects.length
    && 2 === effects.length
    && 'trust_change_balance' === effects[0].type
    && 'trust_change_balance' === effects[1].type
    && effects[0].currency === effects[1].currency
    && !effects[0].amount.compareTo(effects[1].amount.negate())
    ) {
    return true;
  }
};

/**
 * Simple static class for processing server-side JSON.
 *
 * @namespace
 */
var JsonRewriter = {
  /**
   * Filter affected nodes by type.
   *
   * If affectedNodes is not a valid set of nodes, returns an empty array.
   */
  filterAnodes: function (affectedNodes, type) {
    if (!affectedNodes) { return []; }

    return affectedNodes.filter(function (an) {
      an = an.CreatedNode ? an.CreatedNode :
        an.ModifiedNode ? an.ModifiedNode :
        {};

      return an.LedgerEntryType === type;
    });
  },

  /**
   * Returns resulting (new or modified) fields from an affected node.
   */
  getAnodeResult: function (an) {
    an = an.CreatedNode ? an.CreatedNode :
      an.ModifiedNode ? an.ModifiedNode :
      {};

    var fields = $.extend({}, an.NewFields, an.FinalFields);

    return fields;
  },

  /**
   * Takes a metadata affected node and returns a simpler JSON object.
   *
   * The resulting object looks like this:
   *
   *   {
   *     // Type of diff, e.g. CreatedNode, ModifiedNode
   *     diffType: 'CreatedNode'
   *
   *     // Type of node affected, e.g. RippleState, AccountRoot
   *     entryType: 'RippleState',
   *
   *     // Index of the ledger this change occurred in
   *     ledgerIndex: '01AB01AB...',
   *
   *     // Contains all fields with later versions taking precedence
   *     //
   *     // This is a shorthand for doing things like checking which account
   *     // this affected without having to check the diffType.
   *     fields: {...},
   *
   *     // Old fields (before the change)
   *     fieldsPrev: {...},
   *
   *     // New fields (that have been added)
   *     fieldsNew: {...},
   *
   *     // Changed fields
   *     fieldsFinal: {...}
   *   }
   */
  processAnode: function (an) {
    var result = {};

    ["CreatedNode", "ModifiedNode", "DeletedNode"].forEach(function (x) {
      if (an[x]) {
        result.diffType = x;
      }
    });

    if (!result.diffType) { return null; }

    an = an[result.diffType];

    result.entryType = an.LedgerEntryType;
    result.ledgerIndex = an.LedgerIndex;

    result.fields = $.extend({}, an.PreviousFields, an.NewFields, an.FinalFields);
    result.fieldsPrev = an.PreviousFields || {};
    result.fieldsNew = an.NewFields || {};
    result.fieldsFinal = an.FinalFields || {};

    return result;
  },

  /**
   * Convert transactions into a more useful (for our purposes) format.
   *
   * The main operation this function performs is to change the view on the
   * transaction from a neutral view to a subjective view specific to our
   * account.
   *
   * For example, rather than having a sender and receiver, the transaction has
   * a counterparty and a flag whether it is incoming or outgoing.
   *
   * processTxn returns main purpose of transaction and side effects.
   *
   * Main purpose
   *  Real transaction names
   *  - Payment (sent/received/exchange)
   *  - TrustSet (trusting/trusted)
   *  - OfferCreate (offernew)
   *  - OfferCancel (offercancel)
   *
   *  Virtual transaction names
   *  - Failed
   *  - Rippling
   *
   * Side effects
   *  - balance_change
   *  - Trust (trust_create_local, trust_create_remote, trust_change_local,
   *          trust_change_remote, trust_change_balance, trust_change_no_ripple)
   *  - Offer (offer_created, offer_funded, offer_partially_funded,
   *          offer_cancelled, offer_bought)
   */
  processTxn: function (tx, meta, account) {
    var obj = {};

    // Currency balances that have been affected by the transaction
    var affected_currencies = [];

    // Main transaction
    if (tx.Account === account
      || (tx.Destination && tx.Destination === account)
      || (tx.LimitAmount && tx.LimitAmount.issuer === account)) {

      var transaction = {};

      if ('tesSUCCESS' === meta.TransactionResult) {
        switch (tx.TransactionType) {
          case 'Payment':
            var amount = payshares.Amount.from_json(meta.DeliveredAmount || tx.Amount);

            if (tx.Account === account) {
              if (tx.Destination === account) {
                transaction.type = 'exchange';
                transaction.spent = payshares.Amount.from_json(tx.SendMax);
              }
              else {
                transaction.type = 'sent';
                transaction.counterparty = tx.Destination;
              }
            }
            else {
              transaction.type = 'received';
              transaction.counterparty = tx.Account;
            }

            transaction.amount = amount;
            transaction.currency = amount.currency().to_human();
            break;

          case 'TrustSet':
            transaction.type = tx.Account === account ? 'trusting' : 'trusted';
            transaction.counterparty = tx.Account === account ? tx.LimitAmount.issuer : tx.Account;
            transaction.amount = payshares.Amount.from_json(tx.LimitAmount);
            transaction.currency = tx.LimitAmount.currency;
            break;

          case 'OfferCreate':
            transaction.type = 'offernew';
            transaction.pays = payshares.Amount.from_json(tx.TakerPays);
            transaction.gets = payshares.Amount.from_json(tx.TakerGets);
            transaction.sell = tx.Flags & payshares.Transaction.flags.OfferCreate.Sell;
            break;

          case 'OfferCancel':
            transaction.type = 'offercancel';
            break;

          case 'AccountSet':
            // Ignore empty accountset transactions. (Used to sync sequence numbers)
            if (meta.AffectedNodes.length === 1 && _.size(meta.AffectedNodes[0].ModifiedNode.PreviousFields) === 2) {
              break;
            }

            transaction.type = 'accountset';
            break;

          default:
            console.log('Unknown transaction type: "'+tx.TransactionType+'"', tx);
        }

        if (tx.Flags) {
          transaction.flags = tx.Flags;
        }
      } else {
        transaction.type = 'failed';
      }

      if (!$.isEmptyObject(transaction)) {
        obj.transaction = transaction;
      }
    }

    // Side effects
    if ('tesSUCCESS' === meta.TransactionResult) {
      meta.AffectedNodes.forEach(function (n) {
        var node = JsonRewriter.processAnode(n);
        var feeEff;
        var effect = {};

        // AccountRoot - Current account node
        if (node.entryType === "AccountRoot" && node.fields.Account === account) {
          obj.accountRoot = node.fields;

          if (node.fieldsPrev.Balance) {
            var balance = payshares.Amount.from_json(node.fields.Balance);

            // Fee
            if(tx.Account === account && tx.Fee) {
              feeEff = {
                type: "fee",
                amount: payshares.Amount.from_json(tx.Fee).negate(),
                balance: balance
              };
            }

            // Updated XPS Balance
            if (tx.Fee !== node.fieldsPrev.Balance - node.fields.Balance) {
              if (feeEff) {
                balance = balance.subtract(feeEff.amount);
              }

              effect.type = "balance_change";
              effect.amount = balance.subtract(node.fieldsPrev.Balance);
              effect.balance = balance;

              // balance_changer is set to true if the transaction / effect has changed one of the account balances
              obj.balance_changer = effect.balance_changer = true;
              affected_currencies.push('XPS');
            }
          }
        }

        // RippleState - Ripple Lines
        if (node.entryType === "RippleState"
          && (node.fields.HighLimit.issuer === account || node.fields.LowLimit.issuer === account)) {

          var high = node.fields.HighLimit;
          var low = node.fields.LowLimit;

          var which = high.issuer === account ? 'HighNoRipple' : 'LowNoRipple';

          // New trust line
          if (node.diffType === "CreatedNode") {
            effect.limit = payshares.Amount.from_json(high.value > 0 ? high : low);
            effect.limit_peer = payshares.Amount.from_json(high.value > 0 ? low : high);

            if ((high.value > 0 && high.issuer === account)
              || (low.value > 0 && low.issuer === account)) {
              effect.type = "trust_create_local";
            } else {
              effect.type = "trust_create_remote";
            }
          }

          // Modified trust line
          else if (node.diffType === "ModifiedNode" || node.diffType === "DeletedNode") {
            var highPrev = node.fieldsPrev.HighLimit;
            var lowPrev = node.fieldsPrev.LowLimit;

            // Trust Balance change
            if (node.fieldsPrev.Balance) {
              effect.type = "trust_change_balance";

              var issuer =  node.fields.Balance.value > 0 || node.fieldsPrev.Balance.value > 0
                ? high.issuer : low.issuer;

              effect.amount = high.issuer === account
                ? effect.amount = payshares.Amount.from_json(
                  node.fieldsPrev.Balance.value
                  + "/" + node.fieldsPrev.Balance.currency
                  + "/" + issuer).subtract(node.fields.Balance)
                : effect.amount = payshares.Amount.from_json(
                  node.fields.Balance.value
                  + "/" + node.fields.Balance.currency
                  + "/" + issuer).subtract(node.fieldsPrev.Balance);

              obj.balance_changer = effect.balance_changer = true;
              affected_currencies.push(high.currency.toUpperCase());
            }

            // Trust Limit change
            else if (highPrev || lowPrev) {
              if (high.issuer === account) {
                effect.limit = payshares.Amount.from_json(high);
                effect.limit_peer = payshares.Amount.from_json(low);
              } else {
                effect.limit = payshares.Amount.from_json(low);
                effect.limit_peer = payshares.Amount.from_json(high);
              }

              if (highPrev) {
                effect.prevLimit = payshares.Amount.from_json(highPrev);
                effect.type = high.issuer === account ? "trust_change_local" : "trust_change_remote";
              }
              else if (lowPrev) {
                effect.prevLimit = payshares.Amount.from_json(lowPrev);
                effect.type = high.issuer === account ? "trust_change_remote" : "trust_change_local";
              }
            }

            // Trust flag change (effect gets this type only if nothing else but flags has been changed)
            else if (node.fieldsPrev.Flags) {
              // Account set a noRipple flag
              if (node.fields.Flags & payshares.Remote.flags.state[which] &&
                !(node.fieldsPrev.Flags & payshares.Remote.flags.state[which])) {
                effect.type = "trust_change_no_ripple";
              }

              // Account removed the noRipple flag
              else if (node.fieldsPrev.Flags & payshares.Remote.flags.state[which] &&
                !(node.fields.Flags & payshares.Remote.flags.state[which])) {
                effect.type = "trust_change_no_ripple";
              }

              if (effect.type) {
                effect.flags = node.fields.Flags;
              }
            }
          }

          if (!$.isEmptyObject(effect)) {
            effect.counterparty = high.issuer === account ? low.issuer : high.issuer;
            effect.currency = high.currency;
            effect.balance = high.issuer === account
              ? payshares.Amount.from_json(node.fields.Balance).negate(true)
              : payshares.Amount.from_json(node.fields.Balance);

            if (obj.transaction && obj.transaction.type === "trust_change_balance") {
              obj.transaction.balance = effect.balance;
            }

            // noRipple flag
            if (node.fields.Flags & payshares.Remote.flags.state[which]) {
              effect.noRipple = true;
            }
          }
        }

        // Offer
        else if (node.entryType === "Offer") {

          // For new and cancelled offers we use "fields"
          var fieldSet = node.fields;

          // Current account offer
          if (node.fields.Account === account) {

            // Partially funded offer [and deleted.. no more funds]
            /* Offer has been partially funded and deleted (because of the luck of funds)
             if the node is deleted and the TakerGets/TakerPays field has been changed */
            if (node.diffType === "ModifiedNode" ||
              (node.diffType === "DeletedNode"
                && node.fieldsPrev.TakerGets
                && !payshares.Amount.from_json(node.fieldsFinal.TakerGets).is_zero())) {
              effect.type = 'offer_partially_funded';

              if (node.diffType !== "DeletedNode") {
                effect.remaining = payshares.Amount.from_json(node.fields.TakerGets);
              }
              else {
                effect.cancelled = true;
              }
            }
            else {
              // New / Funded / Cancelled offer
              effect.type = node.diffType === "CreatedNode"
                ? 'offer_created'
                : node.fieldsPrev.TakerPays
                ? 'offer_funded'
                : 'offer_cancelled';

              // For funded offers we use "fieldsPrev".
              if (effect.type === 'offer_funded') {
                fieldSet = node.fieldsPrev;
              }

              // We don't count cancelling an offer as a side effect if it's
              // already the primary effect of the transaction.
              if (effect.type === 'offer_cancelled' &&
                obj.transaction &&
                obj.transaction.type === "offercancel") {

                // Fill in remaining information about offer
                obj.transaction.gets = fieldSet.TakerGets;
                obj.transaction.pays = fieldSet.TakerPays;
              }
            }

            effect.seq = +node.fields.Sequence;
          }

          // Another account offer. We care about it only if our transaction changed the offer amount (we bought currency)
          else if(tx.Account === account && !$.isEmptyObject(node.fieldsPrev) /* Offer is unfunded if node.fieldsPrev is empty */) {
            effect.type = 'offer_bought';
          }

          if (effect.type) {
            effect.gets = payshares.Amount.from_json(fieldSet.TakerGets);
            effect.pays = payshares.Amount.from_json(fieldSet.TakerPays);

            if ('offer_partially_funded' === effect.type || 'offer_bought' === effect.type) {
              effect.got = payshares.Amount.from_json(node.fieldsPrev.TakerGets).subtract(node.fields.TakerGets);
              effect.paid = payshares.Amount.from_json(node.fieldsPrev.TakerPays).subtract(node.fields.TakerPays);
            }
          }

          if (effect.gets && effect.pays) {
            effect.price = getPrice(effect, tx.date);
          }

          // Flags
          if (node.fields.Flags) {
            effect.flags = node.fields.Flags;
            effect.sell = node.fields.Flags & payshares.Remote.flags.offer.Sell;
          }
        }

        if (!$.isEmptyObject(effect)) {
          if (node.diffType === "DeletedNode") {
            effect.deleted = true;
          }

          if (!obj.effects) {
            obj.effects = [];
          }
          obj.effects.push(effect);
        }

        // Fee effect
        if (feeEff) {
          if (!obj.effects) {
            obj.effects = [];
          }
          obj.effects.push(feeEff);
        }
      });
    }

    // Balance after the transaction
    if (obj.accountRoot && obj.transaction && "undefined" === typeof obj.transaction.balance) {
      obj.transaction.balance = payshares.Amount.from_json(obj.accountRoot.Balance);
    }

    if ($.isEmptyObject(obj)) {
      return;
    }

    // If the transaction didn't wind up cancelling an offer
    if (tx.TransactionType === 'OfferCancel' && obj.transaction &&
      (!obj.transaction.gets || !obj.transaction.pays)) {
      return;
    }

    // Rippling transaction
    if (isRippling(obj.effects)) {
      if (!obj.transaction) {
        obj.transaction = {};
      }
      obj.transaction.type = 'rippling';
    }

    obj.tx_type = tx.TransactionType;
    obj.tx_result = meta.TransactionResult;
    obj.fee = tx.Fee;
    obj.date = payshares.utils.toTimestamp(tx.date);
    obj.dateRaw = tx.date;
    obj.hash = tx.hash;
    obj.affected_currencies = affected_currencies ? affected_currencies : [];
    obj.ledger_index = tx.ledger_index;

    return obj;
  }
};
