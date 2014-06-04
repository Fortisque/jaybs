Cards = new Meteor.Collection("cards");
Players = new Meteor.Collection("players");
Singletons = new Meteor.Collection("singletons");
Games = new Meteor.Collection("games");

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
      // smallest card not played, the player turn is the first.
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

var evaluatePokerHand = function (cards) {
  // this is length 5.

  var ranks = new Array("3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K" ,"A", "2");
  var myRanks = [ranks.indexOf(cards[0].rank), ranks.indexOf(cards[1].rank), ranks.indexOf(cards[2].rank), ranks.indexOf(cards[3].rank), ranks.indexOf(cards[4].rank)];
  myRanks.sort();

  var isFlush = function(cards) {
    return cards[0].suit == cards[1].suit == cards[2].suit == cards[3].suit == cards[4].suit
  }

  var isStraight = function(cards) {
    var start = myRanks[0];
    for(var i = 1; i < cards.length; i++) {
      start++;
      if(ranks.indexOf(myRanks[i]) != start) {
        return false;
      }

    }
    return true;
  }

  var maxSortValue = -1;
  for(var i = 0; i < cards.length; i++) {
    maxSortValue = Math.max(maxSortValue, cards.sort_value);
  }
  // maxSortValue serves as an tiebreaker.

  if(isFlush(cards)) {
    if(isStraight(cards)) {
      return ['STRAIGHTFLUSH', maxSortValue]; // handles Royal and Straight Flush
    }

    return ['FLUSH', maxSortValue]; // handles Flush
  }

  if(isStraight(cards)) {
    return ['STRAIGHT', maxSortValue]; // handles straight
  }

  var myRanksDict = {};
  for(var i = 0; i < myRanks.length; i++) {
    if(myRanksDict[myRanks[i]] == undefined) {
      myRanksDict[myRanks[i]] = 0;
    }
    myRanksDict[myRanks[i]] += 1;
  }

  console.log(myRanksDict);

  var maxOccuranceValue = -1;
  var maxOccuranceKey = -1;
  for (var key in myRanksDict) {
    if(myRanksDict[key] > maxOccuranceValue) {
      maxOccuranceValue = myRanksDict[key];
      maxOccuranceKey = key;
    }
  };

  if(maxOccuranceValue == 4) {
    return ['FOUR', maxOccuranceKey]; // handles four of a kind
  }

  myRanksDict[maxOccuranceKey] = 0; // clobber the dictionary to find the 2nd max.
  var nextOccuranceValue = -1;
  var nextOccuranceKey = -1;
  for (var key in myRanksDict) {
    if(myRanksDict[key] > nextOccuranceValue) {
      nextOccuranceValue = myRanksDict[key];
      nextOccuranceKey = key;
    }
  };

  if(maxOccuranceValue == 3) {
    if(nextOccuranceValue == 2) {
      return ['FULLHOUSE', maxOccuranceKey]; // handle full house
    }
  }

  // Three of a kind, Two Pair, One Pair and High Cards are not valid in this game.
  return false;
}

var validHand = function (cards) {
  if(cards.length == 1) {
    return true; // all singles are valid
  }

  if(cards.length == 2) {
    return cards[0].rank == cards[1].rank; // valid pair
  }

  if(cards.length == 3) {
    // valid triple
    return cards[0].rank == cards[1].rank == cards[2].rank;
  }

  if(cards.length != 5) {
    return false;
  }

  if(!evaluatePokerHand(cards)) { // wasn't a real poker hand
    return false;
  }

  return true;
}

var firstHandBetter = function (cardsTryingToPlay, cardsToOverride) {
  // kinds of hands, lower is better
  var handArray = ['STRAIGHTFLUSH', 'FOUR', 'FULLHOUSE', 'FLUSH', 'STRAIGHT'];

  var tryingEval = evaluatePokerHand(cardsTryingToPlay);
  var overrideEval = evaluatePokerHand(cardsToOverride);
  var tryingRanked = handArray.indexOf(tryingEval[0]);
  var overrideRanked = handArray.indexOf(overrideEval[0]);
  if(tryingRanked < overrideRanked) {
    return true;  // new hand was clearly better
  }

  if(overrideRanked != tryingRanked) {
    return false; // old hand was clearly better
  }
  
  return tryingEval[1] > overrideEval[1]; // Tied hands, use the tiebreaker
}

var validPlay = function () {
  var cardsTryingToPlay = Cards.find({player_key: SELECTED}).fetch();
  if(!validHand(cardsTryingToPlay)) {
    return false;
  }

  // this is a valid singe, double, triple or poker hand.

  var cardsToOverride = Cards.find({player_key:LASTPLAYED}).fetch();
  if(cardsToOverride.length === 0) { // first to play this round
    if(Cards.find({player_key:DISCARD}).fetch().length === 0) { // first play in game.
      var smallestCard = Cards.findOne({sort_value: 0});
      for(var i = 0; i < cardsTryingToPlay.length; i++) {
        if(smallestCard.sort_value == cardsTryingToPlay[i].sort_value) {
          return true;
        }
      }
      return false; // invalid play, must include 3 of clubs (smallest card)
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
    // Sometimes ties (same rank pairs) can occur.  This makes sure the top card is used as tiebreaker.
    var bestTryingToPlay = Math.max(cardsTryingToPlay[0].sort_value, cardsTryingToPlay[1].sort_value);
    var bestTryingToOverride = Math.max(cardsToOverride[0].sort_value, cardsToOverride[1].sort_value);
    return bestTryingToPlay > bestTryingToOverride;
  }

  return firstHandBetter(cardsTryingToPlay, cardsToOverride)
}


if (Meteor.isClient) {


  Meteor.startup(function () {
    var player_id = Players.insert({name: ''});
    Session.set('player_id', player_id);
  });

  var player = function () {
    return Players.findOne(Session.get('player_id'));
  };

  Template.page.playerName = function () {
    var me = player();
    if (me && me.name) {
      return me.name;
    }
  }

  var game = function () {
    var me = player();
    return me && me.game_id && Games.findOne(me.game_id);
  };

  Template.page.showLobby = function () {
    // only show lobby if we're not in a game
    return !game();
  };

  Template.lobby.waiting = function () {
    var players = Players.find({_id: {$ne: Session.get('player_id')},
                                name: {$ne: ''},
                                game_id: {$exists: false}});

    return players;
  };

  Template.lobby.count = function () {
    var players = Players.find({_id: {$ne: Session.get('player_id')},
                                name: {$ne: ''},
                                game_id: {$exists: false}});

    return players.count();
  };

  Template.lobby.disabled = function () {
    var me = player();
    if (me && me.name)
      return '';
    return 'disabled';
  };

  var trim = function (string) { return string.replace(/^\s+|\s+$/g, ''); };

  Template.lobby.events({
    'keyup input#myname': function (evt) {
      var name = trim($('#lobby input#myname').val());
      Players.update(Session.get('player_id'), {$set: {name: name}});
    },
    'click button.startgame': function () {
      var game_id = Games.insert({});
      // TODO
      // enforce 4 players.
      var p = Players.find({game_id: null, name: {$ne: ''}}).fetch();
      for(var i = 0; i < p.length; i++) {
        Players.update(p[i]._id, {$set: {game_id: game_id, turn_number: i}});
      }
      Games.update({_id: game_id}, {$set: {players: p}});
    }
  });

  //////////////////
  ///// TABLE //////
  //////////////////

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
    return Players.find({}, {sort: {turn_number: 1}});
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
      if (!myTurn(player()._id)) {
        console.log("not your turn!");
        return;
      }


      if(!validPlay()) {
        return console.log("oops your play was not valid");
      }


      // move last played to played
      var lastPlayedCards = Cards.find({player_key: LASTPLAYED}).fetch();
      for(var i = 0; i < lastPlayedCards.length; i++) {
        Cards.update(lastPlayedCards[i]._id, {$set: {player_key: PLAYED}});
      }

      var cards = Cards.find({player_key: SELECTED}).fetch();
      // move selected to last played
      for(var i = 0; i < cards.length; i++) {
        Cards.update(cards[i]._id, {$set: {player_key: LASTPLAYED}});
      }


      return setNextTurn(cards);
    }
  });

  Template.player.events({
    'click input.sort': function() {
      /*Cards.update({player_key: this._id},
                   {$set: {shuffle_key: cardsArr[i].sort_value}},
                   {multi: true});*/
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
       setCurrentPlayer(nextPlayer._id);
      return;
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

    if (Cards.find().count() === 0) {
      var suits = new Array("C", "D", "H", "S");
      var ranks = new Array("3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K" ,"A", "2");
      for (var i = 0; i < suits.length; i++) {
        for (var j = 0; j < ranks.length; j++) {
          Cards.insert({suit: suits[i], rank: ranks[j], sort_value: i + j*suits.length});
        }
      }
    }
  });
}
