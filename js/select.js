// Loaded by each tab, communicates with background.htm, makes calls to searchhi_slim.js
//
//references:  http://javascript.about.com/library/blhilite2.htm

/* Uses modified version of very helpful scripts from Tim Down @ stackoverflow.com
 *      http://stackoverflow.com/questions/8076341/remove-highlight-added-to-selected-text-using-javascript?rq=1
 */

var select;

var ranges = [];
var set = new Set();

document.ondblclick = highlightSelection;
document.onmouseup = highlightSelection;

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


// Main entry point.
// Highlight all occurances of the current selection
function highlightSelection(event) {
  var selectedText = window
    .getSelection()
    .toString()
    .replace(/^\s+|\s+$/g, "").trim();

  if (selectedText == "") return;

  let color = generateColorCode();
  highlightWordRecursively(document.body, selectedText, color);

  set.clear();

  if (event.type == 'dblclick') {
    window.getSelection().removeAllRanges();
  }
}


function applyFunc(node, searchString, color) {
  let parentNode = node.parentNode;
  let text = node.nodeValue;

  let pattern = '\\b' + searchString + '\\b';
  let regex = new RegExp(pattern, 'g');
  let match;
  let selection = window.getSelection();

  while (match = regex.exec(text)) {
    if (set.has(text)) return;
    set.add(text);

    let startIndex = regex.lastIndex - match[0].length;
    let endIndex = regex.lastIndex;

    let range = document.createRange();
    range.setStart(node, startIndex);
    range.setEnd(node, endIndex);

    selection.removeAllRanges();
    selection.addRange(range);
    myHighlight(color);

    regex = new RegExp(pattern, 'g');
    text = node.nodeValue;
  }
  return;
}

function replaceAll(str, find, replace) {
    find = '\\b' + find + '\\b';
    return str.replace(new RegExp(find, 'g'), replace);
}

function highlightWordRecursively(element, searchString, color){
  let node;
  let textNodes = [];
  let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);

  while(node = walker.nextNode()) {
    if (node.nodeValue.indexOf(searchString) != -1) {
      console.log("found " + searchString);
        applyFunc(node, searchString, color);
    }
  }
  return textNodes;
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
      // Remove background color
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




function makeEditableAndHighlight(colour) {
    // var range;
    // var sel = window.getSelection();
    //
    // if (sel.rangeCount && sel.getRangeAt) {
    //     range = sel.getRangeAt(0);
    // }
    //
    // if (range) {
    //     sel.removeAllRanges();
    //     sel.addRange(range);
    // }

    document.designMode = "on";
    // Use HiliteColor since some browsers apply BackColor to the whole block
    if (!document.execCommand("HiliteColor", false, colour)) {
        document.execCommand("BackColor", false, colour);
    }
    document.designMode = "off";
}

function myHighlight(colour) {
    //var range, sel;
    makeEditableAndHighlight(colour);

    // if (window.getSelection) {
    //     // IE9 and non-IE
    //     try {
    //         if (!document.execCommand("BackColor", false, colour)) {
    //             makeEditableAndHighlight(colour);
    //         }
    //     } catch (ex) {
    //         makeEditableAndHighlight(colour)
    //     }
    // } else if (document.selection && document.selection.createRange) {
    //     // IE <= 8 case
    //     range = document.selection.createRange();
    //     range.execCommand("BackColor", false, colour);
    // }
}

// $(function() {
//   $('#content').mouseup(function(){
//         highlight('#D4FF00');
//   });
// });
