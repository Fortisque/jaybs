Cards = new Meteor.Collection("cards");
Players = new Meteor.Collection("players");

var shuffle = function() {
  var cardsArr = Cards.find().fetch();
  for (var i = 0; i < cardsArr.length; i++) {
    Cards.update(cardsArr[i]._id, {$set: {shuffle_key: Math.floor( Math.random() * 100000 )}});
  }
}

var distribute = function() {
  shuffle();
  var cardsArr = Cards.find({}, {sort: {shuffle_key: 1}}).fetch();
  var playerArr = Players.find().fetch();
  var perPlayer = cardsArr.length/playerArr.length;
  for (var player = 0; player < playerArr.length; player++) {
    for (var i = player*perPlayer; i < (player+1)*perPlayer; i++) {
      var player_id = playerArr[player]._id;
      Cards.update(cardsArr[i]._id, {$set: {player_key: player_id}});
    }
  }
}


if (Meteor.isClient) {

  Template.table.players = function () {
    return Players.find({}, {sort: {name: 1}});
  };

  Template.player.cards = function () {
    return Cards.find({player_key: this._id}, {sort: {shuffle_key: 1}});
  };

  Template.table.events({
    'click input.shuffle': function () {
      shuffle();
    },
    'click input.distribute': function () {
      distribute();
    }
  });

  Template.player.events({
    'click input.sort': function () {
      var cardsArr = Cards.find({player_key: this._id}).fetch();
      for (var i = 0; i < cardsArr.length; i++) {
        Cards.update(cardsArr[i]._id, {$set: {shuffle_key: cardsArr[i].sort_value}});
      }
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    if (Cards.find().count() === 0) {
      var suits = new Array("C", "D", "H", "S");
      var ranks = new Array("3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K" ,"A", "2");
      for (var i = 0; i < suits.length; i++) {
        for (var j = 0; j < ranks.length; j++) {
          Cards.insert({suit: suits[i], rank: ranks[j], sort_value: i + j*suits.length});
        }
      }

      shuffle();
      distribute();
    }

    if (Players.find().count() === 0) {
      var names = ['Kevin', 'Alice', 'Ryan', 'Paul'];
      for (var i = 0; i < names.length; i++) {
        Players.insert({name: names[i]});
      }
    };
  });
}
