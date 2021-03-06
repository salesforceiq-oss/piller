var getLastNWords = require('../util/getLastNWords');
var getWords = require('../util/getWords');

module.exports = doPillSearch;

function doPillSearch(ui, props) {
  var selStart = ui.textarea.selectionStart;
  var valAtCaret = ui.textarea.value.substring(0, selStart);
  var pillAtCaret;

  if (!valAtCaret || (props.originalKeyEvent && props.originalKeyEvent.which === 13)) {
    return [];
  }

  props.modelValue.getPills().some(function(pill) {
    if (selStart > pill.positionStart && selStart <= pill.positionEnd) {
      pillAtCaret = pill;
      return true;
    }
  });

  if (pillAtCaret) {
    return [];
  }

  var maxSearchWordsForItems = 0;
  var searchPrefixData = {};
  props.pillSearchMatches.length = 0;
  props.pillSearchQueryMatches.length = 0;

  props.getPillCorpus().forEach(function(pill) {
    if (pill.maxSearchWords > maxSearchWordsForItems) {
      maxSearchWordsForItems = pill.maxSearchWords;
    }

    searchPrefixData[pill.searchPrefix] = searchPrefixData[pill.searchPrefix] || {};
    searchPrefixData[pill.searchPrefix].items = searchPrefixData[pill.searchPrefix].items || [];
    searchPrefixData[pill.searchPrefix].items.push(pill);

    var minCharsForPrefix = searchPrefixData[pill.searchPrefix].minChars;
    if (typeof minCharsForPrefix !== 'number' || pill.minSearchCharacters < minCharsForPrefix) {
      searchPrefixData[pill.searchPrefix].minChars = pill.minSearchCharacters;
    }

    var maxWordsForPrefix = searchPrefixData[pill.searchPrefix].maxWords;
    if (typeof maxWordsForPrefix !== 'number' || pill.maxSearchWords < maxWordsForPrefix) {
      searchPrefixData[pill.searchPrefix].maxWords = pill.maxSearchWords;
    }
  });

  Object.keys(searchPrefixData).forEach(function(searchPrefix) {
    var data = searchPrefixData[searchPrefix];
    var lastWords = getLastNWords(valAtCaret, data.maxWords, true);
    var matches = getSearchQueryMatches(props, searchPrefix, lastWords, data.minChars, data.items);

    if (matches && matches.length) {
      props.pillSearchQueryMatches = props.pillSearchQueryMatches.concat(matches);
    }
  });


  props.pillSearchMatches = props.pillSearchQueryMatches.map(function(queryMatch) {
    return queryMatch.pill;
  });

  return props.pillSearchMatches;
}

function getSearchQueryMatches(props, searchPrefix, lastWords, minSearchCharacters, pillsForPrefix) {
  if (!lastWords) {
    return null;
  }

  if (searchPrefix && lastWords.lastIndexOf(searchPrefix) === (lastWords.length - searchPrefix.length)) {
    return pillsForPrefix.map(function(pill) {
      return {
        query: searchPrefix,
        pill: pill
      };
    });
  }

  var hasWordsStartingWithSearchPrefix = false;

  if (searchPrefix) {
    var tempWords = getWords(lastWords);

    for (var i = tempWords.length - 1; i >= 0; i--) {
      if (tempWords[i].indexOf(searchPrefix) === 0) {
        lastWords = tempWords.slice(i).join(' ') + (lastWords[lastWords.length - 1] === ' ' ? ' ' : '');
        hasWordsStartingWithSearchPrefix = true;
        break;
      }
    }
  }

  if (!hasWordsStartingWithSearchPrefix && lastWords.length < minSearchCharacters) {
    return null;
  }

  return pillsForPrefix.reduce(function(arr, pill) {
    var match = getQueryMatch(pill.searchText, lastWords, searchPrefix, minSearchCharacters);

    if (match) {
      arr.push({
        query: match,
        pill: pill
      });
    }

    return arr;
  }, []);
}

function getQueryMatch(compareWith, lastWords, searchPrefix, minSearchCharacters) {
  if (compareWith) {
    var wordsLen = getWords(lastWords).length;

    for (var i = wordsLen; i > 0; i--) {
      var str = getLastNWords(lastWords, i, true);
      var hasSearchPrefix = !!searchPrefix && str.indexOf(searchPrefix) === 0;
      var query = hasSearchPrefix ? str.substring(searchPrefix.length) : str;
      var compareWithLen = getWords(compareWith).length;
      query = query.toLowerCase();

      for (var j = compareWithLen; j > 0; j--) {
        var compareWords = getLastNWords(compareWith, j, false);

        if (compareWords && compareWords.toLowerCase().indexOf(query) === 0) {
          return ((hasSearchPrefix && query.length) || str.length >= minSearchCharacters) ? str : null;
        }
      }
    }
  }
  return null;
}