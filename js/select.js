// Loaded by each tab, communicates with background.htm, makes calls to searchhi_slim.js
//
//references:  http://javascript.about.com/library/blhilite2.htm

/* Uses modified version of very helpful scripts from Tim Down @ stackoverflow.com
 *      http://stackoverflow.com/questions/8076341/remove-highlight-added-to-selected-text-using-javascript?rq=1
 */

var clearBetweenSelections = true;
var singleSearch = false;
var lastText = "";
var imedBool = false;
var highlightedPage = false;
var select;

//Listener to highlight on selection
document.onmouseup = highlightSelection;

//Listener for incoming requests
chrome.extension.onRequest.addListener(processRequest)

// Handle incoming requests
function processRequest(request, sender, sendResponse)
{
    switch(request.command)
    {
        case "highlight":
            highlightSelection();
            break;
            
        case "clearHighlights":
            clearHighlightsOnPage();
            break;
            
        case "updateBooleans":
            var value = request.value;
            updateBooleans(value[0], value[1], value[2])
            break;
    }
    
}

function componentFromStr(numStr, percent) {
    var num = Math.max(0, parseInt(numStr, 10));
    return percent ? Math.floor(255 * Math.min(100, num) / 100) : Math.min(255, num);
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
        var colStr = r.toLowerCase(), result;

        // Check for hex value first, the short hex value, then rgb value
        if ( (result = hexRegex.exec(colStr)) ) {
            var hexNum = parseInt(result[1], 16);
            r = hexNum >> 16;
            g = (hexNum & 0xff00) >> 8;
            b = hexNum & 0xff;
        } else if ( (result = shortHexRegex.exec(colStr)) ) {
            r = parseInt(result[1] + result[1], 16);
            g = parseInt(result[2] + result[2], 16);
            b = parseInt(result[3] + result[3], 16);
        } else if ( (result = rgbRegex.exec(colStr)) ) {
            r = componentFromStr(result[1], result[2]);
            g = componentFromStr(result[3], result[4]);
            b = componentFromStr(result[5], result[6]);
        } else if (colStr == "transparent") {
            r = -1;
            g = -1;
            b = -1;
        } else {
            //throw new Error("Color: Unable to parse color string '" + colStr + "'");
            //why do that? it just kills the javascript...
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

//Highlight all occurances of the current selection
function highlightSelection(e) 
{
    selection = window.getSelection();
    // Clear all highlights if requested
    if (clearBetweenSelections && highlightedPage == true)
    {
        clearHighlightsOnPage();
    }
    
    //Skip this section if mouse event is undefined
    if (e != undefined)
    {
    
        //Ignore right clicks; avoids odd behavior with CTRL key
        if (e.button == 2)
        {
            return;
        }

        //Exit if CTRL key is held while auto highlight is checked on
        if(imedBool && e.ctrlKey)
        {
            return;
        }
        
        //Exit if CTRL key not held and auto highlight is checked off
        if(!imedBool && !e.ctrlKey)
        {
            return;
        }
    }
    
    var selectedText = window.getSelection().toString().replace(/^\s+|\s+$/g, "");
    var testText = selectedText.toLowerCase();
    
    //Exit if selection is whitespace or what was previously selected
    if (selectedText == '' || lastText == testText)
    {
        return;
    }
    
    if (selection.toString() != '') {
        var mySpan = document.createElement("span");
        var prevSpan = document.getElementById("mySelectedSpan");
        if (prevSpan != null) {
            prevSpan.removeAttribute("id");
        }
        mySpan.id = "mySelectedSpan";
        var range = selection.getRangeAt(0).cloneRange();
        mySpan.appendChild(range.extractContents());
        range.insertNode(mySpan);
    }
    
    //Perform highlighting
    document.designMode = "on";
    localSearchHighlight(selectedText, singleSearch);
    highlightedPage = true;
    document.designMode = "off";
    
    //Store processed selection for next time this method is called
    lastText = testText;
}

function highlight(color) {
    color = "ffff00"; //just make it always yellow (that's what we want for now)
    document.execCommand("BackColor", false, color);
}

// Clears all highlights on the page
function clearHighlightsOnPage()
{
    unhighlight(document.getElementsByTagName('body')[0], "ffff00");
    highlightedPage = false;
    lastText = "";
}

function unhighlight(node, color) {
    if (!(color instanceof Color)) {
        color = new Color(color);
    }

    if (node.nodeType == 1) {
        var bg = node.style.backgroundColor;
        if (bg && color.equals(new Color(bg))) {
            node.style.backgroundColor = "";
        }
    }
    var child = node.firstChild;
    while (child) {
        unhighlight(child, color);
        child = child.nextSibling;
    }
}

function updateBooleans(clearBool, highlightOnSelect, singleBool)
{
    clearBetweenSelections = clearBool;
    imedBool = highlightOnSelect;
    singleSearch = singleBool;
}

// Update settings
function processGetSettings(response)
{
    updateBooleans(response.clearBetweenSelect, response.highlightOnSelect, response.singleWordSearch);
}

chrome.extension.sendRequest({command:"getSettings"},processGetSettings);

/* Main content for highlighting
 * 
 * Highlighting is powered by a modified version of searchhi_slim.js:
 *      http://www.tedpavlic.com/post_simple_inpage_highlighting_example.php
 * as well as very helpful scripts from Tim Down @ stackoverflow.com
 *      http://stackoverflow.com/questions/8076341/remove-highlight-added-to-selected-text-using-javascript?rq=1
 */

var highlightRange = document.createRange();

/* New from Rob Nitti, who credits 
 * http://bytes.com/groups/javascript/145532-replace-french-characters-form-inp
 * The code finds accented vowels and replaces them with their unaccented version. 
 */
function stripVowelAccent(str)
{
    var rExps =
    [ 
        /[\xC0-\xC2]/g, /[\xE0-\xE2]/g,
        /[\xC8-\xCA]/g, /[\xE8-\xEB]/g,
        /[\xCC-\xCE]/g, /[\xEC-\xEE]/g,
        /[\xD2-\xD4]/g, /[\xF2-\xF4]/g,
        /[\xD9-\xDB]/g, /[\xF9-\xFB]/g 
    ];

    var repChar = ['A','a','E','e','I','i','O','o','U','u'];

    for(var i=0; i<rExps.length; ++i)
    {
        str=str.replace(rExps[i],repChar[i]);
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
function highlightWord(node, word, doc) 
{
    doc = typeof(doc) != 'undefined' ? doc : document;
    var hinodes = [], coll;
    // Iterate into this nodes childNodes
    if (node.hasChildNodes) 
    {
        var hi_cn;
        for (hi_cn=0; hi_cn < node.childNodes.length; hi_cn++) 
        {
            coll = highlightWord(node.childNodes[hi_cn],word,doc);
            hinodes = hinodes.concat(coll);
        }
    }

    // And do this node itself
    if (node.nodeType == 3) // text node
    { 
        tempNodeVal = stripVowelAccent(node.nodeValue.toLowerCase());
        tempWordVal = stripVowelAccent(word.toLowerCase());
        ni = tempNodeVal.indexOf(tempWordVal);
        
        if (ni != -1) 
        {
            nv = node.nodeValue;
            highlightRange.setStart(node, ni);
            highlightRange.setEnd(node, ni+word.length);
            if (highlightRange) {
                selection.removeAllRanges();
                selection.addRange(highlightRange);
            }
            highlight();
        }
    }
    return hinodes;
}

//Entry point from select.js
function localSearchHighlight(searchStr, singleWordSearch, doc) 
{
    var MAX_WORDS = 50; //limit for words to search, if unlimited, browser may crash
    doc = typeof(doc) != 'undefined' ? doc : document;
    
    if (!doc.createElement) 
    {
        return;
    }
    
    // Trim leading and trailing spaces after unescaping
    searchstr = unescape(searchStr).replace(/^\s+|\s+$/g, "");
    
    if( searchStr == '' ) 
    {
        return;
    }
    
    //majgis: Single search option
    if(singleWordSearch)
    {
        phrases = searchStr.replace(/\+/g,' ').split(/\"/);
    }
    else
    {
        phrases = ["",searchStr];
    }
    
    var hinodes = [];
    
    for(p=0; p < phrases.length; p++) 
    {
        phrases[p] = unescape(phrases[p]).replace(/^\s+|\s+$/g, "");
        
        if( phrases[p] == '' ) 
        {
            continue;
        }
        
        if( p % 2 == 0 ) 
        {
            words = phrases[p].replace(/([+,()]|%(29|28)|\W+(AND|OR)\W+)/g,' ').split(/\s+/);
        }
        else 
        { 
            words=Array(1); 
            words[0] = phrases[p]; 
        }
        
        //limit length to prevent crashing browser
        if (words.length > MAX_WORDS)
        {
            words.splice(MAX_WORDS - 1, phrases.length - MAX_WORDS);
        }
        
        for (w=0; w < words.length; w++) 
        {
            if( words[w] == '' ) 
            {
                continue;
            }
            
            hinodes = highlightWord(doc.getElementsByTagName("body")[0], words[w], doc);
        }
    }
    
    selection.removeAllRanges();
    var oldSelection = document.getElementById("mySelectedSpan");
    var reselectRange = document.createRange();
    reselectRange.selectNode(oldSelection);
    selection.addRange(reselectRange);
}