Cards = new Meteor.Collection("cards");
Players = new Meteor.Collection("players");
Turn = new Meteor.Collection("turn");

var getCurrentTurn = function() {
  var current_turn = Turn.findOne({curr: 'current_turn'});
  if (current_turn == undefined) {
    return undefined;
  }
  return current_turn.player_key;
}

var setCurrentTurn = function(number) {
  var current_turn = Turn.findOne({curr: 'current_turn'});
  if (current_turn == undefined) {
    return Turn.insert({curr: 'current_turn', player_key: number});
  }
  return Turn.update(current_turn._id, {$set: {player_key: number}});
}

var getLastCard = function() {
  var last_card = Turn.findOne({curr: 'last_card'});
  if (last_card == undefined) {
    return undefined;
  }
  return last_card.sort_value;
}

var setLastCard = function(sort_value) {
  var last_card = Turn.findOne({curr: 'last_card'});
  if (last_card == undefined) {
    return Turn.insert({curr: 'last_card', sort_value: sort_value});
  }
  return Turn.update(last_card._id, {$set: {sort_value: sort_value}});
}

var shuffle = function() {
  var cardsArr = Cards.find().fetch();
  for (var i = 0; i < cardsArr.length; i++) {
    Cards.update(cardsArr[i]._id, {$set: {shuffle_key: Math.floor( Math.random() * 100000 )}});
  }
}

var deleteAll = function() {
  var cardsArr = Cards.find().fetch();
  for (var i = 0; i < cardsArr.length; i++) {
    Cards.remove(cardsArr[i]._id);
  }
  var cardsArr = Players.find().fetch();
  for (var i = 0; i < cardsArr.length; i++) {
    Players.remove(cardsArr[i]._id);
  }
}

var distribute = function() {
  shuffle();
  var cardsArr = Cards.find({}, {sort: {shuffle_key: 1}}).fetch();
  var playerArr = Players.find().fetch();
  var perPlayer = cardsArr.length/playerArr.length;
  for (var player = 0; player < playerArr.length; player++) {
    for (var i = player*perPlayer; i < (player+1)*perPlayer; i++) {
      var key = playerArr[player]._id;
      Cards.update(cardsArr[i]._id, {$set: {player_key: key, orig_player_key: key}});
    }
  }

  setCurrentTurn(-1);
}


if (Meteor.isClient) {

  Template.table.playedCards = function () {
    return Cards.find({player_key: -1}, {sort: {shuffle_key: 1}});
  };

  Template.table.players = function () {
    return Players.find({}, {sort: {number: 1}});
  };

  Template.player.cards = function () {
    return Cards.find({player_key: this._id}, {sort: {shuffle_key: 1}});
  };

  Template.player.selected = function () {
    return getCurrentTurn() === this._id ? 'selected' : '';
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
    'click input.sort': function() {
      var cardsArr = Cards.find({player_key: this._id}).fetch();
      for (var i = 0; i < cardsArr.length; i++) {
        Cards.update(cardsArr[i]._id, {$set: {shuffle_key: cardsArr[i].sort_value}});
      }
    },
    'click input.pass': function() {
      var player = Players.findOne({_id: this._id});
      var nextPlayer = Players.findOne({turn_number: (player.turn_number + 1) % Players.find().count()});
      if (Cards.findOne({sort_value: getLastCard()}).orig_player_key == nextPlayer._id) {
        console.log("CLEAR");
        setLastCard(-1); // can play anything on top of this.
      }
      return setCurrentTurn(nextPlayer._id);
    }
  });

  Template.card.events({
    'click input': function () {
      var setNextTurn = function (obj) {
        var player = Players.findOne({_id: obj.player_key});
        Cards.update(obj._id, {$set: {player_key: -1}});
        var nextPlayer = Players.findOne({turn_number: (player.turn_number + 1) % Players.find().count()});
        setLastCard(obj.sort_value);
        return setCurrentTurn(nextPlayer._id);
      };

      if(getCurrentTurn() == -1) {
        if (this.sort_value != 0) {
          return console.log("oops not your turn!");
        }
        return setNextTurn(this);
      }
      if(getCurrentTurn() != this.player_key) {
        return console.log("oops not your turn!");
      }

      if(getLastCard() > this.sort_value) {
        return console.log("oops you must play a larger card");
      }

      return setNextTurn(this);
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    if (Players.find().count() === 0) {
      var names = ['Kevin', 'Alice', 'Ryan', 'Paul'];
      for (var i = 0; i < names.length; i++) {
        Players.insert({name: names[i], turn_number: i});
      }
    };

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
  });
}
