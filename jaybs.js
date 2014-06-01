Cards = new Meteor.Collection("cards");
Players = new Meteor.Collection("players");
Singletons = new Meteor.Collection("singletons");

var SELECTED = -1;
var LASTPLAYED = -2;
var PLAYED = -3;
var DISCARD = -4;

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

  setCurrentPlayer(-1);
  setLastPlayer(-1);
}

var setNextTurn = function (cards) {
  var player = Players.findOne({_id: cards[0].orig_player_key}); // one two three or 5 cards were played
  var nextPlayer = Players.findOne({turn_number: (player.turn_number + 1) % Players.find().count()});
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

var validPlay = function () {
  var cardsTryingToPlay = Cards.find({player_key: SELECTED}).fetch();
  // TODO
  // make sure cardsTryingToPlay is a single, valid double, valid triple or valid poker hand.
  var cardsToOverride = Cards.find({player_key:LASTPLAYED}).fetch();
  if(cardsToOverride.length === 0) { // first to play this round
    if(Cards.find({player_key:DISCARD}).fetch().length === 0) { // first play in game.
      // must include the three of clubs (the smallest card)
      var smallestCard = Cards.findOne({sort_value: 0});
      for(var i = 0; i < cardsTryingToPlay.length; i++) {
        if(smallestCard.sort_value == cardsTryingToPlay[i].sort_value) {
          return true;
        }
      }
      return false; // invalid play, must include 3 of clubs.
    }

    return true; // can play any valid hand over nothing.
  }

  if(cardsToOverride.length !== cardsTryingToPlay.length) {
    return false;  // Once a round starts can only play same # cards.
  }

  if(cardsToOverride.length === 1 || cardsToOverride.length === 3) {
    // For singles and triples only have to play higher. (Two players can't have same # triple b/c only 4 cards in a suit)
    return cardsTryingToPlay[0].sort_value > cardsToOverride[0].sort_value;
  }

  if(cardsToOverride.length === 2) {
    // Sometimes ties can occur.  This makes sure the top card is used as tiebreaker.
    var bestTryingToPlay = max(cardsTryingToPlay[0].sort_value, cardsTryingToPlay[1].sort_value);
    var bestTryingToOverride = max(cardsTryingToOverride[0].sort_value, cardsTryingToOverride[1].sort_value);
    return bestTryingToPlay > bestTryingToOverride;
  }

  // TODO
  // evaluate whether the 5 card poker hand is better or not!
  return true;
}


if (Meteor.isClient) {

  Template.table.playedCards = function () {
    return Cards.find({player_key: PLAYED}, {sort: {shuffle_key: 1}});
  };

  Template.table.discardCards = function () {
    return Cards.find({player_key: DISCARD}, {sort: {shuffle_key: 1}});
  };

  Template.table.selectedCards = function () {
    return Cards.find({player_key: SELECTED}, {sort: {shuffle_key: 1}});
  };

  Template.table.lastPlayedCards = function () {
    return Cards.find({player_key: LASTPLAYED}, {sort: {shuffle_key: 1}});
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

  Template.player.lastPlayer = function () {
    var key = Singletons.findOne({name: 'last_player'});
    if(key == undefined) {
      return ''
    }
    var player = Players.findOne(getLastPlayer());
    if (player == undefined) {
      return ''
    }
    return player._id === this._id ? 'last_player' : '';
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

      var cards = Cards.find({player_key: SELECTED}).fetch();

      if(!validPlay()) {
        return console.log("oops your play was not valid");
      }

      // move last played to played
      var lastPlayedCards = Cards.find({player_key: LASTPLAYED}).fetch();
      for(var i = 0; i < lastPlayedCards.length; i++) {
        Cards.update(lastPlayedCards[i]._id, {$set: {player_key: PLAYED}});
      }

      // move selected to last played
      for(var i = 0; i < cards.length; i++) {
        Cards.update(cards[i]._id, {$set: {player_key: LASTPLAYED}});
      }


      return setNextTurn(cards);
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
        var playedCards = Cards.find({player_key: PLAYED}).fetch(); // move all played to discard when round finshes.
        var lastPlayedCards = Cards.find({player_key:LASTPLAYED}).fetch();
        var cards = playedCards.concat(lastPlayedCards);
        for(var i = 0; i < cards.length; i++) {
          Cards.update(cards[i]._id, {$set: {player_key: DISCARD}});
        }
      }
      return setCurrentPlayer(nextPlayer._id);
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
