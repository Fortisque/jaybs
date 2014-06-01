Cards = new Meteor.Collection("cards");
Players = new Meteor.Collection("players");
Singletons = new Meteor.Collection("singletons");

var PLAYED = -1;
var SELECTED = -2;
var GRAVEYARD = -3;

var getCurrentPlayer = function() {
  return Singletons.findOne({name: 'current_player'}).player_key;
}

var setCurrentPlayer = function(number) {
  var current_turn = Singletons.findOne({name: 'current_player'});
  if (current_turn == undefined) {
    return Singletons.insert({name: 'current_player', player_key: number});
  }
  return Singletons.update(current_turn._id, {$set: {player_key: number}});
}

var getLastCard = function() {
 return Singletons.findOne({name: 'last_card'}).sort_value;
}

var setLastCard = function(sort_value) {
  var last_card = Singletons.findOne({name: 'last_card'});
  if (last_card == undefined) {
    return Singletons.insert({name: 'last_card', sort_value: sort_value});
  }
  return Singletons.update(last_card._id, {$set: {sort_value: sort_value}});
}

var getLastPlayer = function() {
  return Singletons.findOne({name: 'last_player'}).player_key;
}

var setLastPlayer = function(player_key) {
  var last_player = Singletons.findOne({name: 'last_player'});
  if (last_player == undefined) {
    return Singletons.insert({name: 'last_player', player_key: player_key});
  }
  return Singletons.update(last_player._id, {$set: {player_key: player_key}});
}

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
      var key = playerArr[player]._id;
      Cards.update(cardsArr[i]._id, {$set: {player_key: key, orig_player_key: key}});
    }
  }

  setLastCard(-1);
  setCurrentPlayer(-1);
  setLastPlayer(-1);
}

var setNextTurn = function (obj) {
  var player = Players.findOne({_id: obj.player_key});
  var nextPlayer = Players.findOne({turn_number: (player.turn_number + 1) % Players.find().count()});
  setLastCard(obj.sort_value);
  setLastPlayer(player._id);
  return setCurrentPlayer(nextPlayer._id);
};

var myTurn = function (player_key) {
  if(getCurrentPlayer() == -1) {
    var smallestCard = Cards.findOne({sort_value: 0});
    if (smallestCard.orig_player_key != player_key) {
      console.log("oops not your turn!");
      return false;
    }
    return true;
  }
  if(getCurrentPlayer() != player_key) {
    console.log("oops not your turn!");
    return false;
  }
  return true;
}


if (Meteor.isClient) {

  Template.table.playedCards = function () {
    return Cards.find({player_key: PLAYED}, {sort: {shuffle_key: 1}});
  };

  Template.table.graveyardCards = function () {
    return Cards.find({player_key: GRAVEYARD}, {sort: {shuffle_key: 1}});
  };

  Template.table.selectedCards = function () {
    return Cards.find({player_key: SELECTED}, {sort: {shuffle_key: 1}});
  };

  Template.table.players = function () {
    return Players.find({}, {sort: {number: 1}});
  };

  Template.player.cards = function () {
    return Cards.find({player_key: this._id}, {sort: {shuffle_key: 1}});
  };

  Template.player.selected = function () {
    var key = Singletons.findOne({name: 'current_player'});
    if(key == undefined) {
      return ''
    }
    var player = Players.findOne(getCurrentPlayer());
    if (player == undefined) {
      return ''
    }
    return player._id === this._id ? 'selected' : '';
  };

  Template.table.events({
    'click input.shuffle': function () {
      shuffle();
    },
    'click input.distribute': function () {
      distribute();
    },
    'click input.playSelectedCards': function() {
      //if !(myTurn(this._id))
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
      if (getLastPlayer() == nextPlayer._id) {
        console.log("CLEAR"); // need to do something
        setLastCard(-1); // can play anything on top of this.
      }
      return setCurrentPlayer(nextPlayer._id);
    },
    'click input.submit': function() {
      if(getCurrentPlayer() == -1) {
        if (this.sort_value != 0) {
          return console.log("oops not your turn!");
        }
        return setNextTurn(this);
      }
      if(getCurrentPlayer() != this.player_key) {
        return console.log("oops not your turn!");
      }

      if(getLastCard() > this.sort_value) {
        return console.log("oops you must play a larger card");
      }

      return setNextTurn(this);
    }
  });


  Template.card.events({
    'click input': function () {
      if(myTurn(this.orig_player_key)) {
        Cards.update(this._id, {$set: {player_key: SELECTED}});
      }
    }
  });

  Template.selectedCard.events({
    'click input': function () { // if selected its this players turn and can just return card.
      Cards.update(this._id, {$set: {player_key: this.orig_player_key}});
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

      distribute();
    }
  });
}
