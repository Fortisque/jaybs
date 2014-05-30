Cards = new Meteor.Collection("cards");
Players = new Meteor.Collection("players");

var shuffle = function() {

  var cardsCursor = Cards.find();
  var cardsArr = cardsCursor.fetch();
  for (var i = 0; i < cardsArr.length; i++) {
    Cards.update(cardsArr[i]._id, {$set: {shuffle_key: Math.floor( Math.random() * 100000 )}});
  }
}

if (Meteor.isClient) {
  Template.table.cards = function () {
    return Cards.find({}, {sort: {shuffle_key: 1}});
  };

  Template.table.events({
    'click input.shuffle': function () {
      shuffle(1);
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    if (Cards.find().count() === 0) {
      var suits = new Array("C", "D", "H", "S");
      var ranks = new Array("A", "2", "3", "4", "5", "6", "7", "8", "9",
                          "10", "J", "Q", "K");
      for (var i = 0; i < suits.length; i++) {
        for (var j = 0; j < ranks.length; j++) {
          Cards.insert({suit: suits[i], rank: ranks[j]});
        }
      }

      shuffle(1);
    }
  });
}
