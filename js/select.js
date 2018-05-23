// Loaded by each tab, communicates with background.htm, makes calls to searchhi_slim.js
//
//references:  http://javascript.about.com/library/blhilite2.htm

/* Uses modified version of very helpful scripts from Tim Down @ stackoverflow.com
 *      http://stackoverflow.com/questions/8076341/remove-highlight-added-to-selected-text-using-javascript?rq=1
 */

var clearBetweenSelections = true;
var lastText = "";
var imedBool = false;
var highlightedPage = false;
var select;
var triggeredOnce = false;

// Listener to highlight on selection
document.onmouseup = highlightSelection;
document.onmousedown = function(event) {
  if (event != undefined) {
    if (triggeredOnce && event.button == 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
};

// Listener for incoming requests
chrome.extension.onRequest.addListener(processRequest);

// Handle incoming requests
function processRequest(request, sender, sendResponse) {
  switch (request.command) {
    case "highlight":
      highlightSelection();
      break;

    case "clearHighlights":
      clearHighlightsOnPage();
      break;

    case "updateBooleans":
      var value = request.value;
      updateBooleans(value[0], value[1], value[2]);
      break;
  }
}

function componentFromStr(numStr, percent) {
  var num = Math.max(0, parseInt(numStr, 10));
  return percent
    ? Math.floor(255 * Math.min(100, num) / 100)
    : Math.min(255, num);
}

var rgbRegex = /^rgb\(\s*(-?\d+)(%?)\s*,\s*(-?\d+)(%?)\s*,\s*(-?\d+)(%?)\s*\)$/,
  hexRegex = /^#?([a-f\d]{6})$/,
  shortHexRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/;

function Color(r, g, b) {
  // Make a new Color object even when Color is not called with the new operator
  if (!(this instanceof Color)) {
    return new Color(r, g, b);
  }

  if (typeof g == "undefined") {
    // Parse the color string
    var colStr = r.toLowerCase(),
      result;

    // Check for hex value first, the short hex value, then rgb value
    if ((result = hexRegex.exec(colStr))) {
      var hexNum = parseInt(result[1], 16);
      r = hexNum >> 16;
      g = (hexNum & 0xff00) >> 8;
      b = hexNum & 0xff;
    } else if ((result = shortHexRegex.exec(colStr))) {
      r = parseInt(result[1] + result[1], 16);
      g = parseInt(result[2] + result[2], 16);
      b = parseInt(result[3] + result[3], 16);
    } else if ((result = rgbRegex.exec(colStr))) {
      r = componentFromStr(result[1], result[2]);
      g = componentFromStr(result[3], result[4]);
      b = componentFromStr(result[5], result[6]);
    } else if (colStr == "transparent") {
      r = -1;
      g = -1;
      b = -1;
    } else {
      //throw new Error("Color: Unable to parse color string '" + colStr + "'");
      //why do that^^? it just kills the javascript...
      r = -1;
      g = -1;
      b = -1;
    }
  }

  this.r = r;
  this.g = g;
  this.b = b;
}

Color.prototype = {
  equals: function(color) {
    return this.r == color.r && this.g == color.g && this.b == color.b;
  }
};

const RIGHT_MOUSE_CLICK = 2;

// Main entry point.
// Highlight all occurances of the current selection
function highlightSelection(event) {
  selection = window.getSelection();

  // Skip this section if mouse event is undefined
  if (event !== undefined) {
    // Ignore right clicks; avoids odd behavior with CTRL key
    if (e.button == RIGHT_MOUSE_CLICK) {
      return;
    }

    // Exit if CTRL key is held while auto highlight is checked on
    if (imedBool && event.ctrlKey) {
      return;
    }

    // Exit if CTRL key not held and auto highlight is checked off
    if (!imedBool && !event.ctrlKey) {
      return;
    }
  }

  var selectionTagName;
  // Avoid inputs like the plague..
  try {
    selectionTagName = selection.anchorNode.childNodes[0].tagName.toLowerCase();
  } catch (err) {
    // Fail silently
    return;
  }

  if (selectionTagName == "input") {
    return;
  }

  var selectedText = window
    .getSelection()
    .toString()
    .replace(/^\s+|\s+$/g, "");

  if (selectedText == "") return;

  var lowerCasedText = selectedText.toLowerCase();
  // Exit if selection is  what was previously selected
  if (lastText == lowerCasedText) {
    return;
  }

  if (selection.toString() != "") {
    var spanElement = document.createElement("span");

    // Remove id from previously selected
    var prevSpan = document.getElementById("mySelectedSpan");
    if (prevSpan != null) {
      prevSpan.removeAttribute("id");
    }

    spanElement.id = "mySelectedSpan";

    var range = selection.getRangeAt(0).cloneRange();

    // Add text to span element
    spanElement.appendChild(range.extractContents());

    // Insert span element into the range
    range.insertNode(spanElement);
  }

  // Limit for words to search, if unlimited, browser may crash
  var MAX_WORDS = 50;
  var doc = document;

  if (!doc.createElement) {
    return;
  }

  searchStr = searchStr.trim();

  var MIN_WORD_LEN = 3;
  if (searchStr.length < MIN_WORD_LEN) {
    return;
  }

  let color = generateColorCode();

  highlightWord(
    doc.getElementsByTagName("body")[0],
    searchStr,
    doc,
    color
  );
}

function highlight(color) {
  document.designMode = "on";
  document.execCommand("BackColor", false, color);
  document.designMode = "off";
}

// Clears all highlights on the page
function clearHighlightsOnPage() {
  unhighlight(document.getElementsByTagName("body")[0], "ffff00");
  highlightedPage = false;
  lastText = "";
}

function unhighlight(node, color) {
  // If the passed color string isn't a Color object, convert it
  if (!(color instanceof Color)) {
    color = new Color(color);
  }

  // Test to see if we've found an element node that has our same backgroundColor
  if (node.nodeType == 1) {
    var bg = node.style.backgroundColor;
    if (bg && color.equals(new Color(bg))) {
      //remove background color
      node.style.backgroundColor = "";
      if (node.tagName.toLowerCase() == "span") {
        var parentNode = node.parentNode;
        removeSpanTag(node);
        unhighlight(parentNode, "ffff00");
      }
    }
  }
  // Now recurse through all children of the passed node
  var child = node.firstChild;
  while (child) {
    unhighlight(child, color);
    child = child.nextSibling;
  }
}

// Removes the span tag from the passed node
// node : must be the element node of the span (the <span> node, not it's textnode contents)
function removeSpanTag(node) {
  var spliceText = node.innerHTML;
  var tempTextNode = document.createTextNode(spliceText);
  var parentNode = node.parentNode;
  parentNode.replaceChild(tempTextNode, node);
  parentNode.normalize;
}

function updateBooleans(clearBool, highlightOnSelect, singleBool) {
  clearBetweenSelections = clearBool;
  imedBool = highlightOnSelect;
  singleSearch = singleBool;
}

// Update settings
function processGetSettings(response) {
  updateBooleans(
    false,
    true,
    false
  );

  //updateBooleans(
  //  response.clearBetweenSelect,
  //  response.highlightOnSelect,
  //  response.singleWordSearch
  //);
}

chrome.extension.sendRequest({ command: "getSettings" }, processGetSettings);

/* Main content for highlighting
 *
 * Highlighting is powered by a modified version of searchhi_slim.js:
 *      http://www.tedpavlic.com/post_simple_inpage_highlighting_example.php
 * as well as very helpful scripts from Tim Down @ stackoverflow.com
 *      http://stackoverflow.com/questions/8076341/remove-highlight-added-to-selected-text-using-javascript?rq=1
 */

var highlightRange = document.createRange();
var colorgen;

/* New from Rob Nitti, who credits
 * http://bytes.com/groups/javascript/145532-replace-french-characters-form-inp
 * The code finds accented vowels and replaces them with their unaccented version.
 */
function stripVowelAccent(str) {
  var rExps = [
    /[\xC0-\xC2]/g,
    /[\xE0-\xE2]/g,
    /[\xC8-\xCA]/g,
    /[\xE8-\xEB]/g,
    /[\xCC-\xCE]/g,
    /[\xEC-\xEE]/g,
    /[\xD2-\xD4]/g,
    /[\xF2-\xF4]/g,
    /[\xD9-\xDB]/g,
    /[\xF9-\xFB]/g
  ];

  var repChar = ["A", "a", "E", "e", "I", "i", "O", "o", "U", "u"];

  for (var i = 0; i < rExps.length; ++i) {
    str = str.replace(rExps[i], repChar[i]);
  }

  return str;
}

/* Modification of
 * http://www.kryogenix.org/code/browser/searchhi/
 * See:
 *   http://www.tedpavlic.com/post_highlighting_search_results_with_ted_searchhi_javascript.php
 *   http://www.tedpavlic.com/post_inpage_highlighting_example.php
 * for additional modifications of this base code.
 */
function highlightWord(node, word, doc, color) {
  doc = typeof doc != "undefined" ? doc : document;
  var hinodes = [], coll;

  // Iterate into this nodes childNodes
  if (node.hasChildNodes) {
    var hi_cn;
    for (hi_cn = 0; hi_cn < node.childNodes.length; hi_cn++) {
      coll = highlightWord(node.childNodes[hi_cn], word, doc, color);
      hinodes = hinodes.concat(coll);
    }
  }

  var TEXT_NODE_TYPE = 3;

  // And do this node itself
  if (node.nodeType == TEXT_NODE_TYPE) {
    // Text node
    tempNodeVal = stripVowelAccent(node.nodeValue.toLowerCase());
    tempWordVal = stripVowelAccent(word.toLowerCase());
    ni = tempNodeVal.indexOf(tempWordVal);

    if (ni != -1) {
      nv = node.nodeValue;
      highlightRange.setStart(node, ni);
      highlightRange.setEnd(node, ni + word.length);

      if (highlightRange) {
        selection.removeAllRanges();
        selection.addRange(highlightRange);
      }
      highlight(color);
    }
  }
  return hinodes;
}

function localSearchHighlight(searchStr) {

  // selection.removeAllRanges();
  // var oldSelection = document.getElementById("mySelectedSpan");
  // var reselectRange = document.createRange();
  // reselectRange.selectNode(oldSelection);
  // selection.addRange(reselectRange);
}

var colorCodes = [
  "#FFFF00", // yellow
  "#FFA07A", // light salmon
  "#DDA0DD", // plum
  "#00FFFF", // aqua
  "#A3A375", // light brown
  "#008080", // teal
  "#FFA07A" // light salmon
];

var colorIndex = 0;

function generateColorCode() {
  if (colorIndex >= colorCodes.length) colorIndex = 0;
  return colorCodes[colorIndex++];
}
