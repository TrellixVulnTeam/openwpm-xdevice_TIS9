/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./feature.js/callstack-instrument.js":
/*!********************************************!*\
  !*** ./feature.js/callstack-instrument.js ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CallstackInstrument": () => (/* binding */ CallstackInstrument)
/* harmony export */ });
/*
  We capture the JS callstack when we detect a dynamically created http request
  and bubble it up via a WebExtension Experiment API stackDump.
  This instrumentation captures those and saves them to the "callstacks" table.
*/
class CallstackInstrument {
  constructor(dataReceiver) {
    this.dataReceiver = dataReceiver;
  }
  run(browser_id) {
    browser.stackDump.onStackAvailable.addListener((request_id, call_stack) => {
      const record = {
        browser_id,
        request_id,
        call_stack
      };
      this.dataReceiver.saveRecord("callstacks", record);
    });
  }
}

/***/ }),

/***/ "./feature.js/loggingdb.js":
/*!*********************************!*\
  !*** ./feature.js/loggingdb.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "open": () => (/* binding */ open),
/* harmony export */   "close": () => (/* binding */ close),
/* harmony export */   "logInfo": () => (/* binding */ logInfo),
/* harmony export */   "logDebug": () => (/* binding */ logDebug),
/* harmony export */   "logWarn": () => (/* binding */ logWarn),
/* harmony export */   "logError": () => (/* binding */ logError),
/* harmony export */   "logCritical": () => (/* binding */ logCritical),
/* harmony export */   "dataReceiver": () => (/* binding */ dataReceiver),
/* harmony export */   "saveRecord": () => (/* binding */ saveRecord),
/* harmony export */   "saveContent": () => (/* binding */ saveContent),
/* harmony export */   "escapeString": () => (/* binding */ escapeString),
/* harmony export */   "boolToInt": () => (/* binding */ boolToInt)
/* harmony export */ });
/* harmony import */ var _socket_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./socket.js */ "./feature.js/socket.js");


let crawlID = null;
let visitID = null;
let debugging = false;
let storageController = null;
let logAggregator = null;
let listeningSocket = null;


let listeningSocketCallback =  async (data) => {
    //This works even if data is an int
    let action = data["action"];
    let _visitID = data["visit_id"]
    switch (action) {
        case "Initialize":
            if (visitID) {
                logWarn("Set visit_id while another visit_id was set")
            }
            visitID = _visitID;
            data["browser_id"] = crawlID;
            storageController.send(JSON.stringify(["meta_information", data]));
            break;
        case "Finalize":
            if (!visitID) {
                logWarn("Send Finalize while no visit_id was set")
            }
            if (_visitID !== visitID ) {
                logError("Send Finalize but visit_id didn't match. " +
                `Current visit_id ${visit_id}, sent visit_id ${_visit_id}.`);
            }
            data["browser_id"] = crawlID;
            data["success"] = true;
            storageController.send(JSON.stringify(["meta_information", data]));
            visitID = null;
            break;
        default:
            // Just making sure that it's a valid number before logging
            _visitID = parseInt(data, 10);
            logDebug("Setting visit_id the legacy way");
            visitID = _visitID

    }

}
let open = async function(storageControllerAddress, logAddress, curr_crawlID) {
    if (storageControllerAddress == null && logAddress == null && curr_crawlID === 0) {
        console.log("Debugging, everything will output to console");
        debugging = true;
        return;
    }
    crawlID = curr_crawlID;

    console.log("Opening socket connections...");

    // Connect to MPLogger for extension info/debug/error logging
    if (logAddress != null) {
        logAggregator = new _socket_js__WEBPACK_IMPORTED_MODULE_0__.SendingSocket();
        let rv = await logAggregator.connect(logAddress[0], logAddress[1]);
        console.log("logSocket started?", rv)
    }

    // Connect to databases for saving data
    if (storageControllerAddress != null) {
        storageController = new _socket_js__WEBPACK_IMPORTED_MODULE_0__.SendingSocket();
        let rv = await storageController.connect(storageControllerAddress[0], storageControllerAddress[1]);
        console.log("StorageController started?",rv);
    }

    // Listen for incoming urls as visit ids
    listeningSocket = new _socket_js__WEBPACK_IMPORTED_MODULE_0__.ListeningSocket(listeningSocketCallback);
    console.log("Starting socket listening for incoming connections.");
    await listeningSocket.startListening().then(() => {
        browser.profileDirIO.writeFile("extension_port.txt", `${listeningSocket.port}`);
    });
};

let close = function() {
    if (storageController != null) {
        storageController.close();
    }
    if (logAggregator != null) {
        logAggregator.close();
    }
};

let makeLogJSON = function(lvl, msg) {
    var log_json = {
        'name': 'Extension-Logger',
        'level': lvl,
        'pathname': 'FirefoxExtension',
        'lineno': 1,
        'msg': escapeString(msg),
        'args': null,
        'exc_info': null,
        'func': null
    }
    return log_json;
}

let logInfo = function(msg) {
    // Always log to browser console
    console.log(msg);

    if (debugging) {
        return;
    }

    // Log level INFO == 20 (https://docs.python.org/2/library/logging.html#logging-levels)
    var log_json = makeLogJSON(20, msg);
    logAggregator.send(JSON.stringify(['EXT', JSON.stringify(log_json)]));
};

let logDebug = function(msg) {
    // Always log to browser console
    console.log(msg);

    if (debugging) {
        return;
    }

    // Log level DEBUG == 10 (https://docs.python.org/2/library/logging.html#logging-levels)
    var log_json = makeLogJSON(10, msg);
    logAggregator.send(JSON.stringify(['EXT', JSON.stringify(log_json)]));
};

let logWarn = function(msg) {
    // Always log to browser console
    console.warn(msg);

    if (debugging) {
        return;
    }

    // Log level WARN == 30 (https://docs.python.org/2/library/logging.html#logging-levels)
    var log_json = makeLogJSON(30, msg);
    logAggregator.send(JSON.stringify(['EXT', JSON.stringify(log_json)]));
};

let logError = function(msg) {
    // Always log to browser console
    console.error(msg);

    if (debugging) {
        return;
    }

    // Log level INFO == 40 (https://docs.python.org/2/library/logging.html#logging-levels)
    var log_json = makeLogJSON(40, msg);
    logAggregator.send(JSON.stringify(['EXT', JSON.stringify(log_json)]));
};

let logCritical = function(msg) {
    // Always log to browser console
    console.error(msg);

    if (debugging) {
        return;
    }

    // Log level CRITICAL == 50 (https://docs.python.org/2/library/logging.html#logging-levels)
    var log_json = makeLogJSON(50, msg);
    logAggregator.send(JSON.stringify(['EXT', JSON.stringify(log_json)]));
};

let dataReceiver = {
    saveRecord(a, b) {
        console.log(b);
    },
};

let saveRecord = function(instrument, record) {
    record["visit_id"] = visitID;

    if (!visitID && !debugging) {
        // Navigations to about:blank can be triggered by OpenWPM. We drop those.
        if(instrument === 'navigations' && record['url'] === 'about:blank') {
            logDebug('Extension-' + crawlID + ' : Dropping navigation to about:blank in intermediate period');
            return;
        }
        logWarn(`Extension-${crawlID} : visitID is null while attempting to insert into table ${instrument}\n` +
                    JSON.stringify(record));
        record["visit_id"] = -1;
        
    }

    // send to console if debugging
    if (debugging) {
      console.log("EXTENSION", instrument, record);
      return;
    }
    storageController.send(JSON.stringify([instrument, record]));
};

// Stub for now
let saveContent = async function(content, contentHash) {
  // Send page content to the data aggregator
  // deduplicated by contentHash in a levelDB database
  if (debugging) {
    console.log("LDB contentHash:",contentHash,"with length",content.length);
    return;
  }
  // Since the content might not be a valid utf8 string and it needs to be
  // json encoded later, it is encoded using base64 first.
  const b64 = Uint8ToBase64(content);
  storageController.send(JSON.stringify(['page_content', [b64, contentHash]]));
};

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}

// Base64 encoding, found on:
// https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string/25644409#25644409
function Uint8ToBase64(u8Arr){
  var CHUNK_SIZE = 0x8000; //arbitrary number
  var index = 0;
  var length = u8Arr.length;
  var result = '';
  var slice;
  while (index < length) {
    slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, slice);
    index += CHUNK_SIZE;
  }
  return btoa(result);
}

let escapeString = function(string) {
    // Convert to string if necessary
    if(typeof string != "string")
        string = "" + string;

    return encode_utf8(string);
};

let boolToInt = function(bool) {
    return bool ? 1 : 0;
};


/***/ }),

/***/ "./feature.js/socket.js":
/*!******************************!*\
  !*** ./feature.js/socket.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ListeningSocket": () => (/* binding */ ListeningSocket),
/* harmony export */   "SendingSocket": () => (/* binding */ SendingSocket)
/* harmony export */ });
let DataReceiver = {
  callbacks: new Map(),
  onDataReceived: (aSocketId, aData, aJSON) => {
    if (!DataReceiver.callbacks.has(aSocketId)) {
      return;
    }
    if (aJSON) {
      aData = JSON.parse(aData);
    }
    DataReceiver.callbacks.get(aSocketId)(aData);
  },
};

browser.sockets.onDataReceived.addListener(DataReceiver.onDataReceived);

let ListeningSockets = new Map();

class ListeningSocket {
  constructor(callback) {
    this.callback = callback
  }

  async startListening() {
    this.port = await browser.sockets.createServerSocket();
    DataReceiver.callbacks.set(this.port, this.callback);
    browser.sockets.startListening(this.port);
    console.log('Listening on port ' + this.port);
  }
}

class SendingSocket {
  constructor() {
  }

  async connect(host, port) {
    this.id = await browser.sockets.createSendingSocket();
    browser.sockets.connect(this.id, host, port);
    console.log(`Connected to ${host}:${port}`);
  }

  send(aData, aJSON=true) {
    try {
      browser.sockets.sendData(this.id, aData, !!aJSON);
      return true;
    } catch (err) {
      console.error(err,err.message);
      return false;
    }
  }

  close() {
    browser.sockets.close(this.id);
  }
}



/***/ }),

/***/ "../webext-instrumentation/build/module/background/cookie-instrument.js":
/*!******************************************************************************!*\
  !*** ../webext-instrumentation/build/module/background/cookie-instrument.js ***!
  \******************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformCookieObjectToMatchOpenWPMSchema": () => (/* binding */ transformCookieObjectToMatchOpenWPMSchema),
/* harmony export */   "CookieInstrument": () => (/* binding */ CookieInstrument)
/* harmony export */ });
/* harmony import */ var _lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/extension-session-event-ordinal */ "../webext-instrumentation/build/module/lib/extension-session-event-ordinal.js");
/* harmony import */ var _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/extension-session-uuid */ "../webext-instrumentation/build/module/lib/extension-session-uuid.js");
/* harmony import */ var _lib_string_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/string-utils */ "../webext-instrumentation/build/module/lib/string-utils.js");



const transformCookieObjectToMatchOpenWPMSchema = (cookie) => {
    const javascriptCookie = {};
    // Expiry time (in seconds)
    // May return ~Max(int64). I believe this is a session
    // cookie which doesn't expire. Sessions cookies with
    // non-max expiry time expire after session or at expiry.
    const expiryTime = cookie.expirationDate; // returns seconds
    let expiryTimeString;
    const maxInt64 = 9223372036854776000;
    if (!cookie.expirationDate || expiryTime === maxInt64) {
        expiryTimeString = "9999-12-31T21:59:59.000Z";
    }
    else {
        const expiryTimeDate = new Date(expiryTime * 1000); // requires milliseconds
        expiryTimeString = expiryTimeDate.toISOString();
    }
    javascriptCookie.expiry = expiryTimeString;
    javascriptCookie.is_http_only = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.boolToInt)(cookie.httpOnly);
    javascriptCookie.is_host_only = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.boolToInt)(cookie.hostOnly);
    javascriptCookie.is_session = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.boolToInt)(cookie.session);
    javascriptCookie.host = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(cookie.domain);
    javascriptCookie.is_secure = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.boolToInt)(cookie.secure);
    javascriptCookie.name = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(cookie.name);
    javascriptCookie.path = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(cookie.path);
    javascriptCookie.value = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(cookie.value);
    javascriptCookie.same_site = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(cookie.sameSite);
    javascriptCookie.first_party_domain = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(cookie.firstPartyDomain);
    javascriptCookie.store_id = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(cookie.storeId);
    javascriptCookie.time_stamp = new Date().toISOString();
    return javascriptCookie;
};
class CookieInstrument {
    dataReceiver;
    onChangedListener;
    constructor(dataReceiver) {
        this.dataReceiver = dataReceiver;
    }
    run(crawlID) {
        // Instrument cookie changes
        this.onChangedListener = async (changeInfo) => {
            const eventType = changeInfo.removed ? "deleted" : "added-or-changed";
            const update = {
                record_type: eventType,
                change_cause: changeInfo.cause,
                browser_id: crawlID,
                extension_session_uuid: _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__.extensionSessionUuid,
                event_ordinal: (0,_lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__.incrementedEventOrdinal)(),
                ...transformCookieObjectToMatchOpenWPMSchema(changeInfo.cookie),
            };
            this.dataReceiver.saveRecord("javascript_cookies", update);
        };
        browser.cookies.onChanged.addListener(this.onChangedListener);
    }
    async saveAllCookies(crawlID) {
        const allCookies = await browser.cookies.getAll({});
        await Promise.all(allCookies.map((cookie) => {
            const update = {
                record_type: "manual-export",
                browser_id: crawlID,
                extension_session_uuid: _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__.extensionSessionUuid,
                ...transformCookieObjectToMatchOpenWPMSchema(cookie),
            };
            return this.dataReceiver.saveRecord("javascript_cookies", update);
        }));
    }
    cleanup() {
        if (this.onChangedListener) {
            browser.cookies.onChanged.removeListener(this.onChangedListener);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29va2llLWluc3RydW1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2dyb3VuZC9jb29raWUtaW5zdHJ1bWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUMvRSxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRSxPQUFPLEVBQUMsU0FBUyxFQUFFLFlBQVksRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBSzVELE1BQU0sQ0FBQyxNQUFNLHlDQUF5QyxHQUFHLENBQUMsTUFBYyxFQUFFLEVBQUU7SUFDMUUsTUFBTSxnQkFBZ0IsR0FBRyxFQUFzQixDQUFDO0lBRWhELDJCQUEyQjtJQUMzQixzREFBc0Q7SUFDdEQscURBQXFEO0lBQ3JELHlEQUF5RDtJQUN6RCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsa0JBQWtCO0lBQzVELElBQUksZ0JBQWdCLENBQUM7SUFDckIsTUFBTSxRQUFRLEdBQUcsbUJBQW1CLENBQUM7SUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLElBQUksVUFBVSxLQUFLLFFBQVEsRUFBRTtRQUNyRCxnQkFBZ0IsR0FBRywwQkFBMEIsQ0FBQztLQUMvQztTQUFNO1FBQ0wsTUFBTSxjQUFjLEdBQUcsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsd0JBQXdCO1FBQzVFLGdCQUFnQixHQUFHLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztLQUNqRDtJQUNELGdCQUFnQixDQUFDLE1BQU0sR0FBRyxnQkFBZ0IsQ0FBQztJQUMzQyxnQkFBZ0IsQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMzRCxnQkFBZ0IsQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxR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

/***/ }),

/***/ "../webext-instrumentation/build/module/background/dns-instrument.js":
/*!***************************************************************************!*\
  !*** ../webext-instrumentation/build/module/background/dns-instrument.js ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "DnsInstrument": () => (/* binding */ DnsInstrument)
/* harmony export */ });
/* harmony import */ var _lib_pending_response__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/pending-response */ "../webext-instrumentation/build/module/lib/pending-response.js");
/* harmony import */ var _http_instrument__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./http-instrument */ "../webext-instrumentation/build/module/background/http-instrument.js");


class DnsInstrument {
    dataReceiver;
    onCompleteListener;
    pendingResponses = {};
    constructor(dataReceiver) {
        this.dataReceiver = dataReceiver;
    }
    run(crawlID) {
        const filter = { urls: ["<all_urls>"], types: _http_instrument__WEBPACK_IMPORTED_MODULE_1__.allTypes };
        const requestStemsFromExtension = details => {
            return (details.originUrl &&
                details.originUrl.indexOf("moz-extension://") > -1 &&
                details.originUrl.includes("fakeRequest"));
        };
        /*
         * Attach handlers to event listeners
         */
        this.onCompleteListener = (details) => {
            // Ignore requests made by extensions
            if (requestStemsFromExtension(details)) {
                return;
            }
            const pendingResponse = this.getPendingResponse(details.requestId);
            pendingResponse.resolveOnCompletedEventDetails(details);
            this.onCompleteDnsHandler(details, crawlID);
        };
        browser.webRequest.onCompleted.addListener(this.onCompleteListener, filter);
    }
    cleanup() {
        if (this.onCompleteListener) {
            browser.webRequest.onCompleted.removeListener(this.onCompleteListener);
        }
    }
    getPendingResponse(requestId) {
        if (!this.pendingResponses[requestId]) {
            this.pendingResponses[requestId] = new _lib_pending_response__WEBPACK_IMPORTED_MODULE_0__.PendingResponse();
        }
        return this.pendingResponses[requestId];
    }
    handleResolvedDnsData(dnsRecordObj, dataReceiver) {
        // Curring the data returned by API call.
        return function (record) {
            // Get data from API call
            dnsRecordObj.addresses = record.addresses.toString();
            dnsRecordObj.canonical_name = record.canonicalName;
            dnsRecordObj.is_TRR = record.isTRR;
            // Send data to main OpenWPM data aggregator.
            dataReceiver.saveRecord("dns_responses", dnsRecordObj);
        };
    }
    async onCompleteDnsHandler(details, crawlID) {
        // Create and populate DnsResolve object
        const dnsRecord = {};
        dnsRecord.browser_id = crawlID;
        dnsRecord.request_id = Number(details.requestId);
        dnsRecord.used_address = details.ip;
        const currentTime = new Date(details.timeStamp);
        dnsRecord.time_stamp = currentTime.toISOString();
        // Query DNS API
        const url = new URL(details.url);
        dnsRecord.hostname = url.hostname;
        const dnsResolve = browser.dns.resolve(dnsRecord.hostname, ["canonical_name"]);
        dnsResolve.then(this.handleResolvedDnsData(dnsRecord, this.dataReceiver));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG5zLWluc3RydW1lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYmFja2dyb3VuZC9kbnMtaW5zdHJ1bWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFHeEQsT0FBTyxFQUFDLFFBQVEsRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBSTNDLE1BQU0sT0FBTyxhQUFhO0lBQ1AsWUFBWSxDQUFDO0lBQ3RCLGtCQUFrQixDQUFDO0lBQ25CLGdCQUFnQixHQUVwQixFQUFFLENBQUM7SUFFUCxZQUFZLFlBQVk7UUFDdEIsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7SUFDbkMsQ0FBQztJQUVNLEdBQUcsQ0FBQyxPQUFPO1FBRWhCLE1BQU0sTUFBTSxHQUFrQixFQUFFLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQztRQUV4RSxNQUFNLHlCQUF5QixHQUFHLE9BQU8sQ0FBQyxFQUFFO1lBQ3hDLE9BQU8sQ0FDTCxPQUFPLENBQUMsU0FBUztnQkFDZixPQUFPLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbEQsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQzVDLENBQUM7UUFDTixDQUFDLENBQUM7UUFFRjs7V0FFRztRQUNILElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUN4QixPQUEwQyxFQUMxQyxFQUFFO1lBQ0YscUNBQXFDO1lBQ3JDLElBQUkseUJBQXlCLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ3RDLE9BQU87YUFDUjtZQUNELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDbkUsZUFBZSxDQUFDLDhCQUE4QixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRXhELElBQUksQ0FBQyxvQkFBb0IsQ0FDdkIsT0FBTyxFQUNQLE9BQU8sQ0FDUixDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBRUYsT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUN4QyxJQUFJLENBQUMsa0JBQWtCLEVBQ3ZCLE1BQU0sQ0FDUCxDQUFDO0lBQ0osQ0FBQztJQUVNLE9BQU87UUFDWixJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtZQUMzQixPQUFPLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQzNDLElBQUksQ0FBQyxrQkFBa0IsQ0FDeEIsQ0FBQztTQUNIO0lBQ0gsQ0FBQztJQUVPLGtCQUFrQixDQUFDLFNBQVM7UUFDbEMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNyQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztTQUMxRDtRQUNELE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxZQUFZLEVBQUUsWUFBWTtRQUN0RCx5Q0FBeUM7UUFDekMsT0FBTyxVQUFTLE1BQU07WUFDcEIseUJBQXlCO1lBQ3pCLFlBQVksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQTtZQUNwRCxZQUFZLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUE7WUFDbEQsWUFBWSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFBO1lBRWxDLDZDQUE2QztZQUM3QyxZQUFZLENBQUMsVUFBVSxDQUFDLGVBQWUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUE7SUFDSCxDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUNoQyxPQUEwQyxFQUMxQyxPQUFPO1FBRUwsd0NBQXdDO1FBQ3hDLE1BQU0sU0FBUyxHQUFHLEVBQWlCLENBQUM7UUFDcEMsU0FBUyxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUM7UUFDL0IsU0FBUyxDQUFDLFVBQVUsR0FBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xELFNBQVMsQ0FBQyxZQUFZLEdBQUcsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNwQyxNQUFNLFdBQVcsR0FBRyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDaEQsU0FBUyxDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFakQsZ0JBQWdCO1FBQ2hCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQyxTQUFTLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUM7UUFDbEMsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztRQUMvRSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDNUUsQ0FBQztDQUVKIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/background/http-instrument.js":
/*!****************************************************************************!*\
  !*** ../webext-instrumentation/build/module/background/http-instrument.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "allTypes": () => (/* binding */ allTypes),
/* harmony export */   "HttpInstrument": () => (/* binding */ HttpInstrument)
/* harmony export */ });
/* harmony import */ var _lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/extension-session-event-ordinal */ "../webext-instrumentation/build/module/lib/extension-session-event-ordinal.js");
/* harmony import */ var _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/extension-session-uuid */ "../webext-instrumentation/build/module/lib/extension-session-uuid.js");
/* harmony import */ var _lib_http_post_parser__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/http-post-parser */ "../webext-instrumentation/build/module/lib/http-post-parser.js");
/* harmony import */ var _lib_pending_request__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/pending-request */ "../webext-instrumentation/build/module/lib/pending-request.js");
/* harmony import */ var _lib_pending_response__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/pending-response */ "../webext-instrumentation/build/module/lib/pending-response.js");
/* harmony import */ var _lib_string_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../lib/string-utils */ "../webext-instrumentation/build/module/lib/string-utils.js");






/**
 * Note: Different parts of the desired information arrives in different events as per below:
 * request = headers in onBeforeSendHeaders + body in onBeforeRequest
 * response = headers in onCompleted + body via a onBeforeRequest filter
 * redirect = original request headers+body, followed by a onBeforeRedirect and then a new set of request headers+body and response headers+body
 * Docs: https://developer.mozilla.org/en-US/docs/User:wbamberg/webRequest.RequestDetails
 */
const allTypes = [
    "beacon",
    "csp_report",
    "font",
    "image",
    "imageset",
    "main_frame",
    "media",
    "object",
    "object_subrequest",
    "ping",
    "script",
    "speculative",
    "stylesheet",
    "sub_frame",
    "web_manifest",
    "websocket",
    "xml_dtd",
    "xmlhttprequest",
    "xslt",
    "other",
];

class HttpInstrument {
    dataReceiver;
    pendingRequests = {};
    pendingResponses = {};
    onBeforeRequestListener;
    onBeforeSendHeadersListener;
    onBeforeRedirectListener;
    onCompletedListener;
    constructor(dataReceiver) {
        this.dataReceiver = dataReceiver;
    }
    run(crawlID, saveContentOption) {
        const filter = { urls: ["<all_urls>"], types: allTypes };
        const requestStemsFromExtension = details => {
            return (details.originUrl && details.originUrl.indexOf("moz-extension://") > -1);
        };
        /*
         * Attach handlers to event listeners
         */
        this.onBeforeRequestListener = (details) => {
            const blockingResponseThatDoesNothing = {};
            // Ignore requests made by extensions
            if (requestStemsFromExtension(details)) {
                return blockingResponseThatDoesNothing;
            }
            const pendingRequest = this.getPendingRequest(details.requestId);
            pendingRequest.resolveOnBeforeRequestEventDetails(details);
            const pendingResponse = this.getPendingResponse(details.requestId);
            pendingResponse.resolveOnBeforeRequestEventDetails(details);
            if (this.shouldSaveContent(saveContentOption, details.type)) {
                pendingResponse.addResponseResponseBodyListener(details);
            }
            return blockingResponseThatDoesNothing;
        };
        browser.webRequest.onBeforeRequest.addListener(this.onBeforeRequestListener, filter, this.isContentSavingEnabled(saveContentOption)
            ? ["requestBody", "blocking"]
            : ["requestBody"]);
        this.onBeforeSendHeadersListener = details => {
            // Ignore requests made by extensions
            if (requestStemsFromExtension(details)) {
                return;
            }
            const pendingRequest = this.getPendingRequest(details.requestId);
            pendingRequest.resolveOnBeforeSendHeadersEventDetails(details);
            this.onBeforeSendHeadersHandler(details, crawlID, (0,_lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__.incrementedEventOrdinal)());
        };
        browser.webRequest.onBeforeSendHeaders.addListener(this.onBeforeSendHeadersListener, filter, ["requestHeaders"]);
        this.onBeforeRedirectListener = details => {
            // Ignore requests made by extensions
            if (requestStemsFromExtension(details)) {
                return;
            }
            this.onBeforeRedirectHandler(details, crawlID, (0,_lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__.incrementedEventOrdinal)());
        };
        browser.webRequest.onBeforeRedirect.addListener(this.onBeforeRedirectListener, filter, ["responseHeaders"]);
        this.onCompletedListener = details => {
            // Ignore requests made by extensions
            if (requestStemsFromExtension(details)) {
                return;
            }
            const pendingResponse = this.getPendingResponse(details.requestId);
            pendingResponse.resolveOnCompletedEventDetails(details);
            this.onCompletedHandler(details, crawlID, (0,_lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__.incrementedEventOrdinal)(), saveContentOption);
        };
        browser.webRequest.onCompleted.addListener(this.onCompletedListener, filter, ["responseHeaders"]);
    }
    cleanup() {
        if (this.onBeforeRequestListener) {
            browser.webRequest.onBeforeRequest.removeListener(this.onBeforeRequestListener);
        }
        if (this.onBeforeSendHeadersListener) {
            browser.webRequest.onBeforeSendHeaders.removeListener(this.onBeforeSendHeadersListener);
        }
        if (this.onBeforeRedirectListener) {
            browser.webRequest.onBeforeRedirect.removeListener(this.onBeforeRedirectListener);
        }
        if (this.onCompletedListener) {
            browser.webRequest.onCompleted.removeListener(this.onCompletedListener);
        }
    }
    isContentSavingEnabled(saveContentOption) {
        if (saveContentOption === true) {
            return true;
        }
        if (saveContentOption === false) {
            return false;
        }
        return this.saveContentResourceTypes(saveContentOption).length > 0;
    }
    saveContentResourceTypes(saveContentOption) {
        return saveContentOption.split(",");
    }
    /**
     * We rely on the resource type to filter responses
     * See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType
     *
     * @param saveContentOption
     * @param resourceType
     */
    shouldSaveContent(saveContentOption, resourceType) {
        if (saveContentOption === true) {
            return true;
        }
        if (saveContentOption === false) {
            return false;
        }
        return this.saveContentResourceTypes(saveContentOption).includes(resourceType);
    }
    getPendingRequest(requestId) {
        if (!this.pendingRequests[requestId]) {
            this.pendingRequests[requestId] = new _lib_pending_request__WEBPACK_IMPORTED_MODULE_3__.PendingRequest();
        }
        return this.pendingRequests[requestId];
    }
    getPendingResponse(requestId) {
        if (!this.pendingResponses[requestId]) {
            this.pendingResponses[requestId] = new _lib_pending_response__WEBPACK_IMPORTED_MODULE_4__.PendingResponse();
        }
        return this.pendingResponses[requestId];
    }
    /*
     * HTTP Request Handler and Helper Functions
     */
    async onBeforeSendHeadersHandler(details, crawlID, eventOrdinal) {
        const tab = details.tabId > -1
            ? await browser.tabs.get(details.tabId)
            : { windowId: undefined, incognito: undefined, url: undefined };
        const update = {};
        update.incognito = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.boolToInt)(tab.incognito);
        update.browser_id = crawlID;
        update.extension_session_uuid = _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__.extensionSessionUuid;
        update.event_ordinal = eventOrdinal;
        update.window_id = tab.windowId;
        update.tab_id = details.tabId;
        update.frame_id = details.frameId;
        // requestId is a unique identifier that can be used to link requests and responses
        update.request_id = Number(details.requestId);
        const url = details.url;
        update.url = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeUrl)(url);
        const requestMethod = details.method;
        update.method = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(requestMethod);
        const current_time = new Date(details.timeStamp);
        update.time_stamp = current_time.toISOString();
        let encodingType = "";
        let referrer = "";
        const headers = [];
        let isOcsp = false;
        if (details.requestHeaders) {
            details.requestHeaders.map(requestHeader => {
                const { name, value } = requestHeader;
                const header_pair = [];
                header_pair.push((0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(name));
                header_pair.push((0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(value));
                headers.push(header_pair);
                if (name === "Content-Type") {
                    encodingType = value;
                    if (encodingType.indexOf("application/ocsp-request") !== -1) {
                        isOcsp = true;
                    }
                }
                if (name === "Referer") {
                    referrer = value;
                }
            });
        }
        update.referrer = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(referrer);
        if (requestMethod === "POST" && !isOcsp /* don't process OCSP requests */) {
            const pendingRequest = this.getPendingRequest(details.requestId);
            const resolved = await pendingRequest.resolvedWithinTimeout(1000);
            if (!resolved) {
                this.dataReceiver.logError("Pending request timed out waiting for data from both onBeforeRequest and onBeforeSendHeaders events");
            }
            else {
                const onBeforeRequestEventDetails = await pendingRequest.onBeforeRequestEventDetails;
                const requestBody = onBeforeRequestEventDetails.requestBody;
                if (requestBody) {
                    const postParser = new _lib_http_post_parser__WEBPACK_IMPORTED_MODULE_2__.HttpPostParser(onBeforeRequestEventDetails, this.dataReceiver);
                    const postObj = postParser.parsePostRequest();
                    // Add (POST) request headers from upload stream
                    if ("post_headers" in postObj) {
                        // Only store POST headers that we know and need. We may misinterpret POST data as headers
                        // as detection is based on "key:value" format (non-header POST data can be in this format as well)
                        const contentHeaders = [
                            "Content-Type",
                            "Content-Disposition",
                            "Content-Length",
                        ];
                        for (const name in postObj.post_headers) {
                            if (contentHeaders.includes(name)) {
                                const header_pair = [];
                                header_pair.push((0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(name));
                                header_pair.push((0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(postObj.post_headers[name]));
                                headers.push(header_pair);
                            }
                        }
                    }
                    // we store POST body in JSON format, except when it's a string without a (key-value) structure
                    if ("post_body" in postObj) {
                        update.post_body = postObj.post_body;
                    }
                    if ("post_body_raw" in postObj) {
                        update.post_body_raw = postObj.post_body_raw;
                    }
                }
            }
        }
        update.headers = JSON.stringify(headers);
        // Check if xhr
        const isXHR = details.type === "xmlhttprequest";
        update.is_XHR = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.boolToInt)(isXHR);
        // Grab the triggering and loading Principals
        let triggeringOrigin;
        let loadingOrigin;
        if (details.originUrl) {
            const parsedOriginUrl = new URL(details.originUrl);
            triggeringOrigin = parsedOriginUrl.origin;
        }
        if (details.documentUrl) {
            const parsedDocumentUrl = new URL(details.documentUrl);
            loadingOrigin = parsedDocumentUrl.origin;
        }
        update.triggering_origin = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(triggeringOrigin);
        update.loading_origin = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(loadingOrigin);
        // loadingDocument's href
        // The loadingDocument is the document the element resides, regardless of
        // how the load was triggered.
        const loadingHref = details.documentUrl;
        update.loading_href = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(loadingHref);
        // resourceType of the requesting node. This is set by the type of
        // node making the request (i.e. an <img src=...> node will set to type "image").
        // Documentation:
        // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType
        update.resource_type = details.type;
        /*
        // TODO: Refactor to corresponding webext logic or discard
        const ThirdPartyUtil = Cc["@mozilla.org/thirdpartyutil;1"].getService(
                               Ci.mozIThirdPartyUtil);
        // Do third-party checks
        // These specific checks are done because it's what's used in Tracking Protection
        // See: http://searchfox.org/mozilla-central/source/netwerk/base/nsChannelClassifier.cpp#107
        try {
          const isThirdPartyChannel = ThirdPartyUtil.isThirdPartyChannel(details);
          const topWindow = ThirdPartyUtil.getTopWindowForChannel(details);
          const topURI = ThirdPartyUtil.getURIFromWindow(topWindow);
          if (topURI) {
            const topUrl = topURI.spec;
            const channelURI = details.URI;
            const isThirdPartyToTopWindow = ThirdPartyUtil.isThirdPartyURI(
              channelURI,
              topURI,
            );
            update.is_third_party_to_top_window = isThirdPartyToTopWindow;
            update.is_third_party_channel = isThirdPartyChannel;
          }
        } catch (anError) {
          // Exceptions expected for channels triggered or loading in a
          // NullPrincipal or SystemPrincipal. They are also expected for favicon
          // loads, which we attempt to filter. Depending on the naming, some favicons
          // may continue to lead to error logs.
          if (
            update.triggering_origin !== "[System Principal]" &&
            update.triggering_origin !== undefined &&
            update.loading_origin !== "[System Principal]" &&
            update.loading_origin !== undefined &&
            !update.url.endsWith("ico")
          ) {
            this.dataReceiver.logError(
              "Error while retrieving additional channel information for URL: " +
              "\n" +
              update.url +
              "\n Error text:" +
              JSON.stringify(anError),
            );
          }
        }
        */
        update.top_level_url = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeUrl)(this.getDocumentUrlForRequest(details));
        update.parent_frame_id = details.parentFrameId;
        update.frame_ancestors = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(JSON.stringify(details.frameAncestors));
        this.dataReceiver.saveRecord("http_requests", update);
    }
    /**
     * Code taken and adapted from
     * https://github.com/EFForg/privacybadger/pull/2198/files
     *
     * Gets the URL for a given request's top-level document.
     *
     * The request's document may be different from the current top-level document
     * loaded in tab as requests can come out of order:
     *
     * @param {WebRequestOnBeforeSendHeadersEventDetails} details
     *
     * @return {?String} the URL for the request's top-level document
     */
    getDocumentUrlForRequest(details) {
        let url = "";
        if (details.type === "main_frame") {
            // Url of the top-level document itself.
            url = details.url;
        }
        else if (details.hasOwnProperty("frameAncestors")) {
            // In case of nested frames, retrieve url from top-most ancestor.
            // If frameAncestors == [], request comes from the top-level-document.
            url = details.frameAncestors.length
                ? details.frameAncestors[details.frameAncestors.length - 1].url
                : details.documentUrl;
        }
        else {
            // type != 'main_frame' and frameAncestors == undefined
            // For example service workers: https://bugzilla.mozilla.org/show_bug.cgi?id=1470537#c13
            url = details.documentUrl;
        }
        return url;
    }
    async onBeforeRedirectHandler(details, crawlID, eventOrdinal) {
        /*
        console.log(
          "onBeforeRedirectHandler (previously httpRequestHandler)",
          details,
          crawlID,
        );
        */
        // Save HTTP redirect events
        // Events are saved to the `http_redirects` table
        /*
        // TODO: Refactor to corresponding webext logic or discard
        // Events are saved to the `http_redirects` table, and map the old
        // request/response channel id to the new request/response channel id.
        // Implementation based on: https://stackoverflow.com/a/11240627
        const oldNotifications = details.notificationCallbacks;
        let oldEventSink = null;
        details.notificationCallbacks = {
          QueryInterface: XPCOMUtils.generateQI([
            Ci.nsIInterfaceRequestor,
            Ci.nsIChannelEventSink,
          ]),
    
          getInterface(iid) {
            // We are only interested in nsIChannelEventSink,
            // return the old callbacks for any other interface requests.
            if (iid.equals(Ci.nsIChannelEventSink)) {
              try {
                oldEventSink = oldNotifications.QueryInterface(iid);
              } catch (anError) {
                this.dataReceiver.logError(
                  "Error during call to custom notificationCallbacks::getInterface." +
                    JSON.stringify(anError),
                );
              }
              return this;
            }
    
            if (oldNotifications) {
              return oldNotifications.getInterface(iid);
            } else {
              throw Cr.NS_ERROR_NO_INTERFACE;
            }
          },
    
          asyncOnChannelRedirect(oldChannel, newChannel, flags, callback) {
    
            newChannel.QueryInterface(Ci.nsIHttpChannel);
    
            const httpRedirect: HttpRedirect = {
              browser_id: crawlID,
              old_request_id: oldChannel.channelId,
              new_request_id: newChannel.channelId,
              time_stamp: new Date().toISOString(),
            };
            this.dataReceiver.saveRecord("http_redirects", httpRedirect);
    
            if (oldEventSink) {
              oldEventSink.asyncOnChannelRedirect(
                oldChannel,
                newChannel,
                flags,
                callback,
              );
            } else {
              callback.onRedirectVerifyCallback(Cr.NS_OK);
            }
          },
        };
        */
        const responseStatus = details.statusCode;
        const responseStatusText = details.statusLine;
        const tab = details.tabId > -1
            ? await browser.tabs.get(details.tabId)
            : { windowId: undefined, incognito: undefined };
        const httpRedirect = {
            incognito: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.boolToInt)(tab.incognito),
            browser_id: crawlID,
            old_request_url: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeUrl)(details.url),
            old_request_id: details.requestId,
            new_request_url: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeUrl)(details.redirectUrl),
            new_request_id: null,
            extension_session_uuid: _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__.extensionSessionUuid,
            event_ordinal: eventOrdinal,
            window_id: tab.windowId,
            tab_id: details.tabId,
            frame_id: details.frameId,
            response_status: responseStatus,
            response_status_text: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(responseStatusText),
            headers: this.jsonifyHeaders(details.responseHeaders).headers,
            time_stamp: new Date(details.timeStamp).toISOString(),
        };
        this.dataReceiver.saveRecord("http_redirects", httpRedirect);
    }
    /*
     * HTTP Response Handlers and Helper Functions
     */
    async logWithResponseBody(details, update) {
        const pendingResponse = this.getPendingResponse(details.requestId);
        try {
            const responseBodyListener = pendingResponse.responseBodyListener;
            const respBody = await responseBodyListener.getResponseBody();
            const contentHash = await responseBodyListener.getContentHash();
            this.dataReceiver.saveContent(respBody, (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(contentHash));
            update.content_hash = contentHash;
            this.dataReceiver.saveRecord("http_responses", update);
        }
        catch (err) {
            /*
            // TODO: Refactor to corresponding webext logic or discard
            dataReceiver.logError(
              "Unable to retrieve response body." + JSON.stringify(aReason),
            );
            update.content_hash = "<error>";
            dataReceiver.saveRecord("http_responses", update);
            */
            this.dataReceiver.logError("Unable to retrieve response body." +
                "Likely caused by a programming error. Error Message:" +
                err.name +
                err.message +
                "\n" +
                err.stack);
            update.content_hash = "<error>";
            this.dataReceiver.saveRecord("http_responses", update);
        }
    }
    // Instrument HTTP responses
    async onCompletedHandler(details, crawlID, eventOrdinal, saveContent) {
        /*
        console.log(
          "onCompletedHandler (previously httpRequestHandler)",
          details,
          crawlID,
          saveContent,
        );
        */
        const tab = details.tabId > -1
            ? await browser.tabs.get(details.tabId)
            : { windowId: undefined, incognito: undefined };
        const update = {};
        update.incognito = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.boolToInt)(tab.incognito);
        update.browser_id = crawlID;
        update.extension_session_uuid = _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__.extensionSessionUuid;
        update.event_ordinal = eventOrdinal;
        update.window_id = tab.windowId;
        update.tab_id = details.tabId;
        update.frame_id = details.frameId;
        // requestId is a unique identifier that can be used to link requests and responses
        update.request_id = Number(details.requestId);
        const isCached = details.fromCache;
        update.is_cached = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.boolToInt)(isCached);
        const url = details.url;
        update.url = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeUrl)(url);
        const requestMethod = details.method;
        update.method = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(requestMethod);
        // TODO: Refactor to corresponding webext logic or discard
        // (request headers are not available in http response event listener object,
        // but the referrer property of the corresponding request could be queried)
        //
        // let referrer = "";
        // if (details.referrer) {
        //   referrer = details.referrer.spec;
        // }
        // update.referrer = escapeString(referrer);
        const responseStatus = details.statusCode;
        update.response_status = responseStatus;
        const responseStatusText = details.statusLine;
        update.response_status_text = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(responseStatusText);
        const current_time = new Date(details.timeStamp);
        update.time_stamp = current_time.toISOString();
        const parsedHeaders = this.jsonifyHeaders(details.responseHeaders);
        update.headers = parsedHeaders.headers;
        update.location = parsedHeaders.location;
        if (this.shouldSaveContent(saveContent, details.type)) {
            this.logWithResponseBody(details, update);
        }
        else {
            this.dataReceiver.saveRecord("http_responses", update);
        }
    }
    jsonifyHeaders(headers) {
        const resultHeaders = [];
        let location = "";
        if (headers) {
            headers.map(responseHeader => {
                const { name, value } = responseHeader;
                const header_pair = [];
                header_pair.push((0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(name));
                header_pair.push((0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(value));
                resultHeaders.push(header_pair);
                if (name.toLowerCase() === "location") {
                    location = value;
                }
            });
        }
        return {
            headers: JSON.stringify(resultHeaders),
            location: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_5__.escapeString)(location),
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC1pbnN0cnVtZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JhY2tncm91bmQvaHR0cC1pbnN0cnVtZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25FLE9BQU8sRUFBQyxjQUFjLEVBQW9CLE1BQU0seUJBQXlCLENBQUM7QUFDMUUsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3RELE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsU0FBUyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQWV2RTs7Ozs7O0dBTUc7QUFFSCxNQUFNLFFBQVEsR0FBbUI7SUFDM0IsUUFBUTtJQUNSLFlBQVk7SUFDWixNQUFNO0lBQ04sT0FBTztJQUNQLFVBQVU7SUFDVixZQUFZO0lBQ1osT0FBTztJQUNQLFFBQVE7SUFDUixtQkFBbUI7SUFDbkIsTUFBTTtJQUNOLFFBQVE7SUFDUixhQUFhO0lBQ2IsWUFBWTtJQUNaLFdBQVc7SUFDWCxjQUFjO0lBQ2QsV0FBVztJQUNYLFNBQVM7SUFDVCxnQkFBZ0I7SUFDaEIsTUFBTTtJQUNOLE9BQU87Q0FDUixDQUFDO0FBRU4sT0FBTyxFQUFFLFFBQVEsRUFBQyxDQUFDO0FBRW5CLE1BQU0sT0FBTyxjQUFjO0lBQ1IsWUFBWSxDQUFDO0lBQ3RCLGVBQWUsR0FFbkIsRUFBRSxDQUFDO0lBQ0MsZ0JBQWdCLEdBRXBCLEVBQUUsQ0FBQztJQUNDLHVCQUF1QixDQUFDO0lBQ3hCLDJCQUEyQixDQUFDO0lBQzVCLHdCQUF3QixDQUFDO0lBQ3pCLG1CQUFtQixDQUFDO0lBRTVCLFlBQVksWUFBWTtRQUN0QixJQUFJLENBQUMsWUFB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

/***/ }),

/***/ "../webext-instrumentation/build/module/background/javascript-instrument.js":
/*!**********************************************************************************!*\
  !*** ../webext-instrumentation/build/module/background/javascript-instrument.js ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "JavascriptInstrument": () => (/* binding */ JavascriptInstrument)
/* harmony export */ });
/* harmony import */ var _lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/extension-session-event-ordinal */ "../webext-instrumentation/build/module/lib/extension-session-event-ordinal.js");
/* harmony import */ var _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/extension-session-uuid */ "../webext-instrumentation/build/module/lib/extension-session-uuid.js");
/* harmony import */ var _lib_string_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/string-utils */ "../webext-instrumentation/build/module/lib/string-utils.js");



class JavascriptInstrument {
    /**
     * Converts received call and values data from the JS Instrumentation
     * into the format that the schema expects.
     * @param data
     * @param sender
     */
    static processCallsAndValues(data, sender) {
        const update = {};
        update.extension_session_uuid = _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__.extensionSessionUuid;
        update.event_ordinal = (0,_lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__.incrementedEventOrdinal)();
        update.page_scoped_event_ordinal = data.ordinal;
        update.window_id = sender.tab.windowId;
        update.tab_id = sender.tab.id;
        update.frame_id = sender.frameId;
        update.script_url = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeUrl)(data.scriptUrl);
        update.script_line = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.scriptLine);
        update.script_col = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.scriptCol);
        update.func_name = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.funcName);
        update.script_loc_eval = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.scriptLocEval);
        update.call_stack = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.callStack);
        update.symbol = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.symbol);
        update.operation = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.operation);
        update.value = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(data.value);
        update.time_stamp = data.timeStamp;
        update.incognito = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.boolToInt)(sender.tab.incognito);
        // document_url is the current frame's document href
        // top_level_url is the top-level frame's document href
        update.document_url = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeUrl)(sender.url);
        update.top_level_url = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeUrl)(sender.tab.url);
        if (data.operation === "call" && data.args.length > 0) {
            update.arguments = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_2__.escapeString)(JSON.stringify(data.args));
        }
        return update;
    }
    dataReceiver;
    onMessageListener;
    configured = false;
    pendingRecords = [];
    crawlID;
    constructor(dataReceiver) {
        this.dataReceiver = dataReceiver;
    }
    /**
     * Start listening for messages from page/content/background scripts injected to instrument JavaScript APIs
     */
    listen() {
        this.onMessageListener = (message, sender) => {
            if (message.namespace &&
                message.namespace === "javascript-instrumentation") {
                this.handleJsInstrumentationMessage(message, sender);
            }
        };
        browser.runtime.onMessage.addListener(this.onMessageListener);
    }
    /**
     * Either sends the log data to the dataReceiver or store it in memory
     * as a pending record if the JS instrumentation is not yet configured
     * @param message
     * @param sender
     */
    handleJsInstrumentationMessage(message, sender) {
        switch (message.type) {
            case "logCall":
            case "logValue":
                const update = JavascriptInstrument.processCallsAndValues(message.data, sender);
                if (this.configured) {
                    update.browser_id = this.crawlID;
                    this.dataReceiver.saveRecord("javascript", update);
                }
                else {
                    this.pendingRecords.push(update);
                }
                break;
        }
    }
    /**
     * Starts listening if haven't done so already, sets the crawl ID,
     * marks the JS instrumentation as configured and sends any pending
     * records that have been received up until this point.
     * @param crawlID
     */
    run(crawlID) {
        if (!this.onMessageListener) {
            this.listen();
        }
        this.crawlID = crawlID;
        this.configured = true;
        this.pendingRecords.map(update => {
            update.browser_id = this.crawlID;
            this.dataReceiver.saveRecord("javascript", update);
        });
    }
    async registerContentScript(testing, jsInstrumentationSettings) {
        const contentScriptConfig = {
            testing,
            jsInstrumentationSettings,
        };
        if (contentScriptConfig) {
            // TODO: Avoid using window to pass the content script config
            await browser.contentScripts.register({
                js: [
                    {
                        code: `window.openWpmContentScriptConfig = ${JSON.stringify(contentScriptConfig)};`,
                    },
                ],
                matches: ["<all_urls>"],
                allFrames: true,
                runAt: "document_start",
                matchAboutBlank: true,
            });
        }
        return browser.contentScripts.register({
            js: [{ file: "/content.js" }],
            matches: ["<all_urls>"],
            allFrames: true,
            runAt: "document_start",
            matchAboutBlank: true,
        });
    }
    cleanup() {
        this.pendingRecords = [];
        if (this.onMessageListener) {
            browser.runtime.onMessage.removeListener(this.onMessageListener);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1pbnN0cnVtZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JhY2tncm91bmQvamF2YXNjcmlwdC1pbnN0cnVtZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25FLE9BQU8sRUFBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBR3ZFLE1BQU0sT0FBTyxvQkFBb0I7SUFDL0I7Ozs7O09BS0c7SUFDSyxNQUFNLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFLE1BQXFCO1FBQzlELE1BQU0sTUFBTSxHQUFHLEVBQXlCLENBQUM7UUFDekMsTUFBTSxDQUFDLHNCQUFzQixHQUFHLG9CQUFvQixDQUFDO1FBQ3JELE1BQU0sQ0FBQyxhQUFhLEdBQUcsdUJBQXVCLEVBQUUsQ0FBQztRQUNqRCxNQUFNLENBQUMseUJBQXlCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNoRCxNQUFNLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO1FBQ3ZDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDOUIsTUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDO1FBQ2pDLE1BQU0sQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM5QyxNQUFNLENBQUMsV0FBVyxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbkQsTUFBTSxDQUFDLFVBQVUsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FB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

/***/ }),

/***/ "../webext-instrumentation/build/module/background/navigation-instrument.js":
/*!**********************************************************************************!*\
  !*** ../webext-instrumentation/build/module/background/navigation-instrument.js ***!
  \**********************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "transformWebNavigationBaseEventDetailsToOpenWPMSchema": () => (/* binding */ transformWebNavigationBaseEventDetailsToOpenWPMSchema),
/* harmony export */   "NavigationInstrument": () => (/* binding */ NavigationInstrument)
/* harmony export */ });
/* harmony import */ var _lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/extension-session-event-ordinal */ "../webext-instrumentation/build/module/lib/extension-session-event-ordinal.js");
/* harmony import */ var _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../lib/extension-session-uuid */ "../webext-instrumentation/build/module/lib/extension-session-uuid.js");
/* harmony import */ var _lib_pending_navigation__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../lib/pending-navigation */ "../webext-instrumentation/build/module/lib/pending-navigation.js");
/* harmony import */ var _lib_string_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../lib/string-utils */ "../webext-instrumentation/build/module/lib/string-utils.js");
/* harmony import */ var _lib_uuid__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../lib/uuid */ "../webext-instrumentation/build/module/lib/uuid.js");





const transformWebNavigationBaseEventDetailsToOpenWPMSchema = async (crawlID, details) => {
    const tab = details.tabId > -1
        ? await browser.tabs.get(details.tabId)
        : {
            windowId: undefined,
            incognito: undefined,
            cookieStoreId: undefined,
            openerTabId: undefined,
            width: undefined,
            height: undefined,
        };
    const window = tab.windowId
        ? await browser.windows.get(tab.windowId)
        : { width: undefined, height: undefined, type: undefined };
    const navigation = {
        browser_id: crawlID,
        incognito: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_3__.boolToInt)(tab.incognito),
        extension_session_uuid: _lib_extension_session_uuid__WEBPACK_IMPORTED_MODULE_1__.extensionSessionUuid,
        process_id: details.processId,
        window_id: tab.windowId,
        tab_id: details.tabId,
        tab_opener_tab_id: tab.openerTabId,
        frame_id: details.frameId,
        window_width: window.width,
        window_height: window.height,
        window_type: window.type,
        tab_width: tab.width,
        tab_height: tab.height,
        tab_cookie_store_id: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_3__.escapeString)(tab.cookieStoreId),
        uuid: (0,_lib_uuid__WEBPACK_IMPORTED_MODULE_4__.makeUUID)(),
        url: (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_3__.escapeUrl)(details.url),
    };
    return navigation;
};
class NavigationInstrument {
    static navigationId(processId, tabId, frameId) {
        return `${processId}-${tabId}-${frameId}`;
    }
    dataReceiver;
    onBeforeNavigateListener;
    onCommittedListener;
    pendingNavigations = {};
    constructor(dataReceiver) {
        this.dataReceiver = dataReceiver;
    }
    run(crawlID) {
        this.onBeforeNavigateListener = async (details) => {
            const navigationId = NavigationInstrument.navigationId(details.processId, details.tabId, details.frameId);
            const pendingNavigation = this.instantiatePendingNavigation(navigationId);
            const navigation = await transformWebNavigationBaseEventDetailsToOpenWPMSchema(crawlID, details);
            navigation.parent_frame_id = details.parentFrameId;
            navigation.before_navigate_event_ordinal = (0,_lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__.incrementedEventOrdinal)();
            navigation.before_navigate_time_stamp = new Date(details.timeStamp).toISOString();
            pendingNavigation.resolveOnBeforeNavigateEventNavigation(navigation);
        };
        browser.webNavigation.onBeforeNavigate.addListener(this.onBeforeNavigateListener);
        this.onCommittedListener = async (details) => {
            const navigationId = NavigationInstrument.navigationId(details.processId, details.tabId, details.frameId);
            const navigation = await transformWebNavigationBaseEventDetailsToOpenWPMSchema(crawlID, details);
            navigation.transition_qualifiers = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_3__.escapeString)(JSON.stringify(details.transitionQualifiers));
            navigation.transition_type = (0,_lib_string_utils__WEBPACK_IMPORTED_MODULE_3__.escapeString)(details.transitionType);
            navigation.committed_event_ordinal = (0,_lib_extension_session_event_ordinal__WEBPACK_IMPORTED_MODULE_0__.incrementedEventOrdinal)();
            navigation.committed_time_stamp = new Date(details.timeStamp).toISOString();
            // include attributes from the corresponding onBeforeNavigation event
            const pendingNavigation = this.getPendingNavigation(navigationId);
            if (pendingNavigation) {
                pendingNavigation.resolveOnCommittedEventNavigation(navigation);
                const resolved = await pendingNavigation.resolvedWithinTimeout(1000);
                if (resolved) {
                    const onBeforeNavigateEventNavigation = await pendingNavigation.onBeforeNavigateEventNavigation;
                    navigation.parent_frame_id =
                        onBeforeNavigateEventNavigation.parent_frame_id;
                    navigation.before_navigate_event_ordinal =
                        onBeforeNavigateEventNavigation.before_navigate_event_ordinal;
                    navigation.before_navigate_time_stamp =
                        onBeforeNavigateEventNavigation.before_navigate_time_stamp;
                }
            }
            this.dataReceiver.saveRecord("navigations", navigation);
        };
        browser.webNavigation.onCommitted.addListener(this.onCommittedListener);
    }
    cleanup() {
        if (this.onBeforeNavigateListener) {
            browser.webNavigation.onBeforeNavigate.removeListener(this.onBeforeNavigateListener);
        }
        if (this.onCommittedListener) {
            browser.webNavigation.onCommitted.removeListener(this.onCommittedListener);
        }
    }
    instantiatePendingNavigation(navigationId) {
        this.pendingNavigations[navigationId] = new _lib_pending_navigation__WEBPACK_IMPORTED_MODULE_2__.PendingNavigation();
        return this.pendingNavigations[navigationId];
    }
    getPendingNavigation(navigationId) {
        return this.pendingNavigations[navigationId];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF2aWdhdGlvbi1pbnN0cnVtZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JhY2tncm91bmQvbmF2aWdhdGlvbi1pbnN0cnVtZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQy9FLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ25FLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBQzVELE9BQU8sRUFBQyxTQUFTLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3ZFLE9BQU8sRUFBQyxRQUFRLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFRckMsTUFBTSxDQUFDLE1BQU0scURBQXFELEdBQUcsS0FBSyxFQUN4RSxPQUFPLEVBQ1AsT0FBc0MsRUFDakIsRUFBRTtJQUN2QixNQUFNLEdBQUcsR0FDUCxPQUFPLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNoQixDQUFDLENBQUMsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQ3ZDLENBQUMsQ0FBQztZQUNFLFFBQVEsRUFBRSxTQUFTO1lBQ25CLFNBQVMsRUFBRSxTQUFTO1lBQ3BCLGFBQWEsRUFBRSxTQUFTO1lBQ3hCLFdBQVcsRUFBRSxTQUFTO1lBQ3RCLEtBQUssRUFBRSxTQUFTO1lBQ2hCLE1BQU0sRUFBRSxTQUFTO1NBQ2xCLENBQUM7SUFDUixNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsUUFBUTtRQUN6QixDQUFDLENBQUMsTUFBTSxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO1FBQ3pDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxJ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

/***/ }),

/***/ "../webext-instrumentation/build/module/content/javascript-instrument-content-scope.js":
/*!*********************************************************************************************!*\
  !*** ../webext-instrumentation/build/module/content/javascript-instrument-content-scope.js ***!
  \*********************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "injectJavascriptInstrumentPageScript": () => (/* binding */ injectJavascriptInstrumentPageScript)
/* harmony export */ });
/* harmony import */ var _lib_js_instruments__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lib/js-instruments */ "../webext-instrumentation/build/module/lib/js-instruments.js");
/* harmony import */ var _javascript_instrument_page_scope__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./javascript-instrument-page-scope */ "../webext-instrumentation/build/module/content/javascript-instrument-page-scope.js");


function getPageScriptAsString(jsInstrumentationSettings) {
    // The JS Instrument Requests are setup and validated python side
    // including setting defaults for logSettings. See JSInstrumentation.py
    const pageScriptString = `
// Start of js-instruments.
${_lib_js_instruments__WEBPACK_IMPORTED_MODULE_0__.getInstrumentJS}
// End of js-instruments.

// Start of custom instrumentRequests.
const jsInstrumentationSettings = ${JSON.stringify(jsInstrumentationSettings)};
// End of custom instrumentRequests.

// Start of anonymous function from javascript-instrument-page-scope.ts
(${_javascript_instrument_page_scope__WEBPACK_IMPORTED_MODULE_1__.pageScript}(getInstrumentJS, jsInstrumentationSettings));
// End.
  `;
    return pageScriptString;
}
function insertScript(pageScriptString, eventId, testing = false) {
    const parent = document.documentElement, script = document.createElement("script");
    script.text = pageScriptString;
    script.async = false;
    script.setAttribute("data-event-id", eventId);
    script.setAttribute("data-testing", `${testing}`);
    parent.insertBefore(script, parent.firstChild);
    parent.removeChild(script);
}
function emitMsg(type, msg) {
    msg.timeStamp = new Date().toISOString();
    browser.runtime.sendMessage({
        namespace: "javascript-instrumentation",
        type,
        data: msg,
    });
}
const eventId = Math.random().toString();
// listen for messages from the script we are about to insert
document.addEventListener(eventId, function (e) {
    // pass these on to the background page
    const msgs = e.detail;
    if (Array.isArray(msgs)) {
        msgs.forEach(function (msg) {
            emitMsg(msg.type, msg.content);
        });
    }
    else {
        emitMsg(msgs.type, msgs.content);
    }
});
function injectJavascriptInstrumentPageScript(contentScriptConfig) {
    insertScript(getPageScriptAsString(contentScriptConfig.jsInstrumentationSettings), eventId, contentScriptConfig.testing);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1pbnN0cnVtZW50LWNvbnRlbnQtc2NvcGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29udGVudC9qYXZhc2NyaXB0LWluc3RydW1lbnQtY29udGVudC1zY29wZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDdEQsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLG9DQUFvQyxDQUFDO0FBRTlELFNBQVMscUJBQXFCLENBQzVCLHlCQUFpQztJQUVqQyxpRUFBaUU7SUFDakUsdUVBQXVFO0lBQ3ZFLE1BQU0sZ0JBQWdCLEdBQUc7O0VBRXpCLGVBQWU7Ozs7b0NBSW1CLElBQUksQ0FBQyxTQUFTLENBQUMseUJBQXlCLENBQUM7Ozs7R0FJMUUsVUFBVTs7R0FFVixDQUFDO0lBQ0YsT0FBTyxnQkFBZ0IsQ0FBQztBQUMxQixDQUFDO0FBRUQsU0FBUyxZQUFZLENBQ25CLGdCQUF3QixFQUN4QixPQUFlLEVBQ2YsVUFBbUIsS0FBSztJQUV4QixNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsZUFBZSxFQUNyQyxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM1QyxNQUFNLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDO0lBQy9CLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0lBQ3JCLE1BQU0sQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzlDLE1BQU0sQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUNsRCxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDL0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM3QixDQUFDO0FBRUQsU0FBUyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUc7SUFDeEIsR0FBRyxDQUFDLFNBQVMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3pDLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1FBQzFCLFNBQVMsRUFBRSw0QkFBNEI7UUFDdkMsSUFBSTtRQUNKLElBQUksRUFBRSxHQUFHO0tBQ1YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUV6Qyw2REFBNkQ7QUFDN0QsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxVQUFTLENBQWM7SUFDeEQsdUNBQXVDO0lBQ3ZDLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDdEIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3ZCLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBUyxHQUFHO1lBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqQyxDQUFDLENBQUMsQ0FBQztLQUNKO1NBQU07UUFDTCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7S0FDbEM7QUFDSCxDQUFDLENBQUMsQ0FBQztBQUVILE1BQU0sVUFBVSxvQ0FBb0MsQ0FBQyxtQkFBbUI7SUFDdEUsWUFBWSxDQUNWLHFCQUFxQixDQUFDLG1CQUFtQixDQUFDLHlCQUF5QixDQUFDLEVBQ3BFLE9BQU8sRUFDUCxtQkFBbUIsQ0FBQyxPQUFPLENBQzVCLENBQUM7QUFDSixDQUFDIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/content/javascript-instrument-page-scope.js":
/*!******************************************************************************************!*\
  !*** ../webext-instrumentation/build/module/content/javascript-instrument-page-scope.js ***!
  \******************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "pageScript": () => (/* binding */ pageScript)
/* harmony export */ });
// Code below is not a content script: no Firefox APIs should be used
// Also, no webpack/es6 imports may be used in this file since the script
// is exported as a page script as a string
const pageScript = function (getInstrumentJS, jsInstrumentationSettings) {
    // messages the injected script
    function sendMessagesToLogger(eventId, messages) {
        document.dispatchEvent(new CustomEvent(eventId, {
            detail: messages,
        }));
    }
    const eventId = document.currentScript.getAttribute("data-event-id");
    const testing = document.currentScript.getAttribute("data-testing");
    const instrumentJS = getInstrumentJS(eventId, sendMessagesToLogger);
    let t0;
    if (testing === "true") {
        console.log("OpenWPM: Currently testing");
        t0 = performance.now();
        console.log("Begin loading JS instrumentation.");
    }
    instrumentJS(jsInstrumentationSettings);
    if (testing === "true") {
        const t1 = performance.now();
        console.log(`Call to instrumentJS took ${t1 - t0} milliseconds.`);
        window.instrumentJS = instrumentJS;
        console.log("OpenWPM: Content-side javascript instrumentation started with spec:", jsInstrumentationSettings, new Date().toISOString(), "(if spec is '<unavailable>' check web console.)");
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamF2YXNjcmlwdC1pbnN0cnVtZW50LXBhZ2Utc2NvcGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29udGVudC9qYXZhc2NyaXB0LWluc3RydW1lbnQtcGFnZS1zY29wZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxxRUFBcUU7QUFDckUseUVBQXlFO0FBQ3pFLDJDQUEyQztBQUUzQyxNQUFNLENBQUMsTUFBTSxVQUFVLEdBQUcsVUFBUyxlQUFlLEVBQUUseUJBQXlCO0lBQzNFLCtCQUErQjtJQUMvQixTQUFTLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxRQUFRO1FBQzdDLFFBQVEsQ0FBQyxhQUFhLENBQ3BCLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRTtZQUN2QixNQUFNLEVBQUUsUUFBUTtTQUNqQixDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNyRSxNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNwRSxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsT0FBTyxFQUFFLG9CQUFvQixDQUFDLENBQUM7SUFDcEUsSUFBSSxFQUFVLENBQUM7SUFDZixJQUFJLE9BQU8sS0FBSyxNQUFNLEVBQUU7UUFDdEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQzFDLEVBQUUsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO0tBQ2xEO0lBQ0QsWUFBWSxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDeEMsSUFBSSxPQUFPLEtBQUssTUFBTSxFQUFFO1FBQ3RCLE1BQU0sRUFBRSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2pFLE1BQWMsQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQzVDLE9BQU8sQ0FBQyxHQUFHLENBQ1QscUVBQXFFLEVBQ3JFLHlCQUF5QixFQUN6QixJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxFQUN4QixpREFBaUQsQ0FDbEQsQ0FBQztLQUNIO0FBQ0gsQ0FBQyxDQUFDIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/index.js":
/*!*******************************************************!*\
  !*** ../webext-instrumentation/build/module/index.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CookieInstrument": () => (/* reexport safe */ _background_cookie_instrument__WEBPACK_IMPORTED_MODULE_0__.CookieInstrument),
/* harmony export */   "transformCookieObjectToMatchOpenWPMSchema": () => (/* reexport safe */ _background_cookie_instrument__WEBPACK_IMPORTED_MODULE_0__.transformCookieObjectToMatchOpenWPMSchema),
/* harmony export */   "DnsInstrument": () => (/* reexport safe */ _background_dns_instrument__WEBPACK_IMPORTED_MODULE_1__.DnsInstrument),
/* harmony export */   "HttpInstrument": () => (/* reexport safe */ _background_http_instrument__WEBPACK_IMPORTED_MODULE_2__.HttpInstrument),
/* harmony export */   "allTypes": () => (/* reexport safe */ _background_http_instrument__WEBPACK_IMPORTED_MODULE_2__.allTypes),
/* harmony export */   "JavascriptInstrument": () => (/* reexport safe */ _background_javascript_instrument__WEBPACK_IMPORTED_MODULE_3__.JavascriptInstrument),
/* harmony export */   "NavigationInstrument": () => (/* reexport safe */ _background_navigation_instrument__WEBPACK_IMPORTED_MODULE_4__.NavigationInstrument),
/* harmony export */   "transformWebNavigationBaseEventDetailsToOpenWPMSchema": () => (/* reexport safe */ _background_navigation_instrument__WEBPACK_IMPORTED_MODULE_4__.transformWebNavigationBaseEventDetailsToOpenWPMSchema),
/* harmony export */   "injectJavascriptInstrumentPageScript": () => (/* reexport safe */ _content_javascript_instrument_content_scope__WEBPACK_IMPORTED_MODULE_5__.injectJavascriptInstrumentPageScript),
/* harmony export */   "HttpPostParser": () => (/* reexport safe */ _lib_http_post_parser__WEBPACK_IMPORTED_MODULE_6__.HttpPostParser),
/* harmony export */   "Uint8ToBase64": () => (/* reexport safe */ _lib_string_utils__WEBPACK_IMPORTED_MODULE_7__.Uint8ToBase64),
/* harmony export */   "boolToInt": () => (/* reexport safe */ _lib_string_utils__WEBPACK_IMPORTED_MODULE_7__.boolToInt),
/* harmony export */   "encode_utf8": () => (/* reexport safe */ _lib_string_utils__WEBPACK_IMPORTED_MODULE_7__.encode_utf8),
/* harmony export */   "escapeString": () => (/* reexport safe */ _lib_string_utils__WEBPACK_IMPORTED_MODULE_7__.escapeString),
/* harmony export */   "escapeUrl": () => (/* reexport safe */ _lib_string_utils__WEBPACK_IMPORTED_MODULE_7__.escapeUrl),
/* harmony export */   "dateTimeUnicodeFormatString": () => (/* reexport safe */ _schema__WEBPACK_IMPORTED_MODULE_8__.dateTimeUnicodeFormatString)
/* harmony export */ });
/* harmony import */ var _background_cookie_instrument__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./background/cookie-instrument */ "../webext-instrumentation/build/module/background/cookie-instrument.js");
/* harmony import */ var _background_dns_instrument__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./background/dns-instrument */ "../webext-instrumentation/build/module/background/dns-instrument.js");
/* harmony import */ var _background_http_instrument__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./background/http-instrument */ "../webext-instrumentation/build/module/background/http-instrument.js");
/* harmony import */ var _background_javascript_instrument__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./background/javascript-instrument */ "../webext-instrumentation/build/module/background/javascript-instrument.js");
/* harmony import */ var _background_navigation_instrument__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./background/navigation-instrument */ "../webext-instrumentation/build/module/background/navigation-instrument.js");
/* harmony import */ var _content_javascript_instrument_content_scope__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./content/javascript-instrument-content-scope */ "../webext-instrumentation/build/module/content/javascript-instrument-content-scope.js");
/* harmony import */ var _lib_http_post_parser__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./lib/http-post-parser */ "../webext-instrumentation/build/module/lib/http-post-parser.js");
/* harmony import */ var _lib_string_utils__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./lib/string-utils */ "../webext-instrumentation/build/module/lib/string-utils.js");
/* harmony import */ var _schema__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./schema */ "../webext-instrumentation/build/module/schema.js");









//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxnQ0FBZ0MsQ0FBQztBQUMvQyxjQUFjLDZCQUE2QixDQUFDO0FBQzVDLGNBQWMsOEJBQThCLENBQUM7QUFDN0MsY0FBYyxvQ0FBb0MsQ0FBQztBQUNuRCxjQUFjLG9DQUFvQyxDQUFDO0FBQ25ELGNBQWMsK0NBQStDLENBQUM7QUFDOUQsY0FBYyx3QkFBd0IsQ0FBQztBQUN2QyxjQUFjLG9CQUFvQixDQUFDO0FBQ25DLGNBQWMsVUFBVSxDQUFDIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/extension-session-event-ordinal.js":
/*!*************************************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/extension-session-event-ordinal.js ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "incrementedEventOrdinal": () => (/* binding */ incrementedEventOrdinal)
/* harmony export */ });
/**
 * This enables us to keep information about the original order
 * in which events arrived to our event listeners.
 */
let eventOrdinal = 0;
const incrementedEventOrdinal = () => {
    return eventOrdinal++;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uLXNlc3Npb24tZXZlbnQtb3JkaW5hbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvZXh0ZW5zaW9uLXNlc3Npb24tZXZlbnQtb3JkaW5hbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0dBR0c7QUFDSCxJQUFJLFlBQVksR0FBRyxDQUFDLENBQUM7QUFFckIsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxFQUFFO0lBQzFDLE9BQU8sWUFBWSxFQUFFLENBQUM7QUFDeEIsQ0FBQyxDQUFDIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/extension-session-uuid.js":
/*!****************************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/extension-session-uuid.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "extensionSessionUuid": () => (/* binding */ extensionSessionUuid)
/* harmony export */ });
/* harmony import */ var _uuid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./uuid */ "../webext-instrumentation/build/module/lib/uuid.js");

/**
 * This enables us to access a unique reference to this browser
 * session - regenerated any time the background process gets
 * restarted (which should only be on browser restarts)
 */
const extensionSessionUuid = (0,_uuid__WEBPACK_IMPORTED_MODULE_0__.makeUUID)();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uLXNlc3Npb24tdXVpZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvZXh0ZW5zaW9uLXNlc3Npb24tdXVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBRWhDOzs7O0dBSUc7QUFDSCxNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLEVBQUUsQ0FBQyJ9

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/http-post-parser.js":
/*!**********************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/http-post-parser.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "HttpPostParser": () => (/* binding */ HttpPostParser)
/* harmony export */ });
/* harmony import */ var _string_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./string-utils */ "../webext-instrumentation/build/module/lib/string-utils.js");

class HttpPostParser {
    onBeforeRequestEventDetails;
    dataReceiver;
    constructor(onBeforeRequestEventDetails, dataReceiver) {
        this.onBeforeRequestEventDetails = onBeforeRequestEventDetails;
        this.dataReceiver = dataReceiver;
    }
    parsePostRequest() {
        const requestBody = this.onBeforeRequestEventDetails.requestBody;
        if (requestBody.error) {
            this.dataReceiver.logError("Exception: Upstream failed to parse POST: " + requestBody.error);
        }
        if (requestBody.formData) {
            return {
                post_body: (0,_string_utils__WEBPACK_IMPORTED_MODULE_0__.escapeString)(JSON.stringify(requestBody.formData)),
            };
        }
        if (requestBody.raw) {
            return {
                post_body_raw: JSON.stringify(requestBody.raw.map(x => [
                    x.file,
                    (0,_string_utils__WEBPACK_IMPORTED_MODULE_0__.Uint8ToBase64)(new Uint8Array(x.bytes)),
                ])),
            };
        }
        return {};
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC1wb3N0LXBhcnNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvaHR0cC1wb3N0LXBhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUMsWUFBWSxFQUFFLGFBQWEsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBUTNELE1BQU0sT0FBTyxjQUFjO0lBQ1IsMkJBQTJCLENBQXdDO0lBQ25FLFlBQVksQ0FBQztJQUU5QixZQUNFLDJCQUFrRSxFQUNsRSxZQUFZO1FBRVosSUFBSSxDQUFDLDJCQUEyQixHQUFHLDJCQUEyQixDQUFDO1FBQy9ELElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO0lBQ25DLENBQUM7SUFFTSxnQkFBZ0I7UUFDckIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLFdBQVcsQ0FBQztRQUNqRSxJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUU7WUFDckIsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQ3hCLDRDQUE0QyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQ2pFLENBQUM7U0FDSDtRQUNELElBQUksV0FBVyxDQUFDLFFBQVEsRUFBRTtZQUN4QixPQUFPO2dCQUNMLFNBQVMsRUFBRSxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDOUQsQ0FBQztTQUNIO1FBQ0QsSUFBSSxXQUFXLENBQUMsR0FBRyxFQUFFO1lBQ25CLE9BQU87Z0JBQ0wsYUFBYSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQzNCLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ3ZCLENBQUMsQ0FBQyxJQUFJO29CQUNOLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3ZDLENBQUMsQ0FDSDthQUNGLENBQUM7U0FDSDtRQUNELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztDQUNGIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/js-instruments.js":
/*!********************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/js-instruments.js ***!
  \********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "getInstrumentJS": () => (/* binding */ getInstrumentJS)
/* harmony export */ });
// Intrumentation injection code is based on privacybadgerfirefox
// https://github.com/EFForg/privacybadgerfirefox/blob/master/data/fingerprinting.js
function getInstrumentJS(eventId, sendMessagesToLogger) {
    /*
     * Instrumentation helpers
     * (Inlined in order for jsInstruments to be easily exportable as a string)
     */
    // Counter to cap # of calls logged for each script/api combination
    const maxLogCount = 500;
    // logCounter
    const logCounter = new Object();
    // Prevent logging of gets arising from logging
    let inLog = false;
    // To keep track of the original order of events
    let ordinal = 0;
    // Options for JSOperation
    const JSOperation = {
        call: "call",
        get: "get",
        get_failed: "get(failed)",
        get_function: "get(function)",
        set: "set",
        set_failed: "set(failed)",
        set_prevented: "set(prevented)",
    };
    // Rough implementations of Object.getPropertyDescriptor and Object.getPropertyNames
    // See http://wiki.ecmascript.org/doku.php?id=harmony:extended_object_api
    Object.getPropertyDescriptor = function (subject, name) {
        if (subject === undefined) {
            throw new Error("Can't get property descriptor for undefined");
        }
        let pd = Object.getOwnPropertyDescriptor(subject, name);
        let proto = Object.getPrototypeOf(subject);
        while (pd === undefined && proto !== null) {
            pd = Object.getOwnPropertyDescriptor(proto, name);
            proto = Object.getPrototypeOf(proto);
        }
        return pd;
    };
    Object.getPropertyNames = function (subject) {
        if (subject === undefined) {
            throw new Error("Can't get property names for undefined");
        }
        let props = Object.getOwnPropertyNames(subject);
        let proto = Object.getPrototypeOf(subject);
        while (proto !== null) {
            props = props.concat(Object.getOwnPropertyNames(proto));
            proto = Object.getPrototypeOf(proto);
        }
        // FIXME: remove duplicate property names from props
        return props;
    };
    // debounce - from Underscore v1.6.0
    function debounce(func, wait, immediate = false) {
        let timeout, args, context, timestamp, result;
        const later = function () {
            const last = Date.now() - timestamp;
            if (last < wait) {
                timeout = setTimeout(later, wait - last);
            }
            else {
                timeout = null;
                if (!immediate) {
                    result = func.apply(context, args);
                    context = args = null;
                }
            }
        };
        return function () {
            context = this;
            args = arguments;
            timestamp = Date.now();
            const callNow = immediate && !timeout;
            if (!timeout) {
                timeout = setTimeout(later, wait);
            }
            if (callNow) {
                result = func.apply(context, args);
                context = args = null;
            }
            return result;
        };
    }
    // Recursively generates a path for an element
    function getPathToDomElement(element, visibilityAttr = false) {
        if (element === document.body) {
            return element.tagName;
        }
        if (element.parentNode === null) {
            return "NULL/" + element.tagName;
        }
        let siblingIndex = 1;
        const siblings = element.parentNode.childNodes;
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling === element) {
                let path = getPathToDomElement(element.parentNode, visibilityAttr);
                path += "/" + element.tagName + "[" + siblingIndex;
                path += "," + element.id;
                path += "," + element.className;
                if (visibilityAttr) {
                    path += "," + element.hidden;
                    path += "," + element.style.display;
                    path += "," + element.style.visibility;
                }
                if (element.tagName === "A") {
                    path += "," + element.href;
                }
                path += "]";
                return path;
            }
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                siblingIndex++;
            }
        }
    }
    // Helper for JSONifying objects
    function serializeObject(object, stringifyFunctions = false) {
        // Handle permissions errors
        try {
            if (object === null) {
                return "null";
            }
            if (typeof object === "function") {
                if (stringifyFunctions) {
                    return object.toString();
                }
                else {
                    return "FUNCTION";
                }
            }
            if (typeof object !== "object") {
                return object;
            }
            const seenObjects = [];
            return JSON.stringify(object, function (key, value) {
                if (value === null) {
                    return "null";
                }
                if (typeof value === "function") {
                    if (stringifyFunctions) {
                        return value.toString();
                    }
                    else {
                        return "FUNCTION";
                    }
                }
                if (typeof value === "object") {
                    // Remove wrapping on content objects
                    if ("wrappedJSObject" in value) {
                        value = value.wrappedJSObject;
                    }
                    // Serialize DOM elements
                    if (value instanceof HTMLElement) {
                        return getPathToDomElement(value);
                    }
                    // Prevent serialization cycles
                    if (key === "" || seenObjects.indexOf(value) < 0) {
                        seenObjects.push(value);
                        return value;
                    }
                    else {
                        return typeof value;
                    }
                }
                return value;
            });
        }
        catch (error) {
            console.log("OpenWPM: SERIALIZATION ERROR: " + error);
            return "SERIALIZATION ERROR: " + error;
        }
    }
    function updateCounterAndCheckIfOver(scriptUrl, symbol) {
        const key = scriptUrl + "|" + symbol;
        if (key in logCounter && logCounter[key] >= maxLogCount) {
            return true;
        }
        else if (!(key in logCounter)) {
            logCounter[key] = 1;
        }
        else {
            logCounter[key] += 1;
        }
        return false;
    }
    // For gets, sets, etc. on a single value
    function logValue(instrumentedVariableName, value, operation, // from JSOperation object please
    callContext, logSettings) {
        if (inLog) {
            return;
        }
        inLog = true;
        const overLimit = updateCounterAndCheckIfOver(callContext.scriptUrl, instrumentedVariableName);
        if (overLimit) {
            inLog = false;
            return;
        }
        const msg = {
            operation,
            symbol: instrumentedVariableName,
            value: serializeObject(value, logSettings.logFunctionsAsStrings),
            scriptUrl: callContext.scriptUrl,
            scriptLine: callContext.scriptLine,
            scriptCol: callContext.scriptCol,
            funcName: callContext.funcName,
            scriptLocEval: callContext.scriptLocEval,
            callStack: callContext.callStack,
            ordinal: ordinal++,
        };
        try {
            send("logValue", msg);
        }
        catch (error) {
            console.log("OpenWPM: Unsuccessful value log!");
            logErrorToConsole(error);
        }
        inLog = false;
    }
    // For functions
    function logCall(instrumentedFunctionName, args, callContext, logSettings) {
        if (inLog) {
            return;
        }
        inLog = true;
        const overLimit = updateCounterAndCheckIfOver(callContext.scriptUrl, instrumentedFunctionName);
        if (overLimit) {
            inLog = false;
            return;
        }
        try {
            // Convert special arguments array to a standard array for JSONifying
            const serialArgs = [];
            for (const arg of args) {
                serialArgs.push(serializeObject(arg, logSettings.logFunctionsAsStrings));
            }
            const msg = {
                operation: JSOperation.call,
                symbol: instrumentedFunctionName,
                args: serialArgs,
                value: "",
                scriptUrl: callContext.scriptUrl,
                scriptLine: callContext.scriptLine,
                scriptCol: callContext.scriptCol,
                funcName: callContext.funcName,
                scriptLocEval: callContext.scriptLocEval,
                callStack: callContext.callStack,
                ordinal: ordinal++,
            };
            send("logCall", msg);
        }
        catch (error) {
            console.log("OpenWPM: Unsuccessful call log: " + instrumentedFunctionName);
            logErrorToConsole(error);
        }
        inLog = false;
    }
    function logErrorToConsole(error, context = false) {
        console.error("OpenWPM: Error name: " + error.name);
        console.error("OpenWPM: Error message: " + error.message);
        console.error("OpenWPM: Error filename: " + error.fileName);
        console.error("OpenWPM: Error line number: " + error.lineNumber);
        console.error("OpenWPM: Error stack: " + error.stack);
        if (context) {
            console.error("OpenWPM: Error context: " + JSON.stringify(context));
        }
    }
    // Helper to get originating script urls
    function getStackTrace() {
        let stack;
        try {
            throw new Error();
        }
        catch (err) {
            stack = err.stack;
        }
        return stack;
    }
    // from http://stackoverflow.com/a/5202185
    const rsplit = function (source, sep, maxsplit) {
        const split = source.split(sep);
        return maxsplit
            ? [split.slice(0, -maxsplit).join(sep)].concat(split.slice(-maxsplit))
            : split;
    };
    function getOriginatingScriptContext(getCallStack = false) {
        const trace = getStackTrace()
            .trim()
            .split("\n");
        // return a context object even if there is an error
        const empty_context = {
            scriptUrl: "",
            scriptLine: "",
            scriptCol: "",
            funcName: "",
            scriptLocEval: "",
            callStack: "",
        };
        if (trace.length < 4) {
            return empty_context;
        }
        // 0, 1 and 2 are OpenWPM's own functions (e.g. getStackTrace), skip them.
        const callSite = trace[3];
        if (!callSite) {
            return empty_context;
        }
        /*
         * Stack frame format is simply: FUNC_NAME@FILENAME:LINE_NO:COLUMN_NO
         *
         * If eval or Function is involved we have an additional part after the FILENAME, e.g.:
         * FUNC_NAME@FILENAME line 123 > eval line 1 > eval:LINE_NO:COLUMN_NO
         * or FUNC_NAME@FILENAME line 234 > Function:LINE_NO:COLUMN_NO
         *
         * We store the part between the FILENAME and the LINE_NO in scriptLocEval
         */
        try {
            let scriptUrl = "";
            let scriptLocEval = ""; // for eval or Function calls
            const callSiteParts = callSite.split("@");
            const funcName = callSiteParts[0] || "";
            const items = rsplit(callSiteParts[1], ":", 2);
            const columnNo = items[items.length - 1];
            const lineNo = items[items.length - 2];
            const scriptFileName = items[items.length - 3] || "";
            const lineNoIdx = scriptFileName.indexOf(" line "); // line in the URL means eval or Function
            if (lineNoIdx === -1) {
                scriptUrl = scriptFileName; // TODO: sometimes we have filename only, e.g. XX.js
            }
            else {
                scriptUrl = scriptFileName.slice(0, lineNoIdx);
                scriptLocEval = scriptFileName.slice(lineNoIdx + 1, scriptFileName.length);
            }
            const callContext = {
                scriptUrl,
                scriptLine: lineNo,
                scriptCol: columnNo,
                funcName,
                scriptLocEval,
                callStack: getCallStack
                    ? trace
                        .slice(3)
                        .join("\n")
                        .trim()
                    : "",
            };
            return callContext;
        }
        catch (e) {
            console.log("OpenWPM: Error parsing the script context", e.toString(), callSite);
            return empty_context;
        }
    }
    function isObject(object, propertyName) {
        let property;
        try {
            property = object[propertyName];
        }
        catch (error) {
            return false;
        }
        if (property === null) {
            // null is type "object"
            return false;
        }
        return typeof property === "object";
    }
    // Log calls to a given function
    // This helper function returns a wrapper around `func` which logs calls
    // to `func`. `objectName` and `methodName` are used strictly to identify
    // which object method `func` is coming from in the logs
    function instrumentFunction(objectName, methodName, func, logSettings) {
        return function () {
            const callContext = getOriginatingScriptContext(logSettings.logCallStack);
            logCall(objectName + "." + methodName, arguments, callContext, logSettings);
            return func.apply(this, arguments);
        };
    }
    // Log properties of prototypes and objects
    function instrumentObjectProperty(object, objectName, propertyName, logSettings) {
        if (!object ||
            !objectName ||
            !propertyName ||
            propertyName === "undefined") {
            throw new Error(`Invalid request to instrumentObjectProperty.
        Object: ${object}
        objectName: ${objectName}
        propertyName: ${propertyName}
        `);
        }
        // Store original descriptor in closure
        const propDesc = Object.getPropertyDescriptor(object, propertyName);
        // Property descriptor must exist unless we are instrumenting a nonExisting property
        if (!propDesc &&
            !logSettings.nonExistingPropertiesToInstrument.includes(propertyName)) {
            console.error("Property descriptor not found for", objectName, propertyName, object);
            return;
        }
        // Property descriptor for undefined properties
        let undefinedPropValue;
        const undefinedPropDesc = {
            get: () => {
                return undefinedPropValue;
            },
            set: value => {
                undefinedPropValue = value;
            },
            enumerable: false,
        };
        // Instrument data or accessor property descriptors
        const originalGetter = propDesc ? propDesc.get : undefinedPropDesc.get;
        const originalSetter = propDesc ? propDesc.set : undefinedPropDesc.set;
        let originalValue = propDesc ? propDesc.value : undefinedPropValue;
        // We overwrite both data and accessor properties as an instrumented
        // accessor property
        Object.defineProperty(object, propertyName, {
            configurable: true,
            get: (function () {
                return function () {
                    let origProperty;
                    const callContext = getOriginatingScriptContext(logSettings.logCallStack);
                    const instrumentedVariableName = `${objectName}.${propertyName}`;
                    // get original value
                    if (!propDesc) {
                        // if undefined property
                        origProperty = undefinedPropValue;
                    }
                    else if (originalGetter) {
                        // if accessor property
                        origProperty = originalGetter.call(this);
                    }
                    else if ("value" in propDesc) {
                        // if data property
                        origProperty = originalValue;
                    }
                    else {
                        console.error(`Property descriptor for ${instrumentedVariableName} doesn't have getter or value?`);
                        logValue(instrumentedVariableName, "", JSOperation.get_failed, callContext, logSettings);
                        return;
                    }
                    // Log `gets` except those that have instrumented return values
                    // * All returned functions are instrumented with a wrapper
                    // * Returned objects may be instrumented if recursive
                    //   instrumentation is enabled and this isn't at the depth limit.
                    if (typeof origProperty === "function") {
                        if (logSettings.logFunctionGets) {
                            logValue(instrumentedVariableName, origProperty, JSOperation.get_function, callContext, logSettings);
                        }
                        const instrumentedFunctionWrapper = instrumentFunction(objectName, propertyName, origProperty, logSettings);
                        // Restore the original prototype and constructor so that instrumented classes remain intact
                        // TODO: This may have introduced prototype pollution as per https://github.com/mozilla/OpenWPM/issues/471
                        if (origProperty.prototype) {
                            instrumentedFunctionWrapper.prototype = origProperty.prototype;
                            if (origProperty.prototype.constructor) {
                                instrumentedFunctionWrapper.prototype.constructor =
                                    origProperty.prototype.constructor;
                            }
                        }
                        return instrumentedFunctionWrapper;
                    }
                    else if (typeof origProperty === "object" &&
                        logSettings.recursive &&
                        logSettings.depth > 0) {
                        return origProperty;
                    }
                    else {
                        logValue(instrumentedVariableName, origProperty, JSOperation.get, callContext, logSettings);
                        return origProperty;
                    }
                };
            })(),
            set: (function () {
                return function (value) {
                    const callContext = getOriginatingScriptContext(logSettings.logCallStack);
                    const instrumentedVariableName = `${objectName}.${propertyName}`;
                    let returnValue;
                    // Prevent sets for functions and objects if enabled
                    if (logSettings.preventSets &&
                        (typeof originalValue === "function" ||
                            typeof originalValue === "object")) {
                        logValue(instrumentedVariableName, value, JSOperation.set_prevented, callContext, logSettings);
                        return value;
                    }
                    // set new value to original setter/location
                    if (originalSetter) {
                        // if accessor property
                        returnValue = originalSetter.call(this, value);
                    }
                    else if ("value" in propDesc) {
                        inLog = true;
                        if (object.isPrototypeOf(this)) {
                            Object.defineProperty(this, propertyName, {
                                value,
                            });
                        }
                        else {
                            originalValue = value;
                        }
                        returnValue = value;
                        inLog = false;
                    }
                    else {
                        console.error(`Property descriptor for ${instrumentedVariableName} doesn't have setter or value?`);
                        logValue(instrumentedVariableName, value, JSOperation.set_failed, callContext, logSettings);
                        return value;
                    }
                    logValue(instrumentedVariableName, value, JSOperation.set, callContext, logSettings);
                    return returnValue;
                };
            })(),
        });
    }
    function instrumentObject(object, instrumentedName, logSettings) {
        // Set propertiesToInstrument to null to force no properties to be instrumented.
        // (this is used in testing for example)
        let propertiesToInstrument;
        if (logSettings.propertiesToInstrument === null) {
            propertiesToInstrument = [];
        }
        else if (logSettings.propertiesToInstrument.length === 0) {
            propertiesToInstrument = Object.getPropertyNames(object);
        }
        else {
            propertiesToInstrument = logSettings.propertiesToInstrument;
        }
        for (const propertyName of propertiesToInstrument) {
            if (logSettings.excludedProperties.includes(propertyName)) {
                continue;
            }
            // If `recursive` flag set we want to recursively instrument any
            // object properties that aren't the prototype object.
            if (logSettings.recursive &&
                logSettings.depth > 0 &&
                isObject(object, propertyName) &&
                propertyName !== "__proto__") {
                const newInstrumentedName = `${instrumentedName}.${propertyName}`;
                const newLogSettings = { ...logSettings };
                newLogSettings.depth = logSettings.depth - 1;
                newLogSettings.propertiesToInstrument = [];
                instrumentObject(object[propertyName], newInstrumentedName, newLogSettings);
            }
            try {
                instrumentObjectProperty(object, instrumentedName, propertyName, logSettings);
            }
            catch (error) {
                if (error instanceof TypeError &&
                    error.message.includes("can't redefine non-configurable property")) {
                    console.warn(`Cannot instrument non-configurable property: ${instrumentedName}:${propertyName}`);
                }
                else {
                    logErrorToConsole(error, { instrumentedName, propertyName });
                }
            }
        }
        for (const propertyName of logSettings.nonExistingPropertiesToInstrument) {
            if (logSettings.excludedProperties.includes(propertyName)) {
                continue;
            }
            try {
                instrumentObjectProperty(object, instrumentedName, propertyName, logSettings);
            }
            catch (error) {
                logErrorToConsole(error, { instrumentedName, propertyName });
            }
        }
    }
    const sendFactory = function (eventId, $sendMessagesToLogger) {
        let messages = [];
        // debounce sending queued messages
        const _send = debounce(function () {
            $sendMessagesToLogger(eventId, messages);
            // clear the queue
            messages = [];
        }, 100);
        return function (msgType, msg) {
            // queue the message
            messages.push({ type: msgType, content: msg });
            _send();
        };
    };
    const send = sendFactory(eventId, sendMessagesToLogger);
    function instrumentJS(JSInstrumentRequests) {
        // The JS Instrument Requests are setup and validated python side
        // including setting defaults for logSettings.
        // More details about how this function is invoked are in
        // content/javascript-instrument-content-scope.ts
        JSInstrumentRequests.forEach(function (item) {
            instrumentObject(eval(item.object), item.instrumentedName, item.logSettings);
        });
    }
    // This whole function getInstrumentJS returns just the function `instrumentJS`.
    return instrumentJS;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMtaW5zdHJ1bWVudHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvbGliL2pzLWluc3RydW1lbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGlFQUFpRTtBQUNqRSxvRkFBb0Y7QUE4QnBGLE1BQU0sVUFBVSxlQUFlLENBQUMsT0FBZSxFQUFFLG9CQUFvQjtJQUNuRTs7O09BR0c7SUFFSCxtRUFBbUU7SUFDbkUsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDO0lBQ3hCLGFBQWE7SUFDYixNQUFNLFVBQVUsR0FBRyxJQUFJLE1BQU0sRUFBRSxDQUFDO0lBQ2hDLCtDQUErQztJQUMvQyxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDbEIsZ0RBQWdEO0lBQ2hELElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztJQUVoQiwwQkFBMEI7SUFDMUIsTUFBTSxXQUFXLEdBQUc7UUFDbEIsSUFBSSxFQUFFLE1BQU07UUFDWixHQUFHLEVBQUUsS0FBSztRQUNWLFVBQVUsRUFBRSxhQUFhO1FBQ3pCLFlBQVksRUFBRSxlQUFlO1FBQzdCLEdBQUcsRUFBRSxLQUFLO1FBQ1YsVUFBVSxFQUFFLGFBQWE7UUFDekIsYUFBYSxFQUFFLGdCQUFnQjtLQUNoQyxDQUFDO0lBRUYsb0ZBQW9GO0lBQ3BGLHlFQUF5RTtJQUN6RSxNQUFNLENBQUMscUJBQXFCLEdBQUcsVUFBUyxPQUFPLEVBQUUsSUFBSTtRQUNuRCxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUU7WUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO1NBQ2hFO1FBQ0QsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDLHdCQUF3QixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN4RCxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNDLE9BQU8sRUFBRSxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUss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

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/pending-navigation.js":
/*!************************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/pending-navigation.js ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PendingNavigation": () => (/* binding */ PendingNavigation)
/* harmony export */ });
/**
 * Ties together the two separate navigation events that together holds information about both parent frame id and transition-related attributes
 */
class PendingNavigation {
    onBeforeNavigateEventNavigation;
    onCommittedEventNavigation;
    resolveOnBeforeNavigateEventNavigation;
    resolveOnCommittedEventNavigation;
    constructor() {
        this.onBeforeNavigateEventNavigation = new Promise(resolve => {
            this.resolveOnBeforeNavigateEventNavigation = resolve;
        });
        this.onCommittedEventNavigation = new Promise(resolve => {
            this.resolveOnCommittedEventNavigation = resolve;
        });
    }
    resolved() {
        return Promise.all([
            this.onBeforeNavigateEventNavigation,
            this.onCommittedEventNavigation,
        ]);
    }
    /**
     * Either returns or times out and returns undefined or
     * returns the results from resolved() above
     * @param ms
     */
    async resolvedWithinTimeout(ms) {
        const resolved = await Promise.race([
            this.resolved(),
            new Promise(resolve => setTimeout(resolve, ms)),
        ]);
        return resolved;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVuZGluZy1uYXZpZ2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9wZW5kaW5nLW5hdmlnYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUE7O0dBRUc7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBQ1osK0JBQStCLENBQXNCO0lBQ3JELDBCQUEwQixDQUFzQjtJQUN6RCxzQ0FBc0MsQ0FBZ0M7SUFDdEUsaUNBQWlDLENBQWdDO0lBQ3hFO1FBQ0UsSUFBSSxDQUFDLCtCQUErQixHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzNELElBQUksQ0FBQyxzQ0FBc0MsR0FBRyxPQUFPLENBQUM7UUFDeEQsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsMEJBQTBCLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDdEQsSUFBSSxDQUFDLGlDQUFpQyxHQUFHLE9BQU8sQ0FBQztRQUNuRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDTSxRQUFRO1FBQ2IsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2pCLElBQUksQ0FBQywrQkFBK0I7WUFDcEMsSUFBSSxDQUFDLDBCQUEwQjtTQUNoQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO1FBQ25DLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztZQUNsQyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2YsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ2hELENBQUMsQ0FBQztRQUNILE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7Q0FDRiJ9

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/pending-request.js":
/*!*********************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/pending-request.js ***!
  \*********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PendingRequest": () => (/* binding */ PendingRequest)
/* harmony export */ });
/**
 * Ties together the two separate events that together holds information about both request headers and body
 */
class PendingRequest {
    onBeforeRequestEventDetails;
    onBeforeSendHeadersEventDetails;
    resolveOnBeforeRequestEventDetails;
    resolveOnBeforeSendHeadersEventDetails;
    constructor() {
        this.onBeforeRequestEventDetails = new Promise(resolve => {
            this.resolveOnBeforeRequestEventDetails = resolve;
        });
        this.onBeforeSendHeadersEventDetails = new Promise(resolve => {
            this.resolveOnBeforeSendHeadersEventDetails = resolve;
        });
    }
    resolved() {
        return Promise.all([
            this.onBeforeRequestEventDetails,
            this.onBeforeSendHeadersEventDetails,
        ]);
    }
    /**
     * Either returns or times out and returns undefined or
     * returns the results from resolved() above
     * @param ms
     */
    async resolvedWithinTimeout(ms) {
        const resolved = await Promise.race([
            this.resolved(),
            new Promise(resolve => setTimeout(resolve, ms)),
        ]);
        return resolved;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVuZGluZy1yZXF1ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9wZW5kaW5nLXJlcXVlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBS0E7O0dBRUc7QUFDSCxNQUFNLE9BQU8sY0FBYztJQUNULDJCQUEyQixDQUV6QztJQUNjLCtCQUErQixDQUU3QztJQUNLLGtDQUFrQyxDQUUvQjtJQUNILHNDQUFzQyxDQUVuQztJQUNWO1FBQ0UsSUFBSSxDQUFDLDJCQUEyQixHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ3ZELElBQUksQ0FBQyxrQ0FBa0MsR0FBRyxPQUFPLENBQUM7UUFDcEQsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsK0JBQStCLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDM0QsSUFBSSxDQUFDLHNDQUFzQyxHQUFHLE9BQU8sQ0FBQztRQUN4RCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDTSxRQUFRO1FBQ2IsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2pCLElBQUksQ0FBQywyQkFBMkI7WUFDaEMsSUFBSSxDQUFDLCtCQUErQjtTQUNyQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO1FBQ25DLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztZQUNsQyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2YsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQ2hELENBQUMsQ0FBQztRQUNILE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7Q0FDRiJ9

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/pending-response.js":
/*!**********************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/pending-response.js ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PendingResponse": () => (/* binding */ PendingResponse)
/* harmony export */ });
/* harmony import */ var _response_body_listener__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./response-body-listener */ "../webext-instrumentation/build/module/lib/response-body-listener.js");

/**
 * Ties together the two separate events that together holds information about both response headers and body
 */
class PendingResponse {
    onBeforeRequestEventDetails;
    onCompletedEventDetails;
    responseBodyListener;
    resolveOnBeforeRequestEventDetails;
    resolveOnCompletedEventDetails;
    constructor() {
        this.onBeforeRequestEventDetails = new Promise(resolve => {
            this.resolveOnBeforeRequestEventDetails = resolve;
        });
        this.onCompletedEventDetails = new Promise(resolve => {
            this.resolveOnCompletedEventDetails = resolve;
        });
    }
    addResponseResponseBodyListener(details) {
        this.responseBodyListener = new _response_body_listener__WEBPACK_IMPORTED_MODULE_0__.ResponseBodyListener(details);
    }
    resolved() {
        return Promise.all([
            this.onBeforeRequestEventDetails,
            this.onCompletedEventDetails,
        ]);
    }
    /**
     * Either returns or times out and returns undefined or
     * returns the results from resolved() above
     * @param ms
     */
    async resolvedWithinTimeout(ms) {
        const resolved = await Promise.race([
            this.resolved(),
            new Promise(resolve => setTimeout(resolve, ms)),
        ]);
        return resolved;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVuZGluZy1yZXNwb25zZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvcGVuZGluZy1yZXNwb25zZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFJQSxPQUFPLEVBQUMsb0JBQW9CLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUU5RDs7R0FFRztBQUNILE1BQU0sT0FBTyxlQUFlO0lBQ1YsMkJBQTJCLENBRXpDO0lBQ2MsdUJBQXVCLENBRXJDO0lBQ0ssb0JBQW9CLENBQXVCO0lBQzNDLGtDQUFrQyxDQUUvQjtJQUNILDhCQUE4QixDQUUzQjtJQUNWO1FBQ0UsSUFBSSxDQUFDLDJCQUEyQixHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ3ZELElBQUksQ0FBQyxrQ0FBa0MsR0FBRyxPQUFPLENBQUM7UUFDcEQsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDbkQsSUFBSSxDQUFDLDhCQUE4QixHQUFHLE9BQU8sQ0FBQztRQUNoRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDTSwrQkFBK0IsQ0FDcEMsT0FBOEM7UUFFOUMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksb0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEUsQ0FBQztJQUNNLFFBQVE7UUFDYixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDakIsSUFBSSxDQUFDLDJCQUEyQjtZQUNoQyxJQUFJLENBQUMsdUJBQXVCO1NBQzdCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLHFCQUFxQixDQUFDLEVBQUU7UUFDbkMsTUFBTSxRQUFRLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDZixJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7U0FDaEQsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxRQUFRLENBQUM7SUFDbEIsQ0FBQztDQUNGIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/response-body-listener.js":
/*!****************************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/response-body-listener.js ***!
  \****************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ResponseBodyListener": () => (/* binding */ ResponseBodyListener)
/* harmony export */ });
/* harmony import */ var _sha256__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./sha256 */ "../webext-instrumentation/build/module/lib/sha256.js");

class ResponseBodyListener {
    responseBody;
    contentHash;
    resolveResponseBody;
    resolveContentHash;
    constructor(details) {
        this.responseBody = new Promise(resolve => {
            this.resolveResponseBody = resolve;
        });
        this.contentHash = new Promise(resolve => {
            this.resolveContentHash = resolve;
        });
        // Used to parse Response stream
        const filter = browser.webRequest.filterResponseData(details.requestId.toString());
        let responseBody = new Uint8Array();
        filter.ondata = event => {
            (0,_sha256__WEBPACK_IMPORTED_MODULE_0__.digestMessage)(event.data).then(digest => {
                this.resolveContentHash(digest);
            });
            const incoming = new Uint8Array(event.data);
            const tmp = new Uint8Array(responseBody.length + incoming.length);
            tmp.set(responseBody);
            tmp.set(incoming, responseBody.length);
            responseBody = tmp;
            filter.write(event.data);
        };
        filter.onstop = _event => {
            this.resolveResponseBody(responseBody);
            filter.disconnect();
        };
    }
    async getResponseBody() {
        return this.responseBody;
    }
    async getContentHash() {
        return this.contentHash;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzcG9uc2UtYm9keS1saXN0ZW5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvcmVzcG9uc2UtYm9keS1saXN0ZW5lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRXZDLE1BQU0sT0FBTyxvQkFBb0I7SUFDZCxZQUFZLENBQXNCO0lBQ2xDLFdBQVcsQ0FBa0I7SUFDdEMsbUJBQW1CLENBQXFDO0lBQ3hELGtCQUFrQixDQUFnQztJQUUxRCxZQUFZLE9BQThDO1FBQ3hELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDeEMsSUFBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDdkMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQztRQUNwQyxDQUFDLENBQUMsQ0FBQztRQUVILGdDQUFnQztRQUNoQyxNQUFNLE1BQU0sR0FBUSxPQUFPLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUN2RCxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUN0QixDQUFDO1FBRVQsSUFBSSxZQUFZLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUNwQyxNQUFNLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxFQUFFO1lBQ3RCLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN0QyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbEMsQ0FBQyxDQUFDLENBQUM7WUFDSCxNQUFNLFFBQVEsR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDNUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbEUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN0QixHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdkMsWUFBWSxHQUFHLEdBQUcsQ0FBQztZQUNuQixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQixDQUFDLENBQUM7UUFFRixNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN2QyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDdEIsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVNLEtBQUssQ0FBQyxlQUFlO1FBQzFCLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztJQUMzQixDQUFDO0lBRU0sS0FBSyxDQUFDLGNBQWM7UUFDekIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7Q0FDRiJ9

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/sha256.js":
/*!************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/sha256.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "digestMessage": () => (/* binding */ digestMessage)
/* harmony export */ });
/**
 * Code from the example at
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 */
async function digestMessage(msgUint8) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join(""); // convert bytes to hex string
    return hashHex;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhMjU2LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9zaGEyNTYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztHQUdHO0FBRUgsTUFBTSxDQUFDLEtBQUssVUFBVSxhQUFhLENBQUMsUUFBb0I7SUFDdEQsTUFBTSxVQUFVLEdBQUcsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxtQkFBbUI7SUFDdkYsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsK0JBQStCO0lBQ3pGLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyw4QkFBOEI7SUFDNUcsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyJ9

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/string-utils.js":
/*!******************************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/string-utils.js ***!
  \******************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "encode_utf8": () => (/* binding */ encode_utf8),
/* harmony export */   "escapeString": () => (/* binding */ escapeString),
/* harmony export */   "escapeUrl": () => (/* binding */ escapeUrl),
/* harmony export */   "Uint8ToBase64": () => (/* binding */ Uint8ToBase64),
/* harmony export */   "boolToInt": () => (/* binding */ boolToInt)
/* harmony export */ });
function encode_utf8(s) {
    return unescape(encodeURIComponent(s));
}
const escapeString = function (str) {
    // Convert to string if necessary
    if (typeof str != "string") {
        str = String(str);
    }
    return encode_utf8(str);
};
const escapeUrl = function (url, stripDataUrlData = true) {
    url = escapeString(url);
    // data:[<mediatype>][;base64],<data>
    if (url.substr(0, 5) === "data:" &&
        stripDataUrlData &&
        url.indexOf(",") > -1) {
        url = url.substr(0, url.indexOf(",") + 1) + "<data-stripped>";
    }
    return url;
};
// Base64 encoding, found on:
// https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string/25644409#25644409
const Uint8ToBase64 = function (u8Arr) {
    const CHUNK_SIZE = 0x8000; // arbitrary number
    let index = 0;
    const length = u8Arr.length;
    let result = "";
    let slice;
    while (index < length) {
        slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }
    return btoa(result);
};
const boolToInt = function (bool) {
    return bool ? 1 : 0;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyaW5nLXV0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9zdHJpbmctdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxVQUFVLFdBQVcsQ0FBQyxDQUFDO0lBQzNCLE9BQU8sUUFBUSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVELE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxVQUFTLEdBQVE7SUFDM0MsaUNBQWlDO0lBQ2pDLElBQUksT0FBTyxHQUFHLElBQUksUUFBUSxFQUFFO1FBQzFCLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDbkI7SUFFRCxPQUFPLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMxQixDQUFDLENBQUM7QUFFRixNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsVUFDdkIsR0FBVyxFQUNYLG1CQUE0QixJQUFJO0lBRWhDLEdBQUcsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEIscUNBQXFDO0lBQ3JDLElBQ0UsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssT0FBTztRQUM1QixnQkFBZ0I7UUFDaEIsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsRUFDckI7UUFDQSxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxpQkFBaUIsQ0FBQztLQUMvRDtJQUNELE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQyxDQUFDO0FBRUYsNkJBQTZCO0FBQzdCLHFIQUFxSDtBQUNySCxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsVUFBUyxLQUFpQjtJQUNyRCxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsQ0FBQyxtQkFBbUI7SUFDOUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ2QsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUM1QixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7SUFDaEIsSUFBSSxLQUFpQixDQUFDO0lBQ3RCLE9BQU8sS0FBSyxHQUFHLE1BQU0sRUFBRTtRQUNyQixLQUFLLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDcEUsTUFBTSxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNqRCxLQUFLLElBQUksVUFBVSxDQUFDO0tBQ3JCO0lBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDO0FBRUYsTUFBTSxDQUFDLE1BQU0sU0FBUyxHQUFHLFVBQVMsSUFBYTtJQUM3QyxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQ0FBQyxDQUFDIn0=

/***/ }),

/***/ "../webext-instrumentation/build/module/lib/uuid.js":
/*!**********************************************************!*\
  !*** ../webext-instrumentation/build/module/lib/uuid.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "makeUUID": () => (/* binding */ makeUUID)
/* harmony export */ });
/* tslint:disable:no-bitwise */
// from https://gist.github.com/jed/982883#gistcomment-2403369
const hex = [];
for (let i = 0; i < 256; i++) {
    hex[i] = (i < 16 ? "0" : "") + i.toString(16);
}
const makeUUID = () => {
    const r = crypto.getRandomValues(new Uint8Array(16));
    r[6] = (r[6] & 0x0f) | 0x40;
    r[8] = (r[8] & 0x3f) | 0x80;
    return (hex[r[0]] +
        hex[r[1]] +
        hex[r[2]] +
        hex[r[3]] +
        "-" +
        hex[r[4]] +
        hex[r[5]] +
        "-" +
        hex[r[6]] +
        hex[r[7]] +
        "-" +
        hex[r[8]] +
        hex[r[9]] +
        "-" +
        hex[r[10]] +
        hex[r[11]] +
        hex[r[12]] +
        hex[r[13]] +
        hex[r[14]] +
        hex[r[15]]);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXVpZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvdXVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwrQkFBK0I7QUFFL0IsOERBQThEO0FBQzlELE1BQU0sR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUVmLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDNUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0NBQy9DO0FBRUQsTUFBTSxDQUFDLE1BQU0sUUFBUSxHQUFHLEdBQUcsRUFBRTtJQUMzQixNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFckQsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztJQUM1QixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDO0lBRTVCLE9BQU8sQ0FDTCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNULEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDVCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsR0FBRztRQUNILEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDVCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsR0FBRztRQUNILEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDVCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsR0FBRztRQUNILEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDVCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ1QsR0FBRztRQUNILEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDVixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ1YsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNWLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDVixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ1YsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUNYLENBQUM7QUFDSixDQUFDLENBQUMifQ==

/***/ }),

/***/ "../webext-instrumentation/build/module/schema.js":
/*!********************************************************!*\
  !*** ../webext-instrumentation/build/module/schema.js ***!
  \********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "dateTimeUnicodeFormatString": () => (/* binding */ dateTimeUnicodeFormatString)
/* harmony export */ });
// https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
const dateTimeUnicodeFormatString = "yyyy-MM-dd'T'HH:mm:ss.SSSXX";
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZW1hLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFJQSwrRUFBK0U7QUFDL0UsTUFBTSxDQUFDLE1BQU0sMkJBQTJCLEdBQUcsNkJBQTZCLENBQUMifQ==

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!*****************************!*\
  !*** ./feature.js/index.js ***!
  \*****************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var openwpm_webext_instrumentation__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! openwpm-webext-instrumentation */ "../webext-instrumentation/build/module/index.js");
/* harmony import */ var _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./loggingdb.js */ "./feature.js/loggingdb.js");
/* harmony import */ var _callstack_instrument_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./callstack-instrument.js */ "./feature.js/callstack-instrument.js");





async function main() {
  // Read the browser configuration from file
  let filename = "browser_params.json";
  let config = await browser.profileDirIO.readFile(filename);
  if (config) {
    config = JSON.parse(config);
    console.log("Browser Config:", config);
  } else {
    config = {
      navigation_instrument:true,
      cookie_instrument:true,
      js_instrument:true,
      cleaned_js_instrument_settings:
      [
        {
          object: `window.CanvasRenderingContext2D.prototype`,
          instrumentedName: "CanvasRenderingContext2D",
          logSettings: {
            propertiesToInstrument: [],
            nonExistingPropertiesToInstrument: [],
            excludedProperties: [],
            logCallStack: false,
            logFunctionsAsStrings: false,
            logFunctionGets: false,
            preventSets: false,
            recursive: false,
            depth: 5,
          }
        },
      ],
      http_instrument:true,
      callstack_instrument:true,
      save_content:false,
      testing:true,
      browser_id:0,
      custom_params: {}
    };
    console.log("WARNING: config not found. Assuming this is a test run of",
                "the extension. Outputting all queries to console.", {config});
  }

  await _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__.open(config['storage_controller_address'],
                       config['logger_address'],
                       config['browser_id']);

  if (config["custom_params"]["pre_instrumentation_code"]) {
    eval(config["custom_params"]["pre_instrumentation_code"])
  }
  if (config["navigation_instrument"]) {
    _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__.logDebug("Navigation instrumentation enabled");
    let navigationInstrument = new openwpm_webext_instrumentation__WEBPACK_IMPORTED_MODULE_0__.NavigationInstrument(_loggingdb_js__WEBPACK_IMPORTED_MODULE_1__);
    navigationInstrument.run(config["browser_id"]);
  }

  if (config['cookie_instrument']) {
    _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__.logDebug("Cookie instrumentation enabled");
    let cookieInstrument = new openwpm_webext_instrumentation__WEBPACK_IMPORTED_MODULE_0__.CookieInstrument(_loggingdb_js__WEBPACK_IMPORTED_MODULE_1__);
    cookieInstrument.run(config['browser_id']);
  }

  if (config['js_instrument']) {
    _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__.logDebug("Javascript instrumentation enabled");
    let jsInstrument = new openwpm_webext_instrumentation__WEBPACK_IMPORTED_MODULE_0__.JavascriptInstrument(_loggingdb_js__WEBPACK_IMPORTED_MODULE_1__);
    jsInstrument.run(config['browser_id']);
    await jsInstrument.registerContentScript(config['testing'], config['cleaned_js_instrument_settings']);
  }

  if (config['http_instrument']) {
    _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__.logDebug("HTTP Instrumentation enabled");
    let httpInstrument = new openwpm_webext_instrumentation__WEBPACK_IMPORTED_MODULE_0__.HttpInstrument(_loggingdb_js__WEBPACK_IMPORTED_MODULE_1__);
    httpInstrument.run(config['browser_id'],
                       config['save_content']);
  }

  if (config['callstack_instrument']) {
    _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__.logDebug("Callstack Instrumentation enabled");
    let callstackInstrument = new _callstack_instrument_js__WEBPACK_IMPORTED_MODULE_2__.CallstackInstrument(_loggingdb_js__WEBPACK_IMPORTED_MODULE_1__);
    callstackInstrument.run(config['browser_id']);
  }
  
  if (config['dns_instrument']) {
    _loggingdb_js__WEBPACK_IMPORTED_MODULE_1__.logDebug("DNS instrumentation enabled");
    let dnsInstrument = new openwpm_webext_instrumentation__WEBPACK_IMPORTED_MODULE_0__.DnsInstrument(_loggingdb_js__WEBPACK_IMPORTED_MODULE_1__);
    dnsInstrument.run(config['browser_id']);
  }

  await browser.profileDirIO.writeFile("OPENWPM_STARTUP_SUCCESS.txt", "");
}

main();


})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uL2ZlYXR1cmUuanMvY2FsbHN0YWNrLWluc3RydW1lbnQuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi9mZWF0dXJlLmpzL2xvZ2dpbmdkYi5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uL2ZlYXR1cmUuanMvc29ja2V0LmpzIiwid2VicGFjazovL0BvcGVud3BtL3dlYmV4dC1maXJlZm94Ly4uL3dlYmV4dC1pbnN0cnVtZW50YXRpb24vYnVpbGQvbW9kdWxlL2JhY2tncm91bmQvY29va2llLWluc3RydW1lbnQuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvYmFja2dyb3VuZC9kbnMtaW5zdHJ1bWVudC5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uLi93ZWJleHQtaW5zdHJ1bWVudGF0aW9uL2J1aWxkL21vZHVsZS9iYWNrZ3JvdW5kL2h0dHAtaW5zdHJ1bWVudC5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uLi93ZWJleHQtaW5zdHJ1bWVudGF0aW9uL2J1aWxkL21vZHVsZS9iYWNrZ3JvdW5kL2phdmFzY3JpcHQtaW5zdHJ1bWVudC5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uLi93ZWJleHQtaW5zdHJ1bWVudGF0aW9uL2J1aWxkL21vZHVsZS9iYWNrZ3JvdW5kL25hdmlnYXRpb24taW5zdHJ1bWVudC5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uLi93ZWJleHQtaW5zdHJ1bWVudGF0aW9uL2J1aWxkL21vZHVsZS9jb250ZW50L2phdmFzY3JpcHQtaW5zdHJ1bWVudC1jb250ZW50LXNjb3BlLmpzIiwid2VicGFjazovL0BvcGVud3BtL3dlYmV4dC1maXJlZm94Ly4uL3dlYmV4dC1pbnN0cnVtZW50YXRpb24vYnVpbGQvbW9kdWxlL2NvbnRlbnQvamF2YXNjcmlwdC1pbnN0cnVtZW50LXBhZ2Utc2NvcGUuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvaW5kZXguanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvbGliL2V4dGVuc2lvbi1zZXNzaW9uLWV2ZW50LW9yZGluYWwuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvbGliL2V4dGVuc2lvbi1zZXNzaW9uLXV1aWQuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvbGliL2h0dHAtcG9zdC1wYXJzZXIuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvbGliL2pzLWluc3RydW1lbnRzLmpzIiwid2VicGFjazovL0BvcGVud3BtL3dlYmV4dC1maXJlZm94Ly4uL3dlYmV4dC1pbnN0cnVtZW50YXRpb24vYnVpbGQvbW9kdWxlL2xpYi9wZW5kaW5nLW5hdmlnYXRpb24uanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvbGliL3BlbmRpbmctcmVxdWVzdC5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uLi93ZWJleHQtaW5zdHJ1bWVudGF0aW9uL2J1aWxkL21vZHVsZS9saWIvcGVuZGluZy1yZXNwb25zZS5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uLi93ZWJleHQtaW5zdHJ1bWVudGF0aW9uL2J1aWxkL21vZHVsZS9saWIvcmVzcG9uc2UtYm9keS1saXN0ZW5lci5qcyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC8uLi93ZWJleHQtaW5zdHJ1bWVudGF0aW9uL2J1aWxkL21vZHVsZS9saWIvc2hhMjU2LmpzIiwid2VicGFjazovL0BvcGVud3BtL3dlYmV4dC1maXJlZm94Ly4uL3dlYmV4dC1pbnN0cnVtZW50YXRpb24vYnVpbGQvbW9kdWxlL2xpYi9zdHJpbmctdXRpbHMuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvbGliL3V1aWQuanMiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi4vd2ViZXh0LWluc3RydW1lbnRhdGlvbi9idWlsZC9tb2R1bGUvc2NoZW1hLmpzIiwid2VicGFjazovL0BvcGVud3BtL3dlYmV4dC1maXJlZm94L3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL0BvcGVud3BtL3dlYmV4dC1maXJlZm94L3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9Ab3BlbndwbS93ZWJleHQtZmlyZWZveC93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL0BvcGVud3BtL3dlYmV4dC1maXJlZm94L3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vQG9wZW53cG0vd2ViZXh0LWZpcmVmb3gvLi9mZWF0dXJlLmpzL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1QkFBdUIscUJBQXFCO0FBQzVDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQ0FBbUM7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsK0RBQStEO0FBQy9EO0FBQ0EsMkNBQTJDO0FBQzNDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQjtBQUNsQixzQkFBc0I7QUFDdEIsd0JBQXdCO0FBQ3hCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUNuRDtBQUNBOztBQUVBO0FBQ0E7O0FBRUEiLCJmaWxlIjoiZmVhdHVyZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gIFdlIGNhcHR1cmUgdGhlIEpTIGNhbGxzdGFjayB3aGVuIHdlIGRldGVjdCBhIGR5bmFtaWNhbGx5IGNyZWF0ZWQgaHR0cCByZXF1ZXN0XG4gIGFuZCBidWJibGUgaXQgdXAgdmlhIGEgV2ViRXh0ZW5zaW9uIEV4cGVyaW1lbnQgQVBJIHN0YWNrRHVtcC5cbiAgVGhpcyBpbnN0cnVtZW50YXRpb24gY2FwdHVyZXMgdGhvc2UgYW5kIHNhdmVzIHRoZW0gdG8gdGhlIFwiY2FsbHN0YWNrc1wiIHRhYmxlLlxuKi9cbmV4cG9ydCBjbGFzcyBDYWxsc3RhY2tJbnN0cnVtZW50IHtcbiAgY29uc3RydWN0b3IoZGF0YVJlY2VpdmVyKSB7XG4gICAgdGhpcy5kYXRhUmVjZWl2ZXIgPSBkYXRhUmVjZWl2ZXI7XG4gIH1cbiAgcnVuKGJyb3dzZXJfaWQpIHtcbiAgICBicm93c2VyLnN0YWNrRHVtcC5vblN0YWNrQXZhaWxhYmxlLmFkZExpc3RlbmVyKChyZXF1ZXN0X2lkLCBjYWxsX3N0YWNrKSA9PiB7XG4gICAgICBjb25zdCByZWNvcmQgPSB7XG4gICAgICAgIGJyb3dzZXJfaWQsXG4gICAgICAgIHJlcXVlc3RfaWQsXG4gICAgICAgIGNhbGxfc3RhY2tcbiAgICAgIH07XG4gICAgICB0aGlzLmRhdGFSZWNlaXZlci5zYXZlUmVjb3JkKFwiY2FsbHN0YWNrc1wiLCByZWNvcmQpO1xuICAgIH0pO1xuICB9XG59IiwiaW1wb3J0ICogYXMgc29ja2V0IGZyb20gXCIuL3NvY2tldC5qc1wiO1xuXG5sZXQgY3Jhd2xJRCA9IG51bGw7XG5sZXQgdmlzaXRJRCA9IG51bGw7XG5sZXQgZGVidWdnaW5nID0gZmFsc2U7XG5sZXQgc3RvcmFnZUNvbnRyb2xsZXIgPSBudWxsO1xubGV0IGxvZ0FnZ3JlZ2F0b3IgPSBudWxsO1xubGV0IGxpc3RlbmluZ1NvY2tldCA9IG51bGw7XG5cblxubGV0IGxpc3RlbmluZ1NvY2tldENhbGxiYWNrID0gIGFzeW5jIChkYXRhKSA9PiB7XG4gICAgLy9UaGlzIHdvcmtzIGV2ZW4gaWYgZGF0YSBpcyBhbiBpbnRcbiAgICBsZXQgYWN0aW9uID0gZGF0YVtcImFjdGlvblwiXTtcbiAgICBsZXQgX3Zpc2l0SUQgPSBkYXRhW1widmlzaXRfaWRcIl1cbiAgICBzd2l0Y2ggKGFjdGlvbikge1xuICAgICAgICBjYXNlIFwiSW5pdGlhbGl6ZVwiOlxuICAgICAgICAgICAgaWYgKHZpc2l0SUQpIHtcbiAgICAgICAgICAgICAgICBsb2dXYXJuKFwiU2V0IHZpc2l0X2lkIHdoaWxlIGFub3RoZXIgdmlzaXRfaWQgd2FzIHNldFwiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmlzaXRJRCA9IF92aXNpdElEO1xuICAgICAgICAgICAgZGF0YVtcImJyb3dzZXJfaWRcIl0gPSBjcmF3bElEO1xuICAgICAgICAgICAgc3RvcmFnZUNvbnRyb2xsZXIuc2VuZChKU09OLnN0cmluZ2lmeShbXCJtZXRhX2luZm9ybWF0aW9uXCIsIGRhdGFdKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIkZpbmFsaXplXCI6XG4gICAgICAgICAgICBpZiAoIXZpc2l0SUQpIHtcbiAgICAgICAgICAgICAgICBsb2dXYXJuKFwiU2VuZCBGaW5hbGl6ZSB3aGlsZSBubyB2aXNpdF9pZCB3YXMgc2V0XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoX3Zpc2l0SUQgIT09IHZpc2l0SUQgKSB7XG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoXCJTZW5kIEZpbmFsaXplIGJ1dCB2aXNpdF9pZCBkaWRuJ3QgbWF0Y2guIFwiICtcbiAgICAgICAgICAgICAgICBgQ3VycmVudCB2aXNpdF9pZCAke3Zpc2l0X2lkfSwgc2VudCB2aXNpdF9pZCAke192aXNpdF9pZH0uYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkYXRhW1wiYnJvd3Nlcl9pZFwiXSA9IGNyYXdsSUQ7XG4gICAgICAgICAgICBkYXRhW1wic3VjY2Vzc1wiXSA9IHRydWU7XG4gICAgICAgICAgICBzdG9yYWdlQ29udHJvbGxlci5zZW5kKEpTT04uc3RyaW5naWZ5KFtcIm1ldGFfaW5mb3JtYXRpb25cIiwgZGF0YV0pKTtcbiAgICAgICAgICAgIHZpc2l0SUQgPSBudWxsO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAvLyBKdXN0IG1ha2luZyBzdXJlIHRoYXQgaXQncyBhIHZhbGlkIG51bWJlciBiZWZvcmUgbG9nZ2luZ1xuICAgICAgICAgICAgX3Zpc2l0SUQgPSBwYXJzZUludChkYXRhLCAxMCk7XG4gICAgICAgICAgICBsb2dEZWJ1ZyhcIlNldHRpbmcgdmlzaXRfaWQgdGhlIGxlZ2FjeSB3YXlcIik7XG4gICAgICAgICAgICB2aXNpdElEID0gX3Zpc2l0SURcblxuICAgIH1cblxufVxuZXhwb3J0IGxldCBvcGVuID0gYXN5bmMgZnVuY3Rpb24oc3RvcmFnZUNvbnRyb2xsZXJBZGRyZXNzLCBsb2dBZGRyZXNzLCBjdXJyX2NyYXdsSUQpIHtcbiAgICBpZiAoc3RvcmFnZUNvbnRyb2xsZXJBZGRyZXNzID09IG51bGwgJiYgbG9nQWRkcmVzcyA9PSBudWxsICYmIGN1cnJfY3Jhd2xJRCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkRlYnVnZ2luZywgZXZlcnl0aGluZyB3aWxsIG91dHB1dCB0byBjb25zb2xlXCIpO1xuICAgICAgICBkZWJ1Z2dpbmcgPSB0cnVlO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNyYXdsSUQgPSBjdXJyX2NyYXdsSUQ7XG5cbiAgICBjb25zb2xlLmxvZyhcIk9wZW5pbmcgc29ja2V0IGNvbm5lY3Rpb25zLi4uXCIpO1xuXG4gICAgLy8gQ29ubmVjdCB0byBNUExvZ2dlciBmb3IgZXh0ZW5zaW9uIGluZm8vZGVidWcvZXJyb3IgbG9nZ2luZ1xuICAgIGlmIChsb2dBZGRyZXNzICE9IG51bGwpIHtcbiAgICAgICAgbG9nQWdncmVnYXRvciA9IG5ldyBzb2NrZXQuU2VuZGluZ1NvY2tldCgpO1xuICAgICAgICBsZXQgcnYgPSBhd2FpdCBsb2dBZ2dyZWdhdG9yLmNvbm5lY3QobG9nQWRkcmVzc1swXSwgbG9nQWRkcmVzc1sxXSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9nU29ja2V0IHN0YXJ0ZWQ/XCIsIHJ2KVxuICAgIH1cblxuICAgIC8vIENvbm5lY3QgdG8gZGF0YWJhc2VzIGZvciBzYXZpbmcgZGF0YVxuICAgIGlmIChzdG9yYWdlQ29udHJvbGxlckFkZHJlc3MgIT0gbnVsbCkge1xuICAgICAgICBzdG9yYWdlQ29udHJvbGxlciA9IG5ldyBzb2NrZXQuU2VuZGluZ1NvY2tldCgpO1xuICAgICAgICBsZXQgcnYgPSBhd2FpdCBzdG9yYWdlQ29udHJvbGxlci5jb25uZWN0KHN0b3JhZ2VDb250cm9sbGVyQWRkcmVzc1swXSwgc3RvcmFnZUNvbnRyb2xsZXJBZGRyZXNzWzFdKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJTdG9yYWdlQ29udHJvbGxlciBzdGFydGVkP1wiLHJ2KTtcbiAgICB9XG5cbiAgICAvLyBMaXN0ZW4gZm9yIGluY29taW5nIHVybHMgYXMgdmlzaXQgaWRzXG4gICAgbGlzdGVuaW5nU29ja2V0ID0gbmV3IHNvY2tldC5MaXN0ZW5pbmdTb2NrZXQobGlzdGVuaW5nU29ja2V0Q2FsbGJhY2spO1xuICAgIGNvbnNvbGUubG9nKFwiU3RhcnRpbmcgc29ja2V0IGxpc3RlbmluZyBmb3IgaW5jb21pbmcgY29ubmVjdGlvbnMuXCIpO1xuICAgIGF3YWl0IGxpc3RlbmluZ1NvY2tldC5zdGFydExpc3RlbmluZygpLnRoZW4oKCkgPT4ge1xuICAgICAgICBicm93c2VyLnByb2ZpbGVEaXJJTy53cml0ZUZpbGUoXCJleHRlbnNpb25fcG9ydC50eHRcIiwgYCR7bGlzdGVuaW5nU29ja2V0LnBvcnR9YCk7XG4gICAgfSk7XG59O1xuXG5leHBvcnQgbGV0IGNsb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHN0b3JhZ2VDb250cm9sbGVyICE9IG51bGwpIHtcbiAgICAgICAgc3RvcmFnZUNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICB9XG4gICAgaWYgKGxvZ0FnZ3JlZ2F0b3IgIT0gbnVsbCkge1xuICAgICAgICBsb2dBZ2dyZWdhdG9yLmNsb3NlKCk7XG4gICAgfVxufTtcblxubGV0IG1ha2VMb2dKU09OID0gZnVuY3Rpb24obHZsLCBtc2cpIHtcbiAgICB2YXIgbG9nX2pzb24gPSB7XG4gICAgICAgICduYW1lJzogJ0V4dGVuc2lvbi1Mb2dnZXInLFxuICAgICAgICAnbGV2ZWwnOiBsdmwsXG4gICAgICAgICdwYXRobmFtZSc6ICdGaXJlZm94RXh0ZW5zaW9uJyxcbiAgICAgICAgJ2xpbmVubyc6IDEsXG4gICAgICAgICdtc2cnOiBlc2NhcGVTdHJpbmcobXNnKSxcbiAgICAgICAgJ2FyZ3MnOiBudWxsLFxuICAgICAgICAnZXhjX2luZm8nOiBudWxsLFxuICAgICAgICAnZnVuYyc6IG51bGxcbiAgICB9XG4gICAgcmV0dXJuIGxvZ19qc29uO1xufVxuXG5leHBvcnQgbGV0IGxvZ0luZm8gPSBmdW5jdGlvbihtc2cpIHtcbiAgICAvLyBBbHdheXMgbG9nIHRvIGJyb3dzZXIgY29uc29sZVxuICAgIGNvbnNvbGUubG9nKG1zZyk7XG5cbiAgICBpZiAoZGVidWdnaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBMb2cgbGV2ZWwgSU5GTyA9PSAyMCAoaHR0cHM6Ly9kb2NzLnB5dGhvbi5vcmcvMi9saWJyYXJ5L2xvZ2dpbmcuaHRtbCNsb2dnaW5nLWxldmVscylcbiAgICB2YXIgbG9nX2pzb24gPSBtYWtlTG9nSlNPTigyMCwgbXNnKTtcbiAgICBsb2dBZ2dyZWdhdG9yLnNlbmQoSlNPTi5zdHJpbmdpZnkoWydFWFQnLCBKU09OLnN0cmluZ2lmeShsb2dfanNvbildKSk7XG59O1xuXG5leHBvcnQgbGV0IGxvZ0RlYnVnID0gZnVuY3Rpb24obXNnKSB7XG4gICAgLy8gQWx3YXlzIGxvZyB0byBicm93c2VyIGNvbnNvbGVcbiAgICBjb25zb2xlLmxvZyhtc2cpO1xuXG4gICAgaWYgKGRlYnVnZ2luZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gTG9nIGxldmVsIERFQlVHID09IDEwIChodHRwczovL2RvY3MucHl0aG9uLm9yZy8yL2xpYnJhcnkvbG9nZ2luZy5odG1sI2xvZ2dpbmctbGV2ZWxzKVxuICAgIHZhciBsb2dfanNvbiA9IG1ha2VMb2dKU09OKDEwLCBtc2cpO1xuICAgIGxvZ0FnZ3JlZ2F0b3Iuc2VuZChKU09OLnN0cmluZ2lmeShbJ0VYVCcsIEpTT04uc3RyaW5naWZ5KGxvZ19qc29uKV0pKTtcbn07XG5cbmV4cG9ydCBsZXQgbG9nV2FybiA9IGZ1bmN0aW9uKG1zZykge1xuICAgIC8vIEFsd2F5cyBsb2cgdG8gYnJvd3NlciBjb25zb2xlXG4gICAgY29uc29sZS53YXJuKG1zZyk7XG5cbiAgICBpZiAoZGVidWdnaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBMb2cgbGV2ZWwgV0FSTiA9PSAzMCAoaHR0cHM6Ly9kb2NzLnB5dGhvbi5vcmcvMi9saWJyYXJ5L2xvZ2dpbmcuaHRtbCNsb2dnaW5nLWxldmVscylcbiAgICB2YXIgbG9nX2pzb24gPSBtYWtlTG9nSlNPTigzMCwgbXNnKTtcbiAgICBsb2dBZ2dyZWdhdG9yLnNlbmQoSlNPTi5zdHJpbmdpZnkoWydFWFQnLCBKU09OLnN0cmluZ2lmeShsb2dfanNvbildKSk7XG59O1xuXG5leHBvcnQgbGV0IGxvZ0Vycm9yID0gZnVuY3Rpb24obXNnKSB7XG4gICAgLy8gQWx3YXlzIGxvZyB0byBicm93c2VyIGNvbnNvbGVcbiAgICBjb25zb2xlLmVycm9yKG1zZyk7XG5cbiAgICBpZiAoZGVidWdnaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBMb2cgbGV2ZWwgSU5GTyA9PSA0MCAoaHR0cHM6Ly9kb2NzLnB5dGhvbi5vcmcvMi9saWJyYXJ5L2xvZ2dpbmcuaHRtbCNsb2dnaW5nLWxldmVscylcbiAgICB2YXIgbG9nX2pzb24gPSBtYWtlTG9nSlNPTig0MCwgbXNnKTtcbiAgICBsb2dBZ2dyZWdhdG9yLnNlbmQoSlNPTi5zdHJpbmdpZnkoWydFWFQnLCBKU09OLnN0cmluZ2lmeShsb2dfanNvbildKSk7XG59O1xuXG5leHBvcnQgbGV0IGxvZ0NyaXRpY2FsID0gZnVuY3Rpb24obXNnKSB7XG4gICAgLy8gQWx3YXlzIGxvZyB0byBicm93c2VyIGNvbnNvbGVcbiAgICBjb25zb2xlLmVycm9yKG1zZyk7XG5cbiAgICBpZiAoZGVidWdnaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBMb2cgbGV2ZWwgQ1JJVElDQUwgPT0gNTAgKGh0dHBzOi8vZG9jcy5weXRob24ub3JnLzIvbGlicmFyeS9sb2dnaW5nLmh0bWwjbG9nZ2luZy1sZXZlbHMpXG4gICAgdmFyIGxvZ19qc29uID0gbWFrZUxvZ0pTT04oNTAsIG1zZyk7XG4gICAgbG9nQWdncmVnYXRvci5zZW5kKEpTT04uc3RyaW5naWZ5KFsnRVhUJywgSlNPTi5zdHJpbmdpZnkobG9nX2pzb24pXSkpO1xufTtcblxuZXhwb3J0IGxldCBkYXRhUmVjZWl2ZXIgPSB7XG4gICAgc2F2ZVJlY29yZChhLCBiKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGIpO1xuICAgIH0sXG59O1xuXG5leHBvcnQgbGV0IHNhdmVSZWNvcmQgPSBmdW5jdGlvbihpbnN0cnVtZW50LCByZWNvcmQpIHtcbiAgICByZWNvcmRbXCJ2aXNpdF9pZFwiXSA9IHZpc2l0SUQ7XG5cbiAgICBpZiAoIXZpc2l0SUQgJiYgIWRlYnVnZ2luZykge1xuICAgICAgICAvLyBOYXZpZ2F0aW9ucyB0byBhYm91dDpibGFuayBjYW4gYmUgdHJpZ2dlcmVkIGJ5IE9wZW5XUE0uIFdlIGRyb3AgdGhvc2UuXG4gICAgICAgIGlmKGluc3RydW1lbnQgPT09ICduYXZpZ2F0aW9ucycgJiYgcmVjb3JkWyd1cmwnXSA9PT0gJ2Fib3V0OmJsYW5rJykge1xuICAgICAgICAgICAgbG9nRGVidWcoJ0V4dGVuc2lvbi0nICsgY3Jhd2xJRCArICcgOiBEcm9wcGluZyBuYXZpZ2F0aW9uIHRvIGFib3V0OmJsYW5rIGluIGludGVybWVkaWF0ZSBwZXJpb2QnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsb2dXYXJuKGBFeHRlbnNpb24tJHtjcmF3bElEfSA6IHZpc2l0SUQgaXMgbnVsbCB3aGlsZSBhdHRlbXB0aW5nIHRvIGluc2VydCBpbnRvIHRhYmxlICR7aW5zdHJ1bWVudH1cXG5gICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkocmVjb3JkKSk7XG4gICAgICAgIHJlY29yZFtcInZpc2l0X2lkXCJdID0gLTE7XG4gICAgICAgIFxuICAgIH1cblxuICAgIC8vIHNlbmQgdG8gY29uc29sZSBpZiBkZWJ1Z2dpbmdcbiAgICBpZiAoZGVidWdnaW5nKSB7XG4gICAgICBjb25zb2xlLmxvZyhcIkVYVEVOU0lPTlwiLCBpbnN0cnVtZW50LCByZWNvcmQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzdG9yYWdlQ29udHJvbGxlci5zZW5kKEpTT04uc3RyaW5naWZ5KFtpbnN0cnVtZW50LCByZWNvcmRdKSk7XG59O1xuXG4vLyBTdHViIGZvciBub3dcbmV4cG9ydCBsZXQgc2F2ZUNvbnRlbnQgPSBhc3luYyBmdW5jdGlvbihjb250ZW50LCBjb250ZW50SGFzaCkge1xuICAvLyBTZW5kIHBhZ2UgY29udGVudCB0byB0aGUgZGF0YSBhZ2dyZWdhdG9yXG4gIC8vIGRlZHVwbGljYXRlZCBieSBjb250ZW50SGFzaCBpbiBhIGxldmVsREIgZGF0YWJhc2VcbiAgaWYgKGRlYnVnZ2luZykge1xuICAgIGNvbnNvbGUubG9nKFwiTERCIGNvbnRlbnRIYXNoOlwiLGNvbnRlbnRIYXNoLFwid2l0aCBsZW5ndGhcIixjb250ZW50Lmxlbmd0aCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIFNpbmNlIHRoZSBjb250ZW50IG1pZ2h0IG5vdCBiZSBhIHZhbGlkIHV0Zjggc3RyaW5nIGFuZCBpdCBuZWVkcyB0byBiZVxuICAvLyBqc29uIGVuY29kZWQgbGF0ZXIsIGl0IGlzIGVuY29kZWQgdXNpbmcgYmFzZTY0IGZpcnN0LlxuICBjb25zdCBiNjQgPSBVaW50OFRvQmFzZTY0KGNvbnRlbnQpO1xuICBzdG9yYWdlQ29udHJvbGxlci5zZW5kKEpTT04uc3RyaW5naWZ5KFsncGFnZV9jb250ZW50JywgW2I2NCwgY29udGVudEhhc2hdXSkpO1xufTtcblxuZnVuY3Rpb24gZW5jb2RlX3V0Zjgocykge1xuICByZXR1cm4gdW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHMpKTtcbn1cblxuLy8gQmFzZTY0IGVuY29kaW5nLCBmb3VuZCBvbjpcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzEyNzEwMDAxL2hvdy10by1jb252ZXJ0LXVpbnQ4LWFycmF5LXRvLWJhc2U2NC1lbmNvZGVkLXN0cmluZy8yNTY0NDQwOSMyNTY0NDQwOVxuZnVuY3Rpb24gVWludDhUb0Jhc2U2NCh1OEFycil7XG4gIHZhciBDSFVOS19TSVpFID0gMHg4MDAwOyAvL2FyYml0cmFyeSBudW1iZXJcbiAgdmFyIGluZGV4ID0gMDtcbiAgdmFyIGxlbmd0aCA9IHU4QXJyLmxlbmd0aDtcbiAgdmFyIHJlc3VsdCA9ICcnO1xuICB2YXIgc2xpY2U7XG4gIHdoaWxlIChpbmRleCA8IGxlbmd0aCkge1xuICAgIHNsaWNlID0gdThBcnIuc3ViYXJyYXkoaW5kZXgsIE1hdGgubWluKGluZGV4ICsgQ0hVTktfU0laRSwgbGVuZ3RoKSk7XG4gICAgcmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgc2xpY2UpO1xuICAgIGluZGV4ICs9IENIVU5LX1NJWkU7XG4gIH1cbiAgcmV0dXJuIGJ0b2EocmVzdWx0KTtcbn1cblxuZXhwb3J0IGxldCBlc2NhcGVTdHJpbmcgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAvLyBDb252ZXJ0IHRvIHN0cmluZyBpZiBuZWNlc3NhcnlcbiAgICBpZih0eXBlb2Ygc3RyaW5nICE9IFwic3RyaW5nXCIpXG4gICAgICAgIHN0cmluZyA9IFwiXCIgKyBzdHJpbmc7XG5cbiAgICByZXR1cm4gZW5jb2RlX3V0Zjgoc3RyaW5nKTtcbn07XG5cbmV4cG9ydCBsZXQgYm9vbFRvSW50ID0gZnVuY3Rpb24oYm9vbCkge1xuICAgIHJldHVybiBib29sID8gMSA6IDA7XG59O1xuIiwibGV0IERhdGFSZWNlaXZlciA9IHtcbiAgY2FsbGJhY2tzOiBuZXcgTWFwKCksXG4gIG9uRGF0YVJlY2VpdmVkOiAoYVNvY2tldElkLCBhRGF0YSwgYUpTT04pID0+IHtcbiAgICBpZiAoIURhdGFSZWNlaXZlci5jYWxsYmFja3MuaGFzKGFTb2NrZXRJZCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGFKU09OKSB7XG4gICAgICBhRGF0YSA9IEpTT04ucGFyc2UoYURhdGEpO1xuICAgIH1cbiAgICBEYXRhUmVjZWl2ZXIuY2FsbGJhY2tzLmdldChhU29ja2V0SWQpKGFEYXRhKTtcbiAgfSxcbn07XG5cbmJyb3dzZXIuc29ja2V0cy5vbkRhdGFSZWNlaXZlZC5hZGRMaXN0ZW5lcihEYXRhUmVjZWl2ZXIub25EYXRhUmVjZWl2ZWQpO1xuXG5sZXQgTGlzdGVuaW5nU29ja2V0cyA9IG5ldyBNYXAoKTtcblxuZXhwb3J0IGNsYXNzIExpc3RlbmluZ1NvY2tldCB7XG4gIGNvbnN0cnVjdG9yKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrXG4gIH1cblxuICBhc3luYyBzdGFydExpc3RlbmluZygpIHtcbiAgICB0aGlzLnBvcnQgPSBhd2FpdCBicm93c2VyLnNvY2tldHMuY3JlYXRlU2VydmVyU29ja2V0KCk7XG4gICAgRGF0YVJlY2VpdmVyLmNhbGxiYWNrcy5zZXQodGhpcy5wb3J0LCB0aGlzLmNhbGxiYWNrKTtcbiAgICBicm93c2VyLnNvY2tldHMuc3RhcnRMaXN0ZW5pbmcodGhpcy5wb3J0KTtcbiAgICBjb25zb2xlLmxvZygnTGlzdGVuaW5nIG9uIHBvcnQgJyArIHRoaXMucG9ydCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFNlbmRpbmdTb2NrZXQge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxuXG4gIGFzeW5jIGNvbm5lY3QoaG9zdCwgcG9ydCkge1xuICAgIHRoaXMuaWQgPSBhd2FpdCBicm93c2VyLnNvY2tldHMuY3JlYXRlU2VuZGluZ1NvY2tldCgpO1xuICAgIGJyb3dzZXIuc29ja2V0cy5jb25uZWN0KHRoaXMuaWQsIGhvc3QsIHBvcnQpO1xuICAgIGNvbnNvbGUubG9nKGBDb25uZWN0ZWQgdG8gJHtob3N0fToke3BvcnR9YCk7XG4gIH1cblxuICBzZW5kKGFEYXRhLCBhSlNPTj10cnVlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGJyb3dzZXIuc29ja2V0cy5zZW5kRGF0YSh0aGlzLmlkLCBhRGF0YSwgISFhSlNPTik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLGVyci5tZXNzYWdlKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBjbG9zZSgpIHtcbiAgICBicm93c2VyLnNvY2tldHMuY2xvc2UodGhpcy5pZCk7XG4gIH1cbn1cblxuIiwiaW1wb3J0IHsgaW5jcmVtZW50ZWRFdmVudE9yZGluYWwgfSBmcm9tIFwiLi4vbGliL2V4dGVuc2lvbi1zZXNzaW9uLWV2ZW50LW9yZGluYWxcIjtcbmltcG9ydCB7IGV4dGVuc2lvblNlc3Npb25VdWlkIH0gZnJvbSBcIi4uL2xpYi9leHRlbnNpb24tc2Vzc2lvbi11dWlkXCI7XG5pbXBvcnQgeyBib29sVG9JbnQsIGVzY2FwZVN0cmluZyB9IGZyb20gXCIuLi9saWIvc3RyaW5nLXV0aWxzXCI7XG5leHBvcnQgY29uc3QgdHJhbnNmb3JtQ29va2llT2JqZWN0VG9NYXRjaE9wZW5XUE1TY2hlbWEgPSAoY29va2llKSA9PiB7XG4gICAgY29uc3QgamF2YXNjcmlwdENvb2tpZSA9IHt9O1xuICAgIC8vIEV4cGlyeSB0aW1lIChpbiBzZWNvbmRzKVxuICAgIC8vIE1heSByZXR1cm4gfk1heChpbnQ2NCkuIEkgYmVsaWV2ZSB0aGlzIGlzIGEgc2Vzc2lvblxuICAgIC8vIGNvb2tpZSB3aGljaCBkb2Vzbid0IGV4cGlyZS4gU2Vzc2lvbnMgY29va2llcyB3aXRoXG4gICAgLy8gbm9uLW1heCBleHBpcnkgdGltZSBleHBpcmUgYWZ0ZXIgc2Vzc2lvbiBvciBhdCBleHBpcnkuXG4gICAgY29uc3QgZXhwaXJ5VGltZSA9IGNvb2tpZS5leHBpcmF0aW9uRGF0ZTsgLy8gcmV0dXJucyBzZWNvbmRzXG4gICAgbGV0IGV4cGlyeVRpbWVTdHJpbmc7XG4gICAgY29uc3QgbWF4SW50NjQgPSA5MjIzMzcyMDM2ODU0Nzc2MDAwO1xuICAgIGlmICghY29va2llLmV4cGlyYXRpb25EYXRlIHx8IGV4cGlyeVRpbWUgPT09IG1heEludDY0KSB7XG4gICAgICAgIGV4cGlyeVRpbWVTdHJpbmcgPSBcIjk5OTktMTItMzFUMjE6NTk6NTkuMDAwWlwiO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY29uc3QgZXhwaXJ5VGltZURhdGUgPSBuZXcgRGF0ZShleHBpcnlUaW1lICogMTAwMCk7IC8vIHJlcXVpcmVzIG1pbGxpc2Vjb25kc1xuICAgICAgICBleHBpcnlUaW1lU3RyaW5nID0gZXhwaXJ5VGltZURhdGUudG9JU09TdHJpbmcoKTtcbiAgICB9XG4gICAgamF2YXNjcmlwdENvb2tpZS5leHBpcnkgPSBleHBpcnlUaW1lU3RyaW5nO1xuICAgIGphdmFzY3JpcHRDb29raWUuaXNfaHR0cF9vbmx5ID0gYm9vbFRvSW50KGNvb2tpZS5odHRwT25seSk7XG4gICAgamF2YXNjcmlwdENvb2tpZS5pc19ob3N0X29ubHkgPSBib29sVG9JbnQoY29va2llLmhvc3RPbmx5KTtcbiAgICBqYXZhc2NyaXB0Q29va2llLmlzX3Nlc3Npb24gPSBib29sVG9JbnQoY29va2llLnNlc3Npb24pO1xuICAgIGphdmFzY3JpcHRDb29raWUuaG9zdCA9IGVzY2FwZVN0cmluZyhjb29raWUuZG9tYWluKTtcbiAgICBqYXZhc2NyaXB0Q29va2llLmlzX3NlY3VyZSA9IGJvb2xUb0ludChjb29raWUuc2VjdXJlKTtcbiAgICBqYXZhc2NyaXB0Q29va2llLm5hbWUgPSBlc2NhcGVTdHJpbmcoY29va2llLm5hbWUpO1xuICAgIGphdmFzY3JpcHRDb29raWUucGF0aCA9IGVzY2FwZVN0cmluZyhjb29raWUucGF0aCk7XG4gICAgamF2YXNjcmlwdENvb2tpZS52YWx1ZSA9IGVzY2FwZVN0cmluZyhjb29raWUudmFsdWUpO1xuICAgIGphdmFzY3JpcHRDb29raWUuc2FtZV9zaXRlID0gZXNjYXBlU3RyaW5nKGNvb2tpZS5zYW1lU2l0ZSk7XG4gICAgamF2YXNjcmlwdENvb2tpZS5maXJzdF9wYXJ0eV9kb21haW4gPSBlc2NhcGVTdHJpbmcoY29va2llLmZpcnN0UGFydHlEb21haW4pO1xuICAgIGphdmFzY3JpcHRDb29raWUuc3RvcmVfaWQgPSBlc2NhcGVTdHJpbmcoY29va2llLnN0b3JlSWQpO1xuICAgIGphdmFzY3JpcHRDb29raWUudGltZV9zdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICByZXR1cm4gamF2YXNjcmlwdENvb2tpZTtcbn07XG5leHBvcnQgY2xhc3MgQ29va2llSW5zdHJ1bWVudCB7XG4gICAgZGF0YVJlY2VpdmVyO1xuICAgIG9uQ2hhbmdlZExpc3RlbmVyO1xuICAgIGNvbnN0cnVjdG9yKGRhdGFSZWNlaXZlcikge1xuICAgICAgICB0aGlzLmRhdGFSZWNlaXZlciA9IGRhdGFSZWNlaXZlcjtcbiAgICB9XG4gICAgcnVuKGNyYXdsSUQpIHtcbiAgICAgICAgLy8gSW5zdHJ1bWVudCBjb29raWUgY2hhbmdlc1xuICAgICAgICB0aGlzLm9uQ2hhbmdlZExpc3RlbmVyID0gYXN5bmMgKGNoYW5nZUluZm8pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50VHlwZSA9IGNoYW5nZUluZm8ucmVtb3ZlZCA/IFwiZGVsZXRlZFwiIDogXCJhZGRlZC1vci1jaGFuZ2VkXCI7XG4gICAgICAgICAgICBjb25zdCB1cGRhdGUgPSB7XG4gICAgICAgICAgICAgICAgcmVjb3JkX3R5cGU6IGV2ZW50VHlwZSxcbiAgICAgICAgICAgICAgICBjaGFuZ2VfY2F1c2U6IGNoYW5nZUluZm8uY2F1c2UsXG4gICAgICAgICAgICAgICAgYnJvd3Nlcl9pZDogY3Jhd2xJRCxcbiAgICAgICAgICAgICAgICBleHRlbnNpb25fc2Vzc2lvbl91dWlkOiBleHRlbnNpb25TZXNzaW9uVXVpZCxcbiAgICAgICAgICAgICAgICBldmVudF9vcmRpbmFsOiBpbmNyZW1lbnRlZEV2ZW50T3JkaW5hbCgpLFxuICAgICAgICAgICAgICAgIC4uLnRyYW5zZm9ybUNvb2tpZU9iamVjdFRvTWF0Y2hPcGVuV1BNU2NoZW1hKGNoYW5nZUluZm8uY29va2llKSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLmRhdGFSZWNlaXZlci5zYXZlUmVjb3JkKFwiamF2YXNjcmlwdF9jb29raWVzXCIsIHVwZGF0ZSk7XG4gICAgICAgIH07XG4gICAgICAgIGJyb3dzZXIuY29va2llcy5vbkNoYW5nZWQuYWRkTGlzdGVuZXIodGhpcy5vbkNoYW5nZWRMaXN0ZW5lcik7XG4gICAgfVxuICAgIGFzeW5jIHNhdmVBbGxDb29raWVzKGNyYXdsSUQpIHtcbiAgICAgICAgY29uc3QgYWxsQ29va2llcyA9IGF3YWl0IGJyb3dzZXIuY29va2llcy5nZXRBbGwoe30pO1xuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChhbGxDb29raWVzLm1hcCgoY29va2llKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB1cGRhdGUgPSB7XG4gICAgICAgICAgICAgICAgcmVjb3JkX3R5cGU6IFwibWFudWFsLWV4cG9ydFwiLFxuICAgICAgICAgICAgICAgIGJyb3dzZXJfaWQ6IGNyYXdsSUQsXG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9uX3Nlc3Npb25fdXVpZDogZXh0ZW5zaW9uU2Vzc2lvblV1aWQsXG4gICAgICAgICAgICAgICAgLi4udHJhbnNmb3JtQ29va2llT2JqZWN0VG9NYXRjaE9wZW5XUE1TY2hlbWEoY29va2llKSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZVJlY29yZChcImphdmFzY3JpcHRfY29va2llc1wiLCB1cGRhdGUpO1xuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGNsZWFudXAoKSB7XG4gICAgICAgIGlmICh0aGlzLm9uQ2hhbmdlZExpc3RlbmVyKSB7XG4gICAgICAgICAgICBicm93c2VyLmNvb2tpZXMub25DaGFuZ2VkLnJlbW92ZUxpc3RlbmVyKHRoaXMub25DaGFuZ2VkTGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pWTI5dmEybGxMV2x1YzNSeWRXMWxiblF1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sY3lJNld5SXVMaTh1TGk4dUxpOXpjbU12WW1GamEyZHliM1Z1WkM5amIyOXJhV1V0YVc1emRISjFiV1Z1ZEM1MGN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkJRU3hQUVVGUExFVkJRVU1zZFVKQlFYVkNMRVZCUVVNc1RVRkJUU3gzUTBGQmQwTXNRMEZCUXp0QlFVTXZSU3hQUVVGUExFVkJRVU1zYjBKQlFXOUNMRVZCUVVNc1RVRkJUU3dyUWtGQkswSXNRMEZCUXp0QlFVTnVSU3hQUVVGUExFVkJRVU1zVTBGQlV5eEZRVUZGTEZsQlFWa3NSVUZCUXl4TlFVRk5MSEZDUVVGeFFpeERRVUZETzBGQlN6VkVMRTFCUVUwc1EwRkJReXhOUVVGTkxIbERRVUY1UXl4SFFVRkhMRU5CUVVNc1RVRkJZeXhGUVVGRkxFVkJRVVU3U1VGRE1VVXNUVUZCVFN4blFrRkJaMElzUjBGQlJ5eEZRVUZ6UWl4RFFVRkRPMGxCUldoRUxESkNRVUV5UWp0SlFVTXpRaXh6UkVGQmMwUTdTVUZEZEVRc2NVUkJRWEZFTzBsQlEzSkVMSGxFUVVGNVJEdEpRVU42UkN4TlFVRk5MRlZCUVZVc1IwRkJSeXhOUVVGTkxFTkJRVU1zWTBGQll5eERRVUZETEVOQlFVTXNhMEpCUVd0Q08wbEJRelZFTEVsQlFVa3NaMEpCUVdkQ0xFTkJRVU03U1VGRGNrSXNUVUZCVFN4UlFVRlJMRWRCUVVjc2JVSkJRVzFDTEVOQlFVTTdTVUZEY2tNc1NVRkJTU3hEUVVGRExFMUJRVTBzUTBGQlF5eGpRVUZqTEVsQlFVa3NWVUZCVlN4TFFVRkxMRkZCUVZFc1JVRkJSVHRSUVVOeVJDeG5Ra0ZCWjBJc1IwRkJSeXd3UWtGQk1FSXNRMEZCUXp0TFFVTXZRenRUUVVGTk8xRkJRMHdzVFVGQlRTeGpRVUZqTEVkQlFVY3NTVUZCU1N4SlFVRkpMRU5CUVVNc1ZVRkJWU3hIUVVGSExFbEJRVWtzUTBGQlF5eERRVUZETEVOQlFVTXNkMEpCUVhkQ08xRkJRelZGTEdkQ1FVRm5RaXhIUVVGSExHTkJRV01zUTBGQlF5eFhRVUZYTEVWQlFVVXNRMEZCUXp0TFFVTnFSRHRKUVVORUxHZENRVUZuUWl4RFFVRkRMRTFCUVUwc1IwRkJSeXhuUWtGQlowSXNRMEZCUXp0SlFVTXpReXhuUWtGQlowSXNRMEZCUXl4WlFVRlpMRWRCUVVjc1UwRkJVeXhEUVVGRExFMUJRVTBzUTBGQlF5eFJRVUZSTEVOQlFVTXNRMEZCUXp0SlFVTXpSQ3huUWtGQlowSXNRMEZCUXl4WlFVRlpMRWRCUVVjc1UwRkJVeXhEUVVGRExFMUJRVTBzUTBGQlF5eFJRVUZSTEVOQlFVTXNRMEZCUXp0SlFVTXpSQ3huUWtGQlowSXNRMEZCUXl4VlFVRlZMRWRCUVVjc1UwRkJVeXhEUVVGRExFMUJRVTBzUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXp0SlFVVjRSQ3huUWtGQlowSXNRMEZCUXl4SlFVRkpMRWRCUVVjc1dVRkJXU3hEUVVGRExFMUJRVTBzUTBGQlF5eE5RVUZOTEVOQlFVTXNRMEZCUXp0SlFVTndSQ3huUWtGQlowSXNRMEZCUXl4VFFVRlRMRWRCUVVjc1UwRkJVeXhEUVVGRExFMUJRVTBzUTBGQlF5eE5RVUZOTEVOQlFVTXNRMEZCUXp0SlFVTjBSQ3huUWtGQlowSXNRMEZCUXl4SlFVRkpMRWRCUVVjc1dVRkJXU3hEUVVGRExFMUJRVTBzUTBGQlF5eEpRVUZKTEVOQlFVTXNRMEZCUXp0SlFVTnNSQ3huUWtGQlowSXNRMEZCUXl4SlFVRkpMRWRCUVVjc1dVRkJXU3hEUVVGRExFMUJRVTBzUTBGQlF5eEpRVUZKTEVOQlFVTXNRMEZCUXp0SlFVTnNSQ3huUWtGQlowSXNRMEZCUXl4TFFVRkxMRWRCUVVjc1dVRkJXU3hEUVVGRExFMUJRVTBzUTBGQlF5eExRVUZMTEVOQlFVTXNRMEZCUXp0SlFVTndSQ3huUWtGQlowSXNRMEZCUXl4VFFVRlRMRWRCUVVjc1dVRkJXU3hEUVVGRExFMUJRVTBzUTBGQlF5eFJRVUZSTEVOQlFVTXNRMEZCUXp0SlFVTXpSQ3huUWtGQlowSXNRMEZCUXl4clFrRkJhMElzUjBGQlJ5eFpRVUZaTEVOQlFVTXNUVUZCVFN4RFFVRkRMR2RDUVVGblFpeERRVUZETEVOQlFVTTdTVUZETlVVc1owSkJRV2RDTEVOQlFVTXNVVUZCVVN4SFFVRkhMRmxCUVZrc1EwRkJReXhOUVVGTkxFTkJRVU1zVDBGQlR5eERRVUZETEVOQlFVTTdTVUZGZWtRc1owSkJRV2RDTEVOQlFVTXNWVUZCVlN4SFFVRkhMRWxCUVVrc1NVRkJTU3hGUVVGRkxFTkJRVU1zVjBGQlZ5eEZRVUZGTEVOQlFVTTdTVUZGZGtRc1QwRkJUeXhuUWtGQlowSXNRMEZCUXp0QlFVTXhRaXhEUVVGRExFTkJRVU03UVVGRlJpeE5RVUZOTEU5QlFVOHNaMEpCUVdkQ08wbEJRMVlzV1VGQldTeERRVUZETzBsQlEzUkNMR2xDUVVGcFFpeERRVUZETzBsQlJURkNMRmxCUVZrc1dVRkJXVHRSUVVOMFFpeEpRVUZKTEVOQlFVTXNXVUZCV1N4SFFVRkhMRmxCUVZrc1EwRkJRenRKUVVOdVF5eERRVUZETzBsQlJVMHNSMEZCUnl4RFFVRkRMRTlCUVU4N1VVRkRhRUlzTkVKQlFUUkNPMUZCUXpWQ0xFbEJRVWtzUTBGQlF5eHBRa0ZCYVVJc1IwRkJSeXhMUVVGTExFVkJRVVVzVlVGUEwwSXNSVUZCUlN4RlFVRkZPMWxCUTBnc1RVRkJUU3hUUVVGVExFZEJRVWNzVlVGQlZTeERRVUZETEU5QlFVOHNRMEZCUXl4RFFVRkRMRU5CUVVNc1UwRkJVeXhEUVVGRExFTkJRVU1zUTBGQlF5eHJRa0ZCYTBJc1EwRkJRenRaUVVOMFJTeE5RVUZOTEUxQlFVMHNSMEZCTWtJN1owSkJRM0pETEZkQlFWY3NSVUZCUlN4VFFVRlRPMmRDUVVOMFFpeFpRVUZaTEVWQlFVVXNWVUZCVlN4RFFVRkRMRXRCUVVzN1owSkJRemxDTEZWQlFWVXNSVUZCUlN4UFFVRlBPMmRDUVVOdVFpeHpRa0ZCYzBJc1JVRkJSU3h2UWtGQmIwSTdaMEpCUXpWRExHRkJRV0VzUlVGQlJTeDFRa0ZCZFVJc1JVRkJSVHRuUWtGRGVFTXNSMEZCUnl4NVEwRkJlVU1zUTBGQlF5eFZRVUZWTEVOQlFVTXNUVUZCVFN4RFFVRkRPMkZCUTJoRkxFTkJRVU03V1VGRFJpeEpRVUZKTEVOQlFVTXNXVUZCV1N4RFFVRkRMRlZCUVZVc1EwRkJReXh2UWtGQmIwSXNSVUZCUlN4TlFVRk5MRU5CUVVNc1EwRkJRenRSUVVNM1JDeERRVUZETEVOQlFVTTdVVUZEUml4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExGTkJRVk1zUTBGQlF5eFhRVUZYTEVOQlFVTXNTVUZCU1N4RFFVRkRMR2xDUVVGcFFpeERRVUZETEVOQlFVTTdTVUZEYUVVc1EwRkJRenRKUVVWTkxFdEJRVXNzUTBGQlF5eGpRVUZqTEVOQlFVTXNUMEZCVHp0UlFVTnFReXhOUVVGTkxGVkJRVlVzUjBGQlJ5eE5RVUZOTEU5QlFVOHNRMEZCUXl4UFFVRlBMRU5CUVVNc1RVRkJUU3hEUVVGRExFVkJRVVVzUTBGQlF5eERRVUZETzFGQlEzQkVMRTFCUVUwc1QwRkJUeXhEUVVGRExFZEJRVWNzUTBGRFppeFZRVUZWTEVOQlFVTXNSMEZCUnl4RFFVRkRMRU5CUVVNc1RVRkJZeXhGUVVGRkxFVkJRVVU3V1VGRGFFTXNUVUZCVFN4TlFVRk5MRWRCUVRKQ08yZENRVU55UXl4WFFVRlhMRVZCUVVVc1pVRkJaVHRuUWtGRE5VSXNWVUZCVlN4RlFVRkZMRTlCUVU4N1owSkJRMjVDTEhOQ1FVRnpRaXhGUVVGRkxHOUNRVUZ2UWp0blFrRkROVU1zUjBGQlJ5eDVRMEZCZVVNc1EwRkJReXhOUVVGTkxFTkJRVU03WVVGRGNrUXNRMEZCUXp0WlFVTkdMRTlCUVU4c1NVRkJTU3hEUVVGRExGbEJRVmtzUTBGQlF5eFZRVUZWTEVOQlFVTXNiMEpCUVc5Q0xFVkJRVVVzVFVGQlRTeERRVUZETEVOQlFVTTdVVUZEY0VVc1EwRkJReXhEUVVGRExFTkJRMGdzUTBGQlF6dEpRVU5LTEVOQlFVTTdTVUZGVFN4UFFVRlBPMUZCUTFvc1NVRkJTU3hKUVVGSkxFTkJRVU1zYVVKQlFXbENMRVZCUVVVN1dVRkRNVUlzVDBGQlR5eERRVUZETEU5QlFVOHNRMEZCUXl4VFFVRlRMRU5CUVVNc1kwRkJZeXhEUVVGRExFbEJRVWtzUTBGQlF5eHBRa0ZCYVVJc1EwRkJReXhEUVVGRE8xTkJRMnhGTzBsQlEwZ3NRMEZCUXp0RFFVTkdJbjA9IiwiaW1wb3J0IHsgUGVuZGluZ1Jlc3BvbnNlIH0gZnJvbSBcIi4uL2xpYi9wZW5kaW5nLXJlc3BvbnNlXCI7XG5pbXBvcnQgeyBhbGxUeXBlcyB9IGZyb20gXCIuL2h0dHAtaW5zdHJ1bWVudFwiO1xuZXhwb3J0IGNsYXNzIERuc0luc3RydW1lbnQge1xuICAgIGRhdGFSZWNlaXZlcjtcbiAgICBvbkNvbXBsZXRlTGlzdGVuZXI7XG4gICAgcGVuZGluZ1Jlc3BvbnNlcyA9IHt9O1xuICAgIGNvbnN0cnVjdG9yKGRhdGFSZWNlaXZlcikge1xuICAgICAgICB0aGlzLmRhdGFSZWNlaXZlciA9IGRhdGFSZWNlaXZlcjtcbiAgICB9XG4gICAgcnVuKGNyYXdsSUQpIHtcbiAgICAgICAgY29uc3QgZmlsdGVyID0geyB1cmxzOiBbXCI8YWxsX3VybHM+XCJdLCB0eXBlczogYWxsVHlwZXMgfTtcbiAgICAgICAgY29uc3QgcmVxdWVzdFN0ZW1zRnJvbUV4dGVuc2lvbiA9IGRldGFpbHMgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIChkZXRhaWxzLm9yaWdpblVybCAmJlxuICAgICAgICAgICAgICAgIGRldGFpbHMub3JpZ2luVXJsLmluZGV4T2YoXCJtb3otZXh0ZW5zaW9uOi8vXCIpID4gLTEgJiZcbiAgICAgICAgICAgICAgICBkZXRhaWxzLm9yaWdpblVybC5pbmNsdWRlcyhcImZha2VSZXF1ZXN0XCIpKTtcbiAgICAgICAgfTtcbiAgICAgICAgLypcbiAgICAgICAgICogQXR0YWNoIGhhbmRsZXJzIHRvIGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vbkNvbXBsZXRlTGlzdGVuZXIgPSAoZGV0YWlscykgPT4ge1xuICAgICAgICAgICAgLy8gSWdub3JlIHJlcXVlc3RzIG1hZGUgYnkgZXh0ZW5zaW9uc1xuICAgICAgICAgICAgaWYgKHJlcXVlc3RTdGVtc0Zyb21FeHRlbnNpb24oZGV0YWlscykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwZW5kaW5nUmVzcG9uc2UgPSB0aGlzLmdldFBlbmRpbmdSZXNwb25zZShkZXRhaWxzLnJlcXVlc3RJZCk7XG4gICAgICAgICAgICBwZW5kaW5nUmVzcG9uc2UucmVzb2x2ZU9uQ29tcGxldGVkRXZlbnREZXRhaWxzKGRldGFpbHMpO1xuICAgICAgICAgICAgdGhpcy5vbkNvbXBsZXRlRG5zSGFuZGxlcihkZXRhaWxzLCBjcmF3bElEKTtcbiAgICAgICAgfTtcbiAgICAgICAgYnJvd3Nlci53ZWJSZXF1ZXN0Lm9uQ29tcGxldGVkLmFkZExpc3RlbmVyKHRoaXMub25Db21wbGV0ZUxpc3RlbmVyLCBmaWx0ZXIpO1xuICAgIH1cbiAgICBjbGVhbnVwKCkge1xuICAgICAgICBpZiAodGhpcy5vbkNvbXBsZXRlTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIGJyb3dzZXIud2ViUmVxdWVzdC5vbkNvbXBsZXRlZC5yZW1vdmVMaXN0ZW5lcih0aGlzLm9uQ29tcGxldGVMaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0UGVuZGluZ1Jlc3BvbnNlKHJlcXVlc3RJZCkge1xuICAgICAgICBpZiAoIXRoaXMucGVuZGluZ1Jlc3BvbnNlc1tyZXF1ZXN0SWRdKSB7XG4gICAgICAgICAgICB0aGlzLnBlbmRpbmdSZXNwb25zZXNbcmVxdWVzdElkXSA9IG5ldyBQZW5kaW5nUmVzcG9uc2UoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5wZW5kaW5nUmVzcG9uc2VzW3JlcXVlc3RJZF07XG4gICAgfVxuICAgIGhhbmRsZVJlc29sdmVkRG5zRGF0YShkbnNSZWNvcmRPYmosIGRhdGFSZWNlaXZlcikge1xuICAgICAgICAvLyBDdXJyaW5nIHRoZSBkYXRhIHJldHVybmVkIGJ5IEFQSSBjYWxsLlxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHJlY29yZCkge1xuICAgICAgICAgICAgLy8gR2V0IGRhdGEgZnJvbSBBUEkgY2FsbFxuICAgICAgICAgICAgZG5zUmVjb3JkT2JqLmFkZHJlc3NlcyA9IHJlY29yZC5hZGRyZXNzZXMudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIGRuc1JlY29yZE9iai5jYW5vbmljYWxfbmFtZSA9IHJlY29yZC5jYW5vbmljYWxOYW1lO1xuICAgICAgICAgICAgZG5zUmVjb3JkT2JqLmlzX1RSUiA9IHJlY29yZC5pc1RSUjtcbiAgICAgICAgICAgIC8vIFNlbmQgZGF0YSB0byBtYWluIE9wZW5XUE0gZGF0YSBhZ2dyZWdhdG9yLlxuICAgICAgICAgICAgZGF0YVJlY2VpdmVyLnNhdmVSZWNvcmQoXCJkbnNfcmVzcG9uc2VzXCIsIGRuc1JlY29yZE9iaik7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGFzeW5jIG9uQ29tcGxldGVEbnNIYW5kbGVyKGRldGFpbHMsIGNyYXdsSUQpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGFuZCBwb3B1bGF0ZSBEbnNSZXNvbHZlIG9iamVjdFxuICAgICAgICBjb25zdCBkbnNSZWNvcmQgPSB7fTtcbiAgICAgICAgZG5zUmVjb3JkLmJyb3dzZXJfaWQgPSBjcmF3bElEO1xuICAgICAgICBkbnNSZWNvcmQucmVxdWVzdF9pZCA9IE51bWJlcihkZXRhaWxzLnJlcXVlc3RJZCk7XG4gICAgICAgIGRuc1JlY29yZC51c2VkX2FkZHJlc3MgPSBkZXRhaWxzLmlwO1xuICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IG5ldyBEYXRlKGRldGFpbHMudGltZVN0YW1wKTtcbiAgICAgICAgZG5zUmVjb3JkLnRpbWVfc3RhbXAgPSBjdXJyZW50VGltZS50b0lTT1N0cmluZygpO1xuICAgICAgICAvLyBRdWVyeSBETlMgQVBJXG4gICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoZGV0YWlscy51cmwpO1xuICAgICAgICBkbnNSZWNvcmQuaG9zdG5hbWUgPSB1cmwuaG9zdG5hbWU7XG4gICAgICAgIGNvbnN0IGRuc1Jlc29sdmUgPSBicm93c2VyLmRucy5yZXNvbHZlKGRuc1JlY29yZC5ob3N0bmFtZSwgW1wiY2Fub25pY2FsX25hbWVcIl0pO1xuICAgICAgICBkbnNSZXNvbHZlLnRoZW4odGhpcy5oYW5kbGVSZXNvbHZlZERuc0RhdGEoZG5zUmVjb3JkLCB0aGlzLmRhdGFSZWNlaXZlcikpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaVpHNXpMV2x1YzNSeWRXMWxiblF1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sY3lJNld5SXVMaTh1TGk4dUxpOXpjbU12WW1GamEyZHliM1Z1WkM5a2JuTXRhVzV6ZEhKMWJXVnVkQzUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTeFBRVUZQTEVWQlFVTXNaVUZCWlN4RlFVRkRMRTFCUVUwc2VVSkJRWGxDTEVOQlFVTTdRVUZIZUVRc1QwRkJUeXhGUVVGRExGRkJRVkVzUlVGQlF5eE5RVUZOTEcxQ1FVRnRRaXhEUVVGRE8wRkJTVE5ETEUxQlFVMHNUMEZCVHl4aFFVRmhPMGxCUTFBc1dVRkJXU3hEUVVGRE8wbEJRM1JDTEd0Q1FVRnJRaXhEUVVGRE8wbEJRMjVDTEdkQ1FVRm5RaXhIUVVWd1FpeEZRVUZGTEVOQlFVTTdTVUZGVUN4WlFVRlpMRmxCUVZrN1VVRkRkRUlzU1VGQlNTeERRVUZETEZsQlFWa3NSMEZCUnl4WlFVRlpMRU5CUVVNN1NVRkRia01zUTBGQlF6dEpRVVZOTEVkQlFVY3NRMEZCUXl4UFFVRlBPMUZCUldoQ0xFMUJRVTBzVFVGQlRTeEhRVUZyUWl4RlFVRkZMRWxCUVVrc1JVRkJSU3hEUVVGRExGbEJRVmtzUTBGQlF5eEZRVUZGTEV0QlFVc3NSVUZCUlN4UlFVRlJMRVZCUVVVc1EwRkJRenRSUVVWNFJTeE5RVUZOTEhsQ1FVRjVRaXhIUVVGSExFOUJRVThzUTBGQlF5eEZRVUZGTzFsQlEzaERMRTlCUVU4c1EwRkRUQ3hQUVVGUExFTkJRVU1zVTBGQlV6dG5Ra0ZEWml4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRExFOUJRVThzUTBGQlF5eHJRa0ZCYTBJc1EwRkJReXhIUVVGSExFTkJRVU1zUTBGQlF6dG5Ra0ZEYkVRc1QwRkJUeXhEUVVGRExGTkJRVk1zUTBGQlF5eFJRVUZSTEVOQlFVTXNZVUZCWVN4RFFVRkRMRU5CUXpWRExFTkJRVU03VVVGRFRpeERRVUZETEVOQlFVTTdVVUZGUmpzN1YwRkZSenRSUVVOSUxFbEJRVWtzUTBGQlF5eHJRa0ZCYTBJc1IwRkJSeXhEUVVONFFpeFBRVUV3UXl4RlFVTXhReXhGUVVGRk8xbEJRMFlzY1VOQlFYRkRPMWxCUTNKRExFbEJRVWtzZVVKQlFYbENMRU5CUVVNc1QwRkJUeXhEUVVGRExFVkJRVVU3WjBKQlEzUkRMRTlCUVU4N1lVRkRVanRaUVVORUxFMUJRVTBzWlVGQlpTeEhRVUZITEVsQlFVa3NRMEZCUXl4clFrRkJhMElzUTBGQlF5eFBRVUZQTEVOQlFVTXNVMEZCVXl4RFFVRkRMRU5CUVVNN1dVRkRia1VzWlVGQlpTeERRVUZETERoQ1FVRTRRaXhEUVVGRExFOUJRVThzUTBGQlF5eERRVUZETzFsQlJYaEVMRWxCUVVrc1EwRkJReXh2UWtGQmIwSXNRMEZEZGtJc1QwRkJUeXhGUVVOUUxFOUJRVThzUTBGRFVpeERRVUZETzFGQlEwb3NRMEZCUXl4RFFVRkRPMUZCUlVZc1QwRkJUeXhEUVVGRExGVkJRVlVzUTBGQlF5eFhRVUZYTEVOQlFVTXNWMEZCVnl4RFFVTjRReXhKUVVGSkxFTkJRVU1zYTBKQlFXdENMRVZCUTNaQ0xFMUJRVTBzUTBGRFVDeERRVUZETzBsQlEwb3NRMEZCUXp0SlFVVk5MRTlCUVU4N1VVRkRXaXhKUVVGSkxFbEJRVWtzUTBGQlF5eHJRa0ZCYTBJc1JVRkJSVHRaUVVNelFpeFBRVUZQTEVOQlFVTXNWVUZCVlN4RFFVRkRMRmRCUVZjc1EwRkJReXhqUVVGakxFTkJRek5ETEVsQlFVa3NRMEZCUXl4clFrRkJhMElzUTBGRGVFSXNRMEZCUXp0VFFVTklPMGxCUTBnc1EwRkJRenRKUVVWUExHdENRVUZyUWl4RFFVRkRMRk5CUVZNN1VVRkRiRU1zU1VGQlNTeERRVUZETEVsQlFVa3NRMEZCUXl4blFrRkJaMElzUTBGQlF5eFRRVUZUTEVOQlFVTXNSVUZCUlR0WlFVTnlReXhKUVVGSkxFTkJRVU1zWjBKQlFXZENMRU5CUVVNc1UwRkJVeXhEUVVGRExFZEJRVWNzU1VGQlNTeGxRVUZsTEVWQlFVVXNRMEZCUXp0VFFVTXhSRHRSUVVORUxFOUJRVThzU1VGQlNTeERRVUZETEdkQ1FVRm5RaXhEUVVGRExGTkJRVk1zUTBGQlF5eERRVUZETzBsQlF6RkRMRU5CUVVNN1NVRkZUeXh4UWtGQmNVSXNRMEZCUXl4WlFVRlpMRVZCUVVVc1dVRkJXVHRSUVVOMFJDeDVRMEZCZVVNN1VVRkRla01zVDBGQlR5eFZRVUZUTEUxQlFVMDdXVUZEY0VJc2VVSkJRWGxDTzFsQlEzcENMRmxCUVZrc1EwRkJReXhUUVVGVExFZEJRVWNzVFVGQlRTeERRVUZETEZOQlFWTXNRMEZCUXl4UlFVRlJMRVZCUVVVc1EwRkJRVHRaUVVOd1JDeFpRVUZaTEVOQlFVTXNZMEZCWXl4SFFVRkhMRTFCUVUwc1EwRkJReXhoUVVGaExFTkJRVUU3V1VGRGJFUXNXVUZCV1N4RFFVRkRMRTFCUVUwc1IwRkJSeXhOUVVGTkxFTkJRVU1zUzBGQlN5eERRVUZCTzFsQlJXeERMRFpEUVVFMlF6dFpRVU0zUXl4WlFVRlpMRU5CUVVNc1ZVRkJWU3hEUVVGRExHVkJRV1VzUlVGQlJTeFpRVUZaTEVOQlFVTXNRMEZCUXp0UlFVTjZSQ3hEUVVGRExFTkJRVUU3U1VGRFNDeERRVUZETzBsQlJVOHNTMEZCU3l4RFFVRkRMRzlDUVVGdlFpeERRVU5vUXl4UFFVRXdReXhGUVVNeFF5eFBRVUZQTzFGQlJVd3NkME5CUVhkRE8xRkJRM2hETEUxQlFVMHNVMEZCVXl4SFFVRkhMRVZCUVdsQ0xFTkJRVU03VVVGRGNFTXNVMEZCVXl4RFFVRkRMRlZCUVZVc1IwRkJSeXhQUVVGUExFTkJRVU03VVVGREwwSXNVMEZCVXl4RFFVRkRMRlZCUVZVc1IwRkJTU3hOUVVGTkxFTkJRVU1zVDBGQlR5eERRVUZETEZOQlFWTXNRMEZCUXl4RFFVRkRPMUZCUTJ4RUxGTkJRVk1zUTBGQlF5eFpRVUZaTEVkQlFVY3NUMEZCVHl4RFFVRkRMRVZCUVVVc1EwRkJRenRSUVVOd1F5eE5RVUZOTEZkQlFWY3NSMEZCUnl4SlFVRkpMRWxCUVVrc1EwRkJReXhQUVVGUExFTkJRVU1zVTBGQlV5eERRVUZETEVOQlFVTTdVVUZEYUVRc1UwRkJVeXhEUVVGRExGVkJRVlVzUjBGQlJ5eFhRVUZYTEVOQlFVTXNWMEZCVnl4RlFVRkZMRU5CUVVNN1VVRkZha1FzWjBKQlFXZENPMUZCUTJoQ0xFMUJRVTBzUjBGQlJ5eEhRVUZITEVsQlFVa3NSMEZCUnl4RFFVRkRMRTlCUVU4c1EwRkJReXhIUVVGSExFTkJRVU1zUTBGQlF6dFJRVU5xUXl4VFFVRlRMRU5CUVVNc1VVRkJVU3hIUVVGSExFZEJRVWNzUTBGQlF5eFJRVUZSTEVOQlFVTTdVVUZEYkVNc1RVRkJUU3hWUVVGVkxFZEJRVWNzVDBGQlR5eERRVUZETEVkQlFVY3NRMEZCUXl4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRExGRkJRVkVzUlVGQlJTeERRVUZETEdkQ1FVRm5RaXhEUVVGRExFTkJRVU1zUTBGQlF6dFJRVU12UlN4VlFVRlZMRU5CUVVNc1NVRkJTU3hEUVVGRExFbEJRVWtzUTBGQlF5eHhRa0ZCY1VJc1EwRkJReXhUUVVGVExFVkJRVVVzU1VGQlNTeERRVUZETEZsQlFWa3NRMEZCUXl4RFFVRkRMRU5CUVVNN1NVRkROVVVzUTBGQlF6dERRVVZLSW4wPSIsImltcG9ydCB7IGluY3JlbWVudGVkRXZlbnRPcmRpbmFsIH0gZnJvbSBcIi4uL2xpYi9leHRlbnNpb24tc2Vzc2lvbi1ldmVudC1vcmRpbmFsXCI7XG5pbXBvcnQgeyBleHRlbnNpb25TZXNzaW9uVXVpZCB9IGZyb20gXCIuLi9saWIvZXh0ZW5zaW9uLXNlc3Npb24tdXVpZFwiO1xuaW1wb3J0IHsgSHR0cFBvc3RQYXJzZXIgfSBmcm9tIFwiLi4vbGliL2h0dHAtcG9zdC1wYXJzZXJcIjtcbmltcG9ydCB7IFBlbmRpbmdSZXF1ZXN0IH0gZnJvbSBcIi4uL2xpYi9wZW5kaW5nLXJlcXVlc3RcIjtcbmltcG9ydCB7IFBlbmRpbmdSZXNwb25zZSB9IGZyb20gXCIuLi9saWIvcGVuZGluZy1yZXNwb25zZVwiO1xuaW1wb3J0IHsgYm9vbFRvSW50LCBlc2NhcGVTdHJpbmcsIGVzY2FwZVVybCB9IGZyb20gXCIuLi9saWIvc3RyaW5nLXV0aWxzXCI7XG4vKipcbiAqIE5vdGU6IERpZmZlcmVudCBwYXJ0cyBvZiB0aGUgZGVzaXJlZCBpbmZvcm1hdGlvbiBhcnJpdmVzIGluIGRpZmZlcmVudCBldmVudHMgYXMgcGVyIGJlbG93OlxuICogcmVxdWVzdCA9IGhlYWRlcnMgaW4gb25CZWZvcmVTZW5kSGVhZGVycyArIGJvZHkgaW4gb25CZWZvcmVSZXF1ZXN0XG4gKiByZXNwb25zZSA9IGhlYWRlcnMgaW4gb25Db21wbGV0ZWQgKyBib2R5IHZpYSBhIG9uQmVmb3JlUmVxdWVzdCBmaWx0ZXJcbiAqIHJlZGlyZWN0ID0gb3JpZ2luYWwgcmVxdWVzdCBoZWFkZXJzK2JvZHksIGZvbGxvd2VkIGJ5IGEgb25CZWZvcmVSZWRpcmVjdCBhbmQgdGhlbiBhIG5ldyBzZXQgb2YgcmVxdWVzdCBoZWFkZXJzK2JvZHkgYW5kIHJlc3BvbnNlIGhlYWRlcnMrYm9keVxuICogRG9jczogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Vc2VyOndiYW1iZXJnL3dlYlJlcXVlc3QuUmVxdWVzdERldGFpbHNcbiAqL1xuY29uc3QgYWxsVHlwZXMgPSBbXG4gICAgXCJiZWFjb25cIixcbiAgICBcImNzcF9yZXBvcnRcIixcbiAgICBcImZvbnRcIixcbiAgICBcImltYWdlXCIsXG4gICAgXCJpbWFnZXNldFwiLFxuICAgIFwibWFpbl9mcmFtZVwiLFxuICAgIFwibWVkaWFcIixcbiAgICBcIm9iamVjdFwiLFxuICAgIFwib2JqZWN0X3N1YnJlcXVlc3RcIixcbiAgICBcInBpbmdcIixcbiAgICBcInNjcmlwdFwiLFxuICAgIFwic3BlY3VsYXRpdmVcIixcbiAgICBcInN0eWxlc2hlZXRcIixcbiAgICBcInN1Yl9mcmFtZVwiLFxuICAgIFwid2ViX21hbmlmZXN0XCIsXG4gICAgXCJ3ZWJzb2NrZXRcIixcbiAgICBcInhtbF9kdGRcIixcbiAgICBcInhtbGh0dHByZXF1ZXN0XCIsXG4gICAgXCJ4c2x0XCIsXG4gICAgXCJvdGhlclwiLFxuXTtcbmV4cG9ydCB7IGFsbFR5cGVzIH07XG5leHBvcnQgY2xhc3MgSHR0cEluc3RydW1lbnQge1xuICAgIGRhdGFSZWNlaXZlcjtcbiAgICBwZW5kaW5nUmVxdWVzdHMgPSB7fTtcbiAgICBwZW5kaW5nUmVzcG9uc2VzID0ge307XG4gICAgb25CZWZvcmVSZXF1ZXN0TGlzdGVuZXI7XG4gICAgb25CZWZvcmVTZW5kSGVhZGVyc0xpc3RlbmVyO1xuICAgIG9uQmVmb3JlUmVkaXJlY3RMaXN0ZW5lcjtcbiAgICBvbkNvbXBsZXRlZExpc3RlbmVyO1xuICAgIGNvbnN0cnVjdG9yKGRhdGFSZWNlaXZlcikge1xuICAgICAgICB0aGlzLmRhdGFSZWNlaXZlciA9IGRhdGFSZWNlaXZlcjtcbiAgICB9XG4gICAgcnVuKGNyYXdsSUQsIHNhdmVDb250ZW50T3B0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZpbHRlciA9IHsgdXJsczogW1wiPGFsbF91cmxzPlwiXSwgdHlwZXM6IGFsbFR5cGVzIH07XG4gICAgICAgIGNvbnN0IHJlcXVlc3RTdGVtc0Zyb21FeHRlbnNpb24gPSBkZXRhaWxzID0+IHtcbiAgICAgICAgICAgIHJldHVybiAoZGV0YWlscy5vcmlnaW5VcmwgJiYgZGV0YWlscy5vcmlnaW5VcmwuaW5kZXhPZihcIm1vei1leHRlbnNpb246Ly9cIikgPiAtMSk7XG4gICAgICAgIH07XG4gICAgICAgIC8qXG4gICAgICAgICAqIEF0dGFjaCBoYW5kbGVycyB0byBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25CZWZvcmVSZXF1ZXN0TGlzdGVuZXIgPSAoZGV0YWlscykgPT4ge1xuICAgICAgICAgICAgY29uc3QgYmxvY2tpbmdSZXNwb25zZVRoYXREb2VzTm90aGluZyA9IHt9O1xuICAgICAgICAgICAgLy8gSWdub3JlIHJlcXVlc3RzIG1hZGUgYnkgZXh0ZW5zaW9uc1xuICAgICAgICAgICAgaWYgKHJlcXVlc3RTdGVtc0Zyb21FeHRlbnNpb24oZGV0YWlscykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYmxvY2tpbmdSZXNwb25zZVRoYXREb2VzTm90aGluZztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHBlbmRpbmdSZXF1ZXN0ID0gdGhpcy5nZXRQZW5kaW5nUmVxdWVzdChkZXRhaWxzLnJlcXVlc3RJZCk7XG4gICAgICAgICAgICBwZW5kaW5nUmVxdWVzdC5yZXNvbHZlT25CZWZvcmVSZXF1ZXN0RXZlbnREZXRhaWxzKGRldGFpbHMpO1xuICAgICAgICAgICAgY29uc3QgcGVuZGluZ1Jlc3BvbnNlID0gdGhpcy5nZXRQZW5kaW5nUmVzcG9uc2UoZGV0YWlscy5yZXF1ZXN0SWQpO1xuICAgICAgICAgICAgcGVuZGluZ1Jlc3BvbnNlLnJlc29sdmVPbkJlZm9yZVJlcXVlc3RFdmVudERldGFpbHMoZGV0YWlscyk7XG4gICAgICAgICAgICBpZiAodGhpcy5zaG91bGRTYXZlQ29udGVudChzYXZlQ29udGVudE9wdGlvbiwgZGV0YWlscy50eXBlKSkge1xuICAgICAgICAgICAgICAgIHBlbmRpbmdSZXNwb25zZS5hZGRSZXNwb25zZVJlc3BvbnNlQm9keUxpc3RlbmVyKGRldGFpbHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGJsb2NraW5nUmVzcG9uc2VUaGF0RG9lc05vdGhpbmc7XG4gICAgICAgIH07XG4gICAgICAgIGJyb3dzZXIud2ViUmVxdWVzdC5vbkJlZm9yZVJlcXVlc3QuYWRkTGlzdGVuZXIodGhpcy5vbkJlZm9yZVJlcXVlc3RMaXN0ZW5lciwgZmlsdGVyLCB0aGlzLmlzQ29udGVudFNhdmluZ0VuYWJsZWQoc2F2ZUNvbnRlbnRPcHRpb24pXG4gICAgICAgICAgICA/IFtcInJlcXVlc3RCb2R5XCIsIFwiYmxvY2tpbmdcIl1cbiAgICAgICAgICAgIDogW1wicmVxdWVzdEJvZHlcIl0pO1xuICAgICAgICB0aGlzLm9uQmVmb3JlU2VuZEhlYWRlcnNMaXN0ZW5lciA9IGRldGFpbHMgPT4ge1xuICAgICAgICAgICAgLy8gSWdub3JlIHJlcXVlc3RzIG1hZGUgYnkgZXh0ZW5zaW9uc1xuICAgICAgICAgICAgaWYgKHJlcXVlc3RTdGVtc0Zyb21FeHRlbnNpb24oZGV0YWlscykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwZW5kaW5nUmVxdWVzdCA9IHRoaXMuZ2V0UGVuZGluZ1JlcXVlc3QoZGV0YWlscy5yZXF1ZXN0SWQpO1xuICAgICAgICAgICAgcGVuZGluZ1JlcXVlc3QucmVzb2x2ZU9uQmVmb3JlU2VuZEhlYWRlcnNFdmVudERldGFpbHMoZGV0YWlscyk7XG4gICAgICAgICAgICB0aGlzLm9uQmVmb3JlU2VuZEhlYWRlcnNIYW5kbGVyKGRldGFpbHMsIGNyYXdsSUQsIGluY3JlbWVudGVkRXZlbnRPcmRpbmFsKCkpO1xuICAgICAgICB9O1xuICAgICAgICBicm93c2VyLndlYlJlcXVlc3Qub25CZWZvcmVTZW5kSGVhZGVycy5hZGRMaXN0ZW5lcih0aGlzLm9uQmVmb3JlU2VuZEhlYWRlcnNMaXN0ZW5lciwgZmlsdGVyLCBbXCJyZXF1ZXN0SGVhZGVyc1wiXSk7XG4gICAgICAgIHRoaXMub25CZWZvcmVSZWRpcmVjdExpc3RlbmVyID0gZGV0YWlscyA9PiB7XG4gICAgICAgICAgICAvLyBJZ25vcmUgcmVxdWVzdHMgbWFkZSBieSBleHRlbnNpb25zXG4gICAgICAgICAgICBpZiAocmVxdWVzdFN0ZW1zRnJvbUV4dGVuc2lvbihkZXRhaWxzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMub25CZWZvcmVSZWRpcmVjdEhhbmRsZXIoZGV0YWlscywgY3Jhd2xJRCwgaW5jcmVtZW50ZWRFdmVudE9yZGluYWwoKSk7XG4gICAgICAgIH07XG4gICAgICAgIGJyb3dzZXIud2ViUmVxdWVzdC5vbkJlZm9yZVJlZGlyZWN0LmFkZExpc3RlbmVyKHRoaXMub25CZWZvcmVSZWRpcmVjdExpc3RlbmVyLCBmaWx0ZXIsIFtcInJlc3BvbnNlSGVhZGVyc1wiXSk7XG4gICAgICAgIHRoaXMub25Db21wbGV0ZWRMaXN0ZW5lciA9IGRldGFpbHMgPT4ge1xuICAgICAgICAgICAgLy8gSWdub3JlIHJlcXVlc3RzIG1hZGUgYnkgZXh0ZW5zaW9uc1xuICAgICAgICAgICAgaWYgKHJlcXVlc3RTdGVtc0Zyb21FeHRlbnNpb24oZGV0YWlscykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwZW5kaW5nUmVzcG9uc2UgPSB0aGlzLmdldFBlbmRpbmdSZXNwb25zZShkZXRhaWxzLnJlcXVlc3RJZCk7XG4gICAgICAgICAgICBwZW5kaW5nUmVzcG9uc2UucmVzb2x2ZU9uQ29tcGxldGVkRXZlbnREZXRhaWxzKGRldGFpbHMpO1xuICAgICAgICAgICAgdGhpcy5vbkNvbXBsZXRlZEhhbmRsZXIoZGV0YWlscywgY3Jhd2xJRCwgaW5jcmVtZW50ZWRFdmVudE9yZGluYWwoKSwgc2F2ZUNvbnRlbnRPcHRpb24pO1xuICAgICAgICB9O1xuICAgICAgICBicm93c2VyLndlYlJlcXVlc3Qub25Db21wbGV0ZWQuYWRkTGlzdGVuZXIodGhpcy5vbkNvbXBsZXRlZExpc3RlbmVyLCBmaWx0ZXIsIFtcInJlc3BvbnNlSGVhZGVyc1wiXSk7XG4gICAgfVxuICAgIGNsZWFudXAoKSB7XG4gICAgICAgIGlmICh0aGlzLm9uQmVmb3JlUmVxdWVzdExpc3RlbmVyKSB7XG4gICAgICAgICAgICBicm93c2VyLndlYlJlcXVlc3Qub25CZWZvcmVSZXF1ZXN0LnJlbW92ZUxpc3RlbmVyKHRoaXMub25CZWZvcmVSZXF1ZXN0TGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9uQmVmb3JlU2VuZEhlYWRlcnNMaXN0ZW5lcikge1xuICAgICAgICAgICAgYnJvd3Nlci53ZWJSZXF1ZXN0Lm9uQmVmb3JlU2VuZEhlYWRlcnMucmVtb3ZlTGlzdGVuZXIodGhpcy5vbkJlZm9yZVNlbmRIZWFkZXJzTGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9uQmVmb3JlUmVkaXJlY3RMaXN0ZW5lcikge1xuICAgICAgICAgICAgYnJvd3Nlci53ZWJSZXF1ZXN0Lm9uQmVmb3JlUmVkaXJlY3QucmVtb3ZlTGlzdGVuZXIodGhpcy5vbkJlZm9yZVJlZGlyZWN0TGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9uQ29tcGxldGVkTGlzdGVuZXIpIHtcbiAgICAgICAgICAgIGJyb3dzZXIud2ViUmVxdWVzdC5vbkNvbXBsZXRlZC5yZW1vdmVMaXN0ZW5lcih0aGlzLm9uQ29tcGxldGVkTGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlzQ29udGVudFNhdmluZ0VuYWJsZWQoc2F2ZUNvbnRlbnRPcHRpb24pIHtcbiAgICAgICAgaWYgKHNhdmVDb250ZW50T3B0aW9uID09PSB0cnVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2F2ZUNvbnRlbnRPcHRpb24gPT09IGZhbHNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuc2F2ZUNvbnRlbnRSZXNvdXJjZVR5cGVzKHNhdmVDb250ZW50T3B0aW9uKS5sZW5ndGggPiAwO1xuICAgIH1cbiAgICBzYXZlQ29udGVudFJlc291cmNlVHlwZXMoc2F2ZUNvbnRlbnRPcHRpb24pIHtcbiAgICAgICAgcmV0dXJuIHNhdmVDb250ZW50T3B0aW9uLnNwbGl0KFwiLFwiKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogV2UgcmVseSBvbiB0aGUgcmVzb3VyY2UgdHlwZSB0byBmaWx0ZXIgcmVzcG9uc2VzXG4gICAgICogU2VlOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL01vemlsbGEvQWRkLW9ucy9XZWJFeHRlbnNpb25zL0FQSS93ZWJSZXF1ZXN0L1Jlc291cmNlVHlwZVxuICAgICAqXG4gICAgICogQHBhcmFtIHNhdmVDb250ZW50T3B0aW9uXG4gICAgICogQHBhcmFtIHJlc291cmNlVHlwZVxuICAgICAqL1xuICAgIHNob3VsZFNhdmVDb250ZW50KHNhdmVDb250ZW50T3B0aW9uLCByZXNvdXJjZVR5cGUpIHtcbiAgICAgICAgaWYgKHNhdmVDb250ZW50T3B0aW9uID09PSB0cnVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2F2ZUNvbnRlbnRPcHRpb24gPT09IGZhbHNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuc2F2ZUNvbnRlbnRSZXNvdXJjZVR5cGVzKHNhdmVDb250ZW50T3B0aW9uKS5pbmNsdWRlcyhyZXNvdXJjZVR5cGUpO1xuICAgIH1cbiAgICBnZXRQZW5kaW5nUmVxdWVzdChyZXF1ZXN0SWQpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBlbmRpbmdSZXF1ZXN0c1tyZXF1ZXN0SWRdKSB7XG4gICAgICAgICAgICB0aGlzLnBlbmRpbmdSZXF1ZXN0c1tyZXF1ZXN0SWRdID0gbmV3IFBlbmRpbmdSZXF1ZXN0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucGVuZGluZ1JlcXVlc3RzW3JlcXVlc3RJZF07XG4gICAgfVxuICAgIGdldFBlbmRpbmdSZXNwb25zZShyZXF1ZXN0SWQpIHtcbiAgICAgICAgaWYgKCF0aGlzLnBlbmRpbmdSZXNwb25zZXNbcmVxdWVzdElkXSkge1xuICAgICAgICAgICAgdGhpcy5wZW5kaW5nUmVzcG9uc2VzW3JlcXVlc3RJZF0gPSBuZXcgUGVuZGluZ1Jlc3BvbnNlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucGVuZGluZ1Jlc3BvbnNlc1tyZXF1ZXN0SWRdO1xuICAgIH1cbiAgICAvKlxuICAgICAqIEhUVFAgUmVxdWVzdCBIYW5kbGVyIGFuZCBIZWxwZXIgRnVuY3Rpb25zXG4gICAgICovXG4gICAgYXN5bmMgb25CZWZvcmVTZW5kSGVhZGVyc0hhbmRsZXIoZGV0YWlscywgY3Jhd2xJRCwgZXZlbnRPcmRpbmFsKSB7XG4gICAgICAgIGNvbnN0IHRhYiA9IGRldGFpbHMudGFiSWQgPiAtMVxuICAgICAgICAgICAgPyBhd2FpdCBicm93c2VyLnRhYnMuZ2V0KGRldGFpbHMudGFiSWQpXG4gICAgICAgICAgICA6IHsgd2luZG93SWQ6IHVuZGVmaW5lZCwgaW5jb2duaXRvOiB1bmRlZmluZWQsIHVybDogdW5kZWZpbmVkIH07XG4gICAgICAgIGNvbnN0IHVwZGF0ZSA9IHt9O1xuICAgICAgICB1cGRhdGUuaW5jb2duaXRvID0gYm9vbFRvSW50KHRhYi5pbmNvZ25pdG8pO1xuICAgICAgICB1cGRhdGUuYnJvd3Nlcl9pZCA9IGNyYXdsSUQ7XG4gICAgICAgIHVwZGF0ZS5leHRlbnNpb25fc2Vzc2lvbl91dWlkID0gZXh0ZW5zaW9uU2Vzc2lvblV1aWQ7XG4gICAgICAgIHVwZGF0ZS5ldmVudF9vcmRpbmFsID0gZXZlbnRPcmRpbmFsO1xuICAgICAgICB1cGRhdGUud2luZG93X2lkID0gdGFiLndpbmRvd0lkO1xuICAgICAgICB1cGRhdGUudGFiX2lkID0gZGV0YWlscy50YWJJZDtcbiAgICAgICAgdXBkYXRlLmZyYW1lX2lkID0gZGV0YWlscy5mcmFtZUlkO1xuICAgICAgICAvLyByZXF1ZXN0SWQgaXMgYSB1bmlxdWUgaWRlbnRpZmllciB0aGF0IGNhbiBiZSB1c2VkIHRvIGxpbmsgcmVxdWVzdHMgYW5kIHJlc3BvbnNlc1xuICAgICAgICB1cGRhdGUucmVxdWVzdF9pZCA9IE51bWJlcihkZXRhaWxzLnJlcXVlc3RJZCk7XG4gICAgICAgIGNvbnN0IHVybCA9IGRldGFpbHMudXJsO1xuICAgICAgICB1cGRhdGUudXJsID0gZXNjYXBlVXJsKHVybCk7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RNZXRob2QgPSBkZXRhaWxzLm1ldGhvZDtcbiAgICAgICAgdXBkYXRlLm1ldGhvZCA9IGVzY2FwZVN0cmluZyhyZXF1ZXN0TWV0aG9kKTtcbiAgICAgICAgY29uc3QgY3VycmVudF90aW1lID0gbmV3IERhdGUoZGV0YWlscy50aW1lU3RhbXApO1xuICAgICAgICB1cGRhdGUudGltZV9zdGFtcCA9IGN1cnJlbnRfdGltZS50b0lTT1N0cmluZygpO1xuICAgICAgICBsZXQgZW5jb2RpbmdUeXBlID0gXCJcIjtcbiAgICAgICAgbGV0IHJlZmVycmVyID0gXCJcIjtcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IFtdO1xuICAgICAgICBsZXQgaXNPY3NwID0gZmFsc2U7XG4gICAgICAgIGlmIChkZXRhaWxzLnJlcXVlc3RIZWFkZXJzKSB7XG4gICAgICAgICAgICBkZXRhaWxzLnJlcXVlc3RIZWFkZXJzLm1hcChyZXF1ZXN0SGVhZGVyID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IG5hbWUsIHZhbHVlIH0gPSByZXF1ZXN0SGVhZGVyO1xuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcl9wYWlyID0gW107XG4gICAgICAgICAgICAgICAgaGVhZGVyX3BhaXIucHVzaChlc2NhcGVTdHJpbmcobmFtZSkpO1xuICAgICAgICAgICAgICAgIGhlYWRlcl9wYWlyLnB1c2goZXNjYXBlU3RyaW5nKHZhbHVlKSk7XG4gICAgICAgICAgICAgICAgaGVhZGVycy5wdXNoKGhlYWRlcl9wYWlyKTtcbiAgICAgICAgICAgICAgICBpZiAobmFtZSA9PT0gXCJDb250ZW50LVR5cGVcIikge1xuICAgICAgICAgICAgICAgICAgICBlbmNvZGluZ1R5cGUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVuY29kaW5nVHlwZS5pbmRleE9mKFwiYXBwbGljYXRpb24vb2NzcC1yZXF1ZXN0XCIpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNPY3NwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobmFtZSA9PT0gXCJSZWZlcmVyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJyZXIgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGUucmVmZXJyZXIgPSBlc2NhcGVTdHJpbmcocmVmZXJyZXIpO1xuICAgICAgICBpZiAocmVxdWVzdE1ldGhvZCA9PT0gXCJQT1NUXCIgJiYgIWlzT2NzcCAvKiBkb24ndCBwcm9jZXNzIE9DU1AgcmVxdWVzdHMgKi8pIHtcbiAgICAgICAgICAgIGNvbnN0IHBlbmRpbmdSZXF1ZXN0ID0gdGhpcy5nZXRQZW5kaW5nUmVxdWVzdChkZXRhaWxzLnJlcXVlc3RJZCk7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHBlbmRpbmdSZXF1ZXN0LnJlc29sdmVkV2l0aGluVGltZW91dCgxMDAwKTtcbiAgICAgICAgICAgIGlmICghcmVzb2x2ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFSZWNlaXZlci5sb2dFcnJvcihcIlBlbmRpbmcgcmVxdWVzdCB0aW1lZCBvdXQgd2FpdGluZyBmb3IgZGF0YSBmcm9tIGJvdGggb25CZWZvcmVSZXF1ZXN0IGFuZCBvbkJlZm9yZVNlbmRIZWFkZXJzIGV2ZW50c1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscyA9IGF3YWl0IHBlbmRpbmdSZXF1ZXN0Lm9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscztcbiAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0Qm9keSA9IG9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscy5yZXF1ZXN0Qm9keTtcbiAgICAgICAgICAgICAgICBpZiAocmVxdWVzdEJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zdFBhcnNlciA9IG5ldyBIdHRwUG9zdFBhcnNlcihvbkJlZm9yZVJlcXVlc3RFdmVudERldGFpbHMsIHRoaXMuZGF0YVJlY2VpdmVyKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zdE9iaiA9IHBvc3RQYXJzZXIucGFyc2VQb3N0UmVxdWVzdCgpO1xuICAgICAgICAgICAgICAgICAgICAvLyBBZGQgKFBPU1QpIHJlcXVlc3QgaGVhZGVycyBmcm9tIHVwbG9hZCBzdHJlYW1cbiAgICAgICAgICAgICAgICAgICAgaWYgKFwicG9zdF9oZWFkZXJzXCIgaW4gcG9zdE9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gT25seSBzdG9yZSBQT1NUIGhlYWRlcnMgdGhhdCB3ZSBrbm93IGFuZCBuZWVkLiBXZSBtYXkgbWlzaW50ZXJwcmV0IFBPU1QgZGF0YSBhcyBoZWFkZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhcyBkZXRlY3Rpb24gaXMgYmFzZWQgb24gXCJrZXk6dmFsdWVcIiBmb3JtYXQgKG5vbi1oZWFkZXIgUE9TVCBkYXRhIGNhbiBiZSBpbiB0aGlzIGZvcm1hdCBhcyB3ZWxsKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudEhlYWRlcnMgPSBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvbnRlbnQtRGlzcG9zaXRpb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvbnRlbnQtTGVuZ3RoXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHBvc3RPYmoucG9zdF9oZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRIZWFkZXJzLmluY2x1ZGVzKG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcl9wYWlyID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlcl9wYWlyLnB1c2goZXNjYXBlU3RyaW5nKG5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyX3BhaXIucHVzaChlc2NhcGVTdHJpbmcocG9zdE9iai5wb3N0X2hlYWRlcnNbbmFtZV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVycy5wdXNoKGhlYWRlcl9wYWlyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gd2Ugc3RvcmUgUE9TVCBib2R5IGluIEpTT04gZm9ybWF0LCBleGNlcHQgd2hlbiBpdCdzIGEgc3RyaW5nIHdpdGhvdXQgYSAoa2V5LXZhbHVlKSBzdHJ1Y3R1cmVcbiAgICAgICAgICAgICAgICAgICAgaWYgKFwicG9zdF9ib2R5XCIgaW4gcG9zdE9iaikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlLnBvc3RfYm9keSA9IHBvc3RPYmoucG9zdF9ib2R5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChcInBvc3RfYm9keV9yYXdcIiBpbiBwb3N0T2JqKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGUucG9zdF9ib2R5X3JhdyA9IHBvc3RPYmoucG9zdF9ib2R5X3JhdztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB1cGRhdGUuaGVhZGVycyA9IEpTT04uc3RyaW5naWZ5KGhlYWRlcnMpO1xuICAgICAgICAvLyBDaGVjayBpZiB4aHJcbiAgICAgICAgY29uc3QgaXNYSFIgPSBkZXRhaWxzLnR5cGUgPT09IFwieG1saHR0cHJlcXVlc3RcIjtcbiAgICAgICAgdXBkYXRlLmlzX1hIUiA9IGJvb2xUb0ludChpc1hIUik7XG4gICAgICAgIC8vIEdyYWIgdGhlIHRyaWdnZXJpbmcgYW5kIGxvYWRpbmcgUHJpbmNpcGFsc1xuICAgICAgICBsZXQgdHJpZ2dlcmluZ09yaWdpbjtcbiAgICAgICAgbGV0IGxvYWRpbmdPcmlnaW47XG4gICAgICAgIGlmIChkZXRhaWxzLm9yaWdpblVybCkge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkT3JpZ2luVXJsID0gbmV3IFVSTChkZXRhaWxzLm9yaWdpblVybCk7XG4gICAgICAgICAgICB0cmlnZ2VyaW5nT3JpZ2luID0gcGFyc2VkT3JpZ2luVXJsLm9yaWdpbjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGV0YWlscy5kb2N1bWVudFVybCkge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkRG9jdW1lbnRVcmwgPSBuZXcgVVJMKGRldGFpbHMuZG9jdW1lbnRVcmwpO1xuICAgICAgICAgICAgbG9hZGluZ09yaWdpbiA9IHBhcnNlZERvY3VtZW50VXJsLm9yaWdpbjtcbiAgICAgICAgfVxuICAgICAgICB1cGRhdGUudHJpZ2dlcmluZ19vcmlnaW4gPSBlc2NhcGVTdHJpbmcodHJpZ2dlcmluZ09yaWdpbik7XG4gICAgICAgIHVwZGF0ZS5sb2FkaW5nX29yaWdpbiA9IGVzY2FwZVN0cmluZyhsb2FkaW5nT3JpZ2luKTtcbiAgICAgICAgLy8gbG9hZGluZ0RvY3VtZW50J3MgaHJlZlxuICAgICAgICAvLyBUaGUgbG9hZGluZ0RvY3VtZW50IGlzIHRoZSBkb2N1bWVudCB0aGUgZWxlbWVudCByZXNpZGVzLCByZWdhcmRsZXNzIG9mXG4gICAgICAgIC8vIGhvdyB0aGUgbG9hZCB3YXMgdHJpZ2dlcmVkLlxuICAgICAgICBjb25zdCBsb2FkaW5nSHJlZiA9IGRldGFpbHMuZG9jdW1lbnRVcmw7XG4gICAgICAgIHVwZGF0ZS5sb2FkaW5nX2hyZWYgPSBlc2NhcGVTdHJpbmcobG9hZGluZ0hyZWYpO1xuICAgICAgICAvLyByZXNvdXJjZVR5cGUgb2YgdGhlIHJlcXVlc3Rpbmcgbm9kZS4gVGhpcyBpcyBzZXQgYnkgdGhlIHR5cGUgb2ZcbiAgICAgICAgLy8gbm9kZSBtYWtpbmcgdGhlIHJlcXVlc3QgKGkuZS4gYW4gPGltZyBzcmM9Li4uPiBub2RlIHdpbGwgc2V0IHRvIHR5cGUgXCJpbWFnZVwiKS5cbiAgICAgICAgLy8gRG9jdW1lbnRhdGlvbjpcbiAgICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Nb3ppbGxhL0FkZC1vbnMvV2ViRXh0ZW5zaW9ucy9BUEkvd2ViUmVxdWVzdC9SZXNvdXJjZVR5cGVcbiAgICAgICAgdXBkYXRlLnJlc291cmNlX3R5cGUgPSBkZXRhaWxzLnR5cGU7XG4gICAgICAgIC8qXG4gICAgICAgIC8vIFRPRE86IFJlZmFjdG9yIHRvIGNvcnJlc3BvbmRpbmcgd2ViZXh0IGxvZ2ljIG9yIGRpc2NhcmRcbiAgICAgICAgY29uc3QgVGhpcmRQYXJ0eVV0aWwgPSBDY1tcIkBtb3ppbGxhLm9yZy90aGlyZHBhcnR5dXRpbDsxXCJdLmdldFNlcnZpY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2kubW96SVRoaXJkUGFydHlVdGlsKTtcbiAgICAgICAgLy8gRG8gdGhpcmQtcGFydHkgY2hlY2tzXG4gICAgICAgIC8vIFRoZXNlIHNwZWNpZmljIGNoZWNrcyBhcmUgZG9uZSBiZWNhdXNlIGl0J3Mgd2hhdCdzIHVzZWQgaW4gVHJhY2tpbmcgUHJvdGVjdGlvblxuICAgICAgICAvLyBTZWU6IGh0dHA6Ly9zZWFyY2hmb3gub3JnL21vemlsbGEtY2VudHJhbC9zb3VyY2UvbmV0d2Vyay9iYXNlL25zQ2hhbm5lbENsYXNzaWZpZXIuY3BwIzEwN1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGlzVGhpcmRQYXJ0eUNoYW5uZWwgPSBUaGlyZFBhcnR5VXRpbC5pc1RoaXJkUGFydHlDaGFubmVsKGRldGFpbHMpO1xuICAgICAgICAgIGNvbnN0IHRvcFdpbmRvdyA9IFRoaXJkUGFydHlVdGlsLmdldFRvcFdpbmRvd0ZvckNoYW5uZWwoZGV0YWlscyk7XG4gICAgICAgICAgY29uc3QgdG9wVVJJID0gVGhpcmRQYXJ0eVV0aWwuZ2V0VVJJRnJvbVdpbmRvdyh0b3BXaW5kb3cpO1xuICAgICAgICAgIGlmICh0b3BVUkkpIHtcbiAgICAgICAgICAgIGNvbnN0IHRvcFVybCA9IHRvcFVSSS5zcGVjO1xuICAgICAgICAgICAgY29uc3QgY2hhbm5lbFVSSSA9IGRldGFpbHMuVVJJO1xuICAgICAgICAgICAgY29uc3QgaXNUaGlyZFBhcnR5VG9Ub3BXaW5kb3cgPSBUaGlyZFBhcnR5VXRpbC5pc1RoaXJkUGFydHlVUkkoXG4gICAgICAgICAgICAgIGNoYW5uZWxVUkksXG4gICAgICAgICAgICAgIHRvcFVSSSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB1cGRhdGUuaXNfdGhpcmRfcGFydHlfdG9fdG9wX3dpbmRvdyA9IGlzVGhpcmRQYXJ0eVRvVG9wV2luZG93O1xuICAgICAgICAgICAgdXBkYXRlLmlzX3RoaXJkX3BhcnR5X2NoYW5uZWwgPSBpc1RoaXJkUGFydHlDaGFubmVsO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoYW5FcnJvcikge1xuICAgICAgICAgIC8vIEV4Y2VwdGlvbnMgZXhwZWN0ZWQgZm9yIGNoYW5uZWxzIHRyaWdnZXJlZCBvciBsb2FkaW5nIGluIGFcbiAgICAgICAgICAvLyBOdWxsUHJpbmNpcGFsIG9yIFN5c3RlbVByaW5jaXBhbC4gVGhleSBhcmUgYWxzbyBleHBlY3RlZCBmb3IgZmF2aWNvblxuICAgICAgICAgIC8vIGxvYWRzLCB3aGljaCB3ZSBhdHRlbXB0IHRvIGZpbHRlci4gRGVwZW5kaW5nIG9uIHRoZSBuYW1pbmcsIHNvbWUgZmF2aWNvbnNcbiAgICAgICAgICAvLyBtYXkgY29udGludWUgdG8gbGVhZCB0byBlcnJvciBsb2dzLlxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHVwZGF0ZS50cmlnZ2VyaW5nX29yaWdpbiAhPT0gXCJbU3lzdGVtIFByaW5jaXBhbF1cIiAmJlxuICAgICAgICAgICAgdXBkYXRlLnRyaWdnZXJpbmdfb3JpZ2luICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgIHVwZGF0ZS5sb2FkaW5nX29yaWdpbiAhPT0gXCJbU3lzdGVtIFByaW5jaXBhbF1cIiAmJlxuICAgICAgICAgICAgdXBkYXRlLmxvYWRpbmdfb3JpZ2luICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICF1cGRhdGUudXJsLmVuZHNXaXRoKFwiaWNvXCIpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGFSZWNlaXZlci5sb2dFcnJvcihcbiAgICAgICAgICAgICAgXCJFcnJvciB3aGlsZSByZXRyaWV2aW5nIGFkZGl0aW9uYWwgY2hhbm5lbCBpbmZvcm1hdGlvbiBmb3IgVVJMOiBcIiArXG4gICAgICAgICAgICAgIFwiXFxuXCIgK1xuICAgICAgICAgICAgICB1cGRhdGUudXJsICtcbiAgICAgICAgICAgICAgXCJcXG4gRXJyb3IgdGV4dDpcIiArXG4gICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGFuRXJyb3IpLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlLnRvcF9sZXZlbF91cmwgPSBlc2NhcGVVcmwodGhpcy5nZXREb2N1bWVudFVybEZvclJlcXVlc3QoZGV0YWlscykpO1xuICAgICAgICB1cGRhdGUucGFyZW50X2ZyYW1lX2lkID0gZGV0YWlscy5wYXJlbnRGcmFtZUlkO1xuICAgICAgICB1cGRhdGUuZnJhbWVfYW5jZXN0b3JzID0gZXNjYXBlU3RyaW5nKEpTT04uc3RyaW5naWZ5KGRldGFpbHMuZnJhbWVBbmNlc3RvcnMpKTtcbiAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZVJlY29yZChcImh0dHBfcmVxdWVzdHNcIiwgdXBkYXRlKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ29kZSB0YWtlbiBhbmQgYWRhcHRlZCBmcm9tXG4gICAgICogaHR0cHM6Ly9naXRodWIuY29tL0VGRm9yZy9wcml2YWN5YmFkZ2VyL3B1bGwvMjE5OC9maWxlc1xuICAgICAqXG4gICAgICogR2V0cyB0aGUgVVJMIGZvciBhIGdpdmVuIHJlcXVlc3QncyB0b3AtbGV2ZWwgZG9jdW1lbnQuXG4gICAgICpcbiAgICAgKiBUaGUgcmVxdWVzdCdzIGRvY3VtZW50IG1heSBiZSBkaWZmZXJlbnQgZnJvbSB0aGUgY3VycmVudCB0b3AtbGV2ZWwgZG9jdW1lbnRcbiAgICAgKiBsb2FkZWQgaW4gdGFiIGFzIHJlcXVlc3RzIGNhbiBjb21lIG91dCBvZiBvcmRlcjpcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7V2ViUmVxdWVzdE9uQmVmb3JlU2VuZEhlYWRlcnNFdmVudERldGFpbHN9IGRldGFpbHNcbiAgICAgKlxuICAgICAqIEByZXR1cm4gez9TdHJpbmd9IHRoZSBVUkwgZm9yIHRoZSByZXF1ZXN0J3MgdG9wLWxldmVsIGRvY3VtZW50XG4gICAgICovXG4gICAgZ2V0RG9jdW1lbnRVcmxGb3JSZXF1ZXN0KGRldGFpbHMpIHtcbiAgICAgICAgbGV0IHVybCA9IFwiXCI7XG4gICAgICAgIGlmIChkZXRhaWxzLnR5cGUgPT09IFwibWFpbl9mcmFtZVwiKSB7XG4gICAgICAgICAgICAvLyBVcmwgb2YgdGhlIHRvcC1sZXZlbCBkb2N1bWVudCBpdHNlbGYuXG4gICAgICAgICAgICB1cmwgPSBkZXRhaWxzLnVybDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChkZXRhaWxzLmhhc093blByb3BlcnR5KFwiZnJhbWVBbmNlc3RvcnNcIikpIHtcbiAgICAgICAgICAgIC8vIEluIGNhc2Ugb2YgbmVzdGVkIGZyYW1lcywgcmV0cmlldmUgdXJsIGZyb20gdG9wLW1vc3QgYW5jZXN0b3IuXG4gICAgICAgICAgICAvLyBJZiBmcmFtZUFuY2VzdG9ycyA9PSBbXSwgcmVxdWVzdCBjb21lcyBmcm9tIHRoZSB0b3AtbGV2ZWwtZG9jdW1lbnQuXG4gICAgICAgICAgICB1cmwgPSBkZXRhaWxzLmZyYW1lQW5jZXN0b3JzLmxlbmd0aFxuICAgICAgICAgICAgICAgID8gZGV0YWlscy5mcmFtZUFuY2VzdG9yc1tkZXRhaWxzLmZyYW1lQW5jZXN0b3JzLmxlbmd0aCAtIDFdLnVybFxuICAgICAgICAgICAgICAgIDogZGV0YWlscy5kb2N1bWVudFVybDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIHR5cGUgIT0gJ21haW5fZnJhbWUnIGFuZCBmcmFtZUFuY2VzdG9ycyA9PSB1bmRlZmluZWRcbiAgICAgICAgICAgIC8vIEZvciBleGFtcGxlIHNlcnZpY2Ugd29ya2VyczogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTQ3MDUzNyNjMTNcbiAgICAgICAgICAgIHVybCA9IGRldGFpbHMuZG9jdW1lbnRVcmw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG4gICAgYXN5bmMgb25CZWZvcmVSZWRpcmVjdEhhbmRsZXIoZGV0YWlscywgY3Jhd2xJRCwgZXZlbnRPcmRpbmFsKSB7XG4gICAgICAgIC8qXG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIFwib25CZWZvcmVSZWRpcmVjdEhhbmRsZXIgKHByZXZpb3VzbHkgaHR0cFJlcXVlc3RIYW5kbGVyKVwiLFxuICAgICAgICAgIGRldGFpbHMsXG4gICAgICAgICAgY3Jhd2xJRCxcbiAgICAgICAgKTtcbiAgICAgICAgKi9cbiAgICAgICAgLy8gU2F2ZSBIVFRQIHJlZGlyZWN0IGV2ZW50c1xuICAgICAgICAvLyBFdmVudHMgYXJlIHNhdmVkIHRvIHRoZSBgaHR0cF9yZWRpcmVjdHNgIHRhYmxlXG4gICAgICAgIC8qXG4gICAgICAgIC8vIFRPRE86IFJlZmFjdG9yIHRvIGNvcnJlc3BvbmRpbmcgd2ViZXh0IGxvZ2ljIG9yIGRpc2NhcmRcbiAgICAgICAgLy8gRXZlbnRzIGFyZSBzYXZlZCB0byB0aGUgYGh0dHBfcmVkaXJlY3RzYCB0YWJsZSwgYW5kIG1hcCB0aGUgb2xkXG4gICAgICAgIC8vIHJlcXVlc3QvcmVzcG9uc2UgY2hhbm5lbCBpZCB0byB0aGUgbmV3IHJlcXVlc3QvcmVzcG9uc2UgY2hhbm5lbCBpZC5cbiAgICAgICAgLy8gSW1wbGVtZW50YXRpb24gYmFzZWQgb246IGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xMTI0MDYyN1xuICAgICAgICBjb25zdCBvbGROb3RpZmljYXRpb25zID0gZGV0YWlscy5ub3RpZmljYXRpb25DYWxsYmFja3M7XG4gICAgICAgIGxldCBvbGRFdmVudFNpbmsgPSBudWxsO1xuICAgICAgICBkZXRhaWxzLm5vdGlmaWNhdGlvbkNhbGxiYWNrcyA9IHtcbiAgICAgICAgICBRdWVyeUludGVyZmFjZTogWFBDT01VdGlscy5nZW5lcmF0ZVFJKFtcbiAgICAgICAgICAgIENpLm5zSUludGVyZmFjZVJlcXVlc3RvcixcbiAgICAgICAgICAgIENpLm5zSUNoYW5uZWxFdmVudFNpbmssXG4gICAgICAgICAgXSksXG4gICAgXG4gICAgICAgICAgZ2V0SW50ZXJmYWNlKGlpZCkge1xuICAgICAgICAgICAgLy8gV2UgYXJlIG9ubHkgaW50ZXJlc3RlZCBpbiBuc0lDaGFubmVsRXZlbnRTaW5rLFxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSBvbGQgY2FsbGJhY2tzIGZvciBhbnkgb3RoZXIgaW50ZXJmYWNlIHJlcXVlc3RzLlxuICAgICAgICAgICAgaWYgKGlpZC5lcXVhbHMoQ2kubnNJQ2hhbm5lbEV2ZW50U2luaykpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBvbGRFdmVudFNpbmsgPSBvbGROb3RpZmljYXRpb25zLlF1ZXJ5SW50ZXJmYWNlKGlpZCk7XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGFuRXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFSZWNlaXZlci5sb2dFcnJvcihcbiAgICAgICAgICAgICAgICAgIFwiRXJyb3IgZHVyaW5nIGNhbGwgdG8gY3VzdG9tIG5vdGlmaWNhdGlvbkNhbGxiYWNrczo6Z2V0SW50ZXJmYWNlLlwiICtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoYW5FcnJvciksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgIH1cbiAgICBcbiAgICAgICAgICAgIGlmIChvbGROb3RpZmljYXRpb25zKSB7XG4gICAgICAgICAgICAgIHJldHVybiBvbGROb3RpZmljYXRpb25zLmdldEludGVyZmFjZShpaWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhyb3cgQ3IuTlNfRVJST1JfTk9fSU5URVJGQUNFO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgXG4gICAgICAgICAgYXN5bmNPbkNoYW5uZWxSZWRpcmVjdChvbGRDaGFubmVsLCBuZXdDaGFubmVsLCBmbGFncywgY2FsbGJhY2spIHtcbiAgICBcbiAgICAgICAgICAgIG5ld0NoYW5uZWwuUXVlcnlJbnRlcmZhY2UoQ2kubnNJSHR0cENoYW5uZWwpO1xuICAgIFxuICAgICAgICAgICAgY29uc3QgaHR0cFJlZGlyZWN0OiBIdHRwUmVkaXJlY3QgPSB7XG4gICAgICAgICAgICAgIGJyb3dzZXJfaWQ6IGNyYXdsSUQsXG4gICAgICAgICAgICAgIG9sZF9yZXF1ZXN0X2lkOiBvbGRDaGFubmVsLmNoYW5uZWxJZCxcbiAgICAgICAgICAgICAgbmV3X3JlcXVlc3RfaWQ6IG5ld0NoYW5uZWwuY2hhbm5lbElkLFxuICAgICAgICAgICAgICB0aW1lX3N0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZVJlY29yZChcImh0dHBfcmVkaXJlY3RzXCIsIGh0dHBSZWRpcmVjdCk7XG4gICAgXG4gICAgICAgICAgICBpZiAob2xkRXZlbnRTaW5rKSB7XG4gICAgICAgICAgICAgIG9sZEV2ZW50U2luay5hc3luY09uQ2hhbm5lbFJlZGlyZWN0KFxuICAgICAgICAgICAgICAgIG9sZENoYW5uZWwsXG4gICAgICAgICAgICAgICAgbmV3Q2hhbm5lbCxcbiAgICAgICAgICAgICAgICBmbGFncyxcbiAgICAgICAgICAgICAgICBjYWxsYmFjayxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrLm9uUmVkaXJlY3RWZXJpZnlDYWxsYmFjayhDci5OU19PSyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgcmVzcG9uc2VTdGF0dXMgPSBkZXRhaWxzLnN0YXR1c0NvZGU7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlU3RhdHVzVGV4dCA9IGRldGFpbHMuc3RhdHVzTGluZTtcbiAgICAgICAgY29uc3QgdGFiID0gZGV0YWlscy50YWJJZCA+IC0xXG4gICAgICAgICAgICA/IGF3YWl0IGJyb3dzZXIudGFicy5nZXQoZGV0YWlscy50YWJJZClcbiAgICAgICAgICAgIDogeyB3aW5kb3dJZDogdW5kZWZpbmVkLCBpbmNvZ25pdG86IHVuZGVmaW5lZCB9O1xuICAgICAgICBjb25zdCBodHRwUmVkaXJlY3QgPSB7XG4gICAgICAgICAgICBpbmNvZ25pdG86IGJvb2xUb0ludCh0YWIuaW5jb2duaXRvKSxcbiAgICAgICAgICAgIGJyb3dzZXJfaWQ6IGNyYXdsSUQsXG4gICAgICAgICAgICBvbGRfcmVxdWVzdF91cmw6IGVzY2FwZVVybChkZXRhaWxzLnVybCksXG4gICAgICAgICAgICBvbGRfcmVxdWVzdF9pZDogZGV0YWlscy5yZXF1ZXN0SWQsXG4gICAgICAgICAgICBuZXdfcmVxdWVzdF91cmw6IGVzY2FwZVVybChkZXRhaWxzLnJlZGlyZWN0VXJsKSxcbiAgICAgICAgICAgIG5ld19yZXF1ZXN0X2lkOiBudWxsLFxuICAgICAgICAgICAgZXh0ZW5zaW9uX3Nlc3Npb25fdXVpZDogZXh0ZW5zaW9uU2Vzc2lvblV1aWQsXG4gICAgICAgICAgICBldmVudF9vcmRpbmFsOiBldmVudE9yZGluYWwsXG4gICAgICAgICAgICB3aW5kb3dfaWQ6IHRhYi53aW5kb3dJZCxcbiAgICAgICAgICAgIHRhYl9pZDogZGV0YWlscy50YWJJZCxcbiAgICAgICAgICAgIGZyYW1lX2lkOiBkZXRhaWxzLmZyYW1lSWQsXG4gICAgICAgICAgICByZXNwb25zZV9zdGF0dXM6IHJlc3BvbnNlU3RhdHVzLFxuICAgICAgICAgICAgcmVzcG9uc2Vfc3RhdHVzX3RleHQ6IGVzY2FwZVN0cmluZyhyZXNwb25zZVN0YXR1c1RleHQpLFxuICAgICAgICAgICAgaGVhZGVyczogdGhpcy5qc29uaWZ5SGVhZGVycyhkZXRhaWxzLnJlc3BvbnNlSGVhZGVycykuaGVhZGVycyxcbiAgICAgICAgICAgIHRpbWVfc3RhbXA6IG5ldyBEYXRlKGRldGFpbHMudGltZVN0YW1wKS50b0lTT1N0cmluZygpLFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRhdGFSZWNlaXZlci5zYXZlUmVjb3JkKFwiaHR0cF9yZWRpcmVjdHNcIiwgaHR0cFJlZGlyZWN0KTtcbiAgICB9XG4gICAgLypcbiAgICAgKiBIVFRQIFJlc3BvbnNlIEhhbmRsZXJzIGFuZCBIZWxwZXIgRnVuY3Rpb25zXG4gICAgICovXG4gICAgYXN5bmMgbG9nV2l0aFJlc3BvbnNlQm9keShkZXRhaWxzLCB1cGRhdGUpIHtcbiAgICAgICAgY29uc3QgcGVuZGluZ1Jlc3BvbnNlID0gdGhpcy5nZXRQZW5kaW5nUmVzcG9uc2UoZGV0YWlscy5yZXF1ZXN0SWQpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2VCb2R5TGlzdGVuZXIgPSBwZW5kaW5nUmVzcG9uc2UucmVzcG9uc2VCb2R5TGlzdGVuZXI7XG4gICAgICAgICAgICBjb25zdCByZXNwQm9keSA9IGF3YWl0IHJlc3BvbnNlQm9keUxpc3RlbmVyLmdldFJlc3BvbnNlQm9keSgpO1xuICAgICAgICAgICAgY29uc3QgY29udGVudEhhc2ggPSBhd2FpdCByZXNwb25zZUJvZHlMaXN0ZW5lci5nZXRDb250ZW50SGFzaCgpO1xuICAgICAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZUNvbnRlbnQocmVzcEJvZHksIGVzY2FwZVN0cmluZyhjb250ZW50SGFzaCkpO1xuICAgICAgICAgICAgdXBkYXRlLmNvbnRlbnRfaGFzaCA9IGNvbnRlbnRIYXNoO1xuICAgICAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZVJlY29yZChcImh0dHBfcmVzcG9uc2VzXCIsIHVwZGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgIC8vIFRPRE86IFJlZmFjdG9yIHRvIGNvcnJlc3BvbmRpbmcgd2ViZXh0IGxvZ2ljIG9yIGRpc2NhcmRcbiAgICAgICAgICAgIGRhdGFSZWNlaXZlci5sb2dFcnJvcihcbiAgICAgICAgICAgICAgXCJVbmFibGUgdG8gcmV0cmlldmUgcmVzcG9uc2UgYm9keS5cIiArIEpTT04uc3RyaW5naWZ5KGFSZWFzb24pLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHVwZGF0ZS5jb250ZW50X2hhc2ggPSBcIjxlcnJvcj5cIjtcbiAgICAgICAgICAgIGRhdGFSZWNlaXZlci5zYXZlUmVjb3JkKFwiaHR0cF9yZXNwb25zZXNcIiwgdXBkYXRlKTtcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmRhdGFSZWNlaXZlci5sb2dFcnJvcihcIlVuYWJsZSB0byByZXRyaWV2ZSByZXNwb25zZSBib2R5LlwiICtcbiAgICAgICAgICAgICAgICBcIkxpa2VseSBjYXVzZWQgYnkgYSBwcm9ncmFtbWluZyBlcnJvci4gRXJyb3IgTWVzc2FnZTpcIiArXG4gICAgICAgICAgICAgICAgZXJyLm5hbWUgK1xuICAgICAgICAgICAgICAgIGVyci5tZXNzYWdlICtcbiAgICAgICAgICAgICAgICBcIlxcblwiICtcbiAgICAgICAgICAgICAgICBlcnIuc3RhY2spO1xuICAgICAgICAgICAgdXBkYXRlLmNvbnRlbnRfaGFzaCA9IFwiPGVycm9yPlwiO1xuICAgICAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZVJlY29yZChcImh0dHBfcmVzcG9uc2VzXCIsIHVwZGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gSW5zdHJ1bWVudCBIVFRQIHJlc3BvbnNlc1xuICAgIGFzeW5jIG9uQ29tcGxldGVkSGFuZGxlcihkZXRhaWxzLCBjcmF3bElELCBldmVudE9yZGluYWwsIHNhdmVDb250ZW50KSB7XG4gICAgICAgIC8qXG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIFwib25Db21wbGV0ZWRIYW5kbGVyIChwcmV2aW91c2x5IGh0dHBSZXF1ZXN0SGFuZGxlcilcIixcbiAgICAgICAgICBkZXRhaWxzLFxuICAgICAgICAgIGNyYXdsSUQsXG4gICAgICAgICAgc2F2ZUNvbnRlbnQsXG4gICAgICAgICk7XG4gICAgICAgICovXG4gICAgICAgIGNvbnN0IHRhYiA9IGRldGFpbHMudGFiSWQgPiAtMVxuICAgICAgICAgICAgPyBhd2FpdCBicm93c2VyLnRhYnMuZ2V0KGRldGFpbHMudGFiSWQpXG4gICAgICAgICAgICA6IHsgd2luZG93SWQ6IHVuZGVmaW5lZCwgaW5jb2duaXRvOiB1bmRlZmluZWQgfTtcbiAgICAgICAgY29uc3QgdXBkYXRlID0ge307XG4gICAgICAgIHVwZGF0ZS5pbmNvZ25pdG8gPSBib29sVG9JbnQodGFiLmluY29nbml0byk7XG4gICAgICAgIHVwZGF0ZS5icm93c2VyX2lkID0gY3Jhd2xJRDtcbiAgICAgICAgdXBkYXRlLmV4dGVuc2lvbl9zZXNzaW9uX3V1aWQgPSBleHRlbnNpb25TZXNzaW9uVXVpZDtcbiAgICAgICAgdXBkYXRlLmV2ZW50X29yZGluYWwgPSBldmVudE9yZGluYWw7XG4gICAgICAgIHVwZGF0ZS53aW5kb3dfaWQgPSB0YWIud2luZG93SWQ7XG4gICAgICAgIHVwZGF0ZS50YWJfaWQgPSBkZXRhaWxzLnRhYklkO1xuICAgICAgICB1cGRhdGUuZnJhbWVfaWQgPSBkZXRhaWxzLmZyYW1lSWQ7XG4gICAgICAgIC8vIHJlcXVlc3RJZCBpcyBhIHVuaXF1ZSBpZGVudGlmaWVyIHRoYXQgY2FuIGJlIHVzZWQgdG8gbGluayByZXF1ZXN0cyBhbmQgcmVzcG9uc2VzXG4gICAgICAgIHVwZGF0ZS5yZXF1ZXN0X2lkID0gTnVtYmVyKGRldGFpbHMucmVxdWVzdElkKTtcbiAgICAgICAgY29uc3QgaXNDYWNoZWQgPSBkZXRhaWxzLmZyb21DYWNoZTtcbiAgICAgICAgdXBkYXRlLmlzX2NhY2hlZCA9IGJvb2xUb0ludChpc0NhY2hlZCk7XG4gICAgICAgIGNvbnN0IHVybCA9IGRldGFpbHMudXJsO1xuICAgICAgICB1cGRhdGUudXJsID0gZXNjYXBlVXJsKHVybCk7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RNZXRob2QgPSBkZXRhaWxzLm1ldGhvZDtcbiAgICAgICAgdXBkYXRlLm1ldGhvZCA9IGVzY2FwZVN0cmluZyhyZXF1ZXN0TWV0aG9kKTtcbiAgICAgICAgLy8gVE9ETzogUmVmYWN0b3IgdG8gY29ycmVzcG9uZGluZyB3ZWJleHQgbG9naWMgb3IgZGlzY2FyZFxuICAgICAgICAvLyAocmVxdWVzdCBoZWFkZXJzIGFyZSBub3QgYXZhaWxhYmxlIGluIGh0dHAgcmVzcG9uc2UgZXZlbnQgbGlzdGVuZXIgb2JqZWN0LFxuICAgICAgICAvLyBidXQgdGhlIHJlZmVycmVyIHByb3BlcnR5IG9mIHRoZSBjb3JyZXNwb25kaW5nIHJlcXVlc3QgY291bGQgYmUgcXVlcmllZClcbiAgICAgICAgLy9cbiAgICAgICAgLy8gbGV0IHJlZmVycmVyID0gXCJcIjtcbiAgICAgICAgLy8gaWYgKGRldGFpbHMucmVmZXJyZXIpIHtcbiAgICAgICAgLy8gICByZWZlcnJlciA9IGRldGFpbHMucmVmZXJyZXIuc3BlYztcbiAgICAgICAgLy8gfVxuICAgICAgICAvLyB1cGRhdGUucmVmZXJyZXIgPSBlc2NhcGVTdHJpbmcocmVmZXJyZXIpO1xuICAgICAgICBjb25zdCByZXNwb25zZVN0YXR1cyA9IGRldGFpbHMuc3RhdHVzQ29kZTtcbiAgICAgICAgdXBkYXRlLnJlc3BvbnNlX3N0YXR1cyA9IHJlc3BvbnNlU3RhdHVzO1xuICAgICAgICBjb25zdCByZXNwb25zZVN0YXR1c1RleHQgPSBkZXRhaWxzLnN0YXR1c0xpbmU7XG4gICAgICAgIHVwZGF0ZS5yZXNwb25zZV9zdGF0dXNfdGV4dCA9IGVzY2FwZVN0cmluZyhyZXNwb25zZVN0YXR1c1RleHQpO1xuICAgICAgICBjb25zdCBjdXJyZW50X3RpbWUgPSBuZXcgRGF0ZShkZXRhaWxzLnRpbWVTdGFtcCk7XG4gICAgICAgIHVwZGF0ZS50aW1lX3N0YW1wID0gY3VycmVudF90aW1lLnRvSVNPU3RyaW5nKCk7XG4gICAgICAgIGNvbnN0IHBhcnNlZEhlYWRlcnMgPSB0aGlzLmpzb25pZnlIZWFkZXJzKGRldGFpbHMucmVzcG9uc2VIZWFkZXJzKTtcbiAgICAgICAgdXBkYXRlLmhlYWRlcnMgPSBwYXJzZWRIZWFkZXJzLmhlYWRlcnM7XG4gICAgICAgIHVwZGF0ZS5sb2NhdGlvbiA9IHBhcnNlZEhlYWRlcnMubG9jYXRpb247XG4gICAgICAgIGlmICh0aGlzLnNob3VsZFNhdmVDb250ZW50KHNhdmVDb250ZW50LCBkZXRhaWxzLnR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLmxvZ1dpdGhSZXNwb25zZUJvZHkoZGV0YWlscywgdXBkYXRlKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YVJlY2VpdmVyLnNhdmVSZWNvcmQoXCJodHRwX3Jlc3BvbnNlc1wiLCB1cGRhdGUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGpzb25pZnlIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0SGVhZGVycyA9IFtdO1xuICAgICAgICBsZXQgbG9jYXRpb24gPSBcIlwiO1xuICAgICAgICBpZiAoaGVhZGVycykge1xuICAgICAgICAgICAgaGVhZGVycy5tYXAocmVzcG9uc2VIZWFkZXIgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgbmFtZSwgdmFsdWUgfSA9IHJlc3BvbnNlSGVhZGVyO1xuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcl9wYWlyID0gW107XG4gICAgICAgICAgICAgICAgaGVhZGVyX3BhaXIucHVzaChlc2NhcGVTdHJpbmcobmFtZSkpO1xuICAgICAgICAgICAgICAgIGhlYWRlcl9wYWlyLnB1c2goZXNjYXBlU3RyaW5nKHZhbHVlKSk7XG4gICAgICAgICAgICAgICAgcmVzdWx0SGVhZGVycy5wdXNoKGhlYWRlcl9wYWlyKTtcbiAgICAgICAgICAgICAgICBpZiAobmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImxvY2F0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYXRpb24gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaGVhZGVyczogSlNPTi5zdHJpbmdpZnkocmVzdWx0SGVhZGVycyksXG4gICAgICAgICAgICBsb2NhdGlvbjogZXNjYXBlU3RyaW5nKGxvY2F0aW9uKSxcbiAgICAgICAgfTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2lhSFIwY0MxcGJuTjBjblZ0Wlc1MExtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTWlPbHNpTGk0dkxpNHZMaTR2YzNKakwySmhZMnRuY205MWJtUXZhSFIwY0MxcGJuTjBjblZ0Wlc1MExuUnpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSkJRVUZCTEU5QlFVOHNSVUZCUXl4MVFrRkJkVUlzUlVGQlF5eE5RVUZOTEhkRFFVRjNReXhEUVVGRE8wRkJReTlGTEU5QlFVOHNSVUZCUXl4dlFrRkJiMElzUlVGQlF5eE5RVUZOTEN0Q1FVRXJRaXhEUVVGRE8wRkJRMjVGTEU5QlFVOHNSVUZCUXl4alFVRmpMRVZCUVc5Q0xFMUJRVTBzZVVKQlFYbENMRU5CUVVNN1FVRkRNVVVzVDBGQlR5eEZRVUZETEdOQlFXTXNSVUZCUXl4TlFVRk5MSGRDUVVGM1FpeERRVUZETzBGQlEzUkVMRTlCUVU4c1JVRkJReXhsUVVGbExFVkJRVU1zVFVGQlRTeDVRa0ZCZVVJc1EwRkJRenRCUVVONFJDeFBRVUZQTEVWQlFVTXNVMEZCVXl4RlFVRkZMRmxCUVZrc1JVRkJSU3hUUVVGVExFVkJRVU1zVFVGQlRTeHhRa0ZCY1VJc1EwRkJRenRCUVdWMlJUczdPenM3TzBkQlRVYzdRVUZGU0N4TlFVRk5MRkZCUVZFc1IwRkJiVUk3U1VGRE0wSXNVVUZCVVR0SlFVTlNMRmxCUVZrN1NVRkRXaXhOUVVGTk8wbEJRMDRzVDBGQlR6dEpRVU5RTEZWQlFWVTdTVUZEVml4WlFVRlpPMGxCUTFvc1QwRkJUenRKUVVOUUxGRkJRVkU3U1VGRFVpeHRRa0ZCYlVJN1NVRkRia0lzVFVGQlRUdEpRVU5PTEZGQlFWRTdTVUZEVWl4aFFVRmhPMGxCUTJJc1dVRkJXVHRKUVVOYUxGZEJRVmM3U1VGRFdDeGpRVUZqTzBsQlEyUXNWMEZCVnp0SlFVTllMRk5CUVZNN1NVRkRWQ3huUWtGQlowSTdTVUZEYUVJc1RVRkJUVHRKUVVOT0xFOUJRVTg3UTBGRFVpeERRVUZETzBGQlJVNHNUMEZCVHl4RlFVRkZMRkZCUVZFc1JVRkJReXhEUVVGRE8wRkJSVzVDTEUxQlFVMHNUMEZCVHl4alFVRmpPMGxCUTFJc1dVRkJXU3hEUVVGRE8wbEJRM1JDTEdWQlFXVXNSMEZGYmtJc1JVRkJSU3hEUVVGRE8wbEJRME1zWjBKQlFXZENMRWRCUlhCQ0xFVkJRVVVzUTBGQlF6dEpRVU5ETEhWQ1FVRjFRaXhEUVVGRE8wbEJRM2hDTERKQ1FVRXlRaXhEUVVGRE8wbEJRelZDTEhkQ1FVRjNRaXhEUVVGRE8wbEJRM3BDTEcxQ1FVRnRRaXhEUVVGRE8wbEJSVFZDTEZsQlFWa3NXVUZCV1R0UlFVTjBRaXhKUVVGSkxFTkJRVU1zV1VGQldTeEhRVUZITEZsQlFWa3NRMEZCUXp0SlFVTnVReXhEUVVGRE8wbEJSVTBzUjBGQlJ5eERRVUZETEU5QlFVOHNSVUZCUlN4cFFrRkJiME03VVVGSGRFUXNUVUZCVFN4TlFVRk5MRWRCUVd0Q0xFVkJRVVVzU1VGQlNTeEZRVUZGTEVOQlFVTXNXVUZCV1N4RFFVRkRMRVZCUVVVc1MwRkJTeXhGUVVGRkxGRkJRVkVzUlVGQlJTeERRVUZETzFGQlJYaEZMRTFCUVUwc2VVSkJRWGxDTEVkQlFVY3NUMEZCVHl4RFFVRkRMRVZCUVVVN1dVRkRNVU1zVDBGQlR5eERRVU5NTEU5QlFVOHNRMEZCUXl4VFFVRlRMRWxCUVVrc1QwRkJUeXhEUVVGRExGTkJRVk1zUTBGQlF5eFBRVUZQTEVOQlFVTXNhMEpCUVd0Q0xFTkJRVU1zUjBGQlJ5eERRVUZETEVOQlFVTXNRMEZEZUVVc1EwRkJRenRSUVVOS0xFTkJRVU1zUTBGQlF6dFJRVVZHT3p0WFFVVkhPMUZCUlVnc1NVRkJTU3hEUVVGRExIVkNRVUYxUWl4SFFVRkhMRU5CUXpkQ0xFOUJRVGhETEVWQlF6bERMRVZCUVVVN1dVRkRSaXhOUVVGTkxDdENRVUVyUWl4SFFVRnhRaXhGUVVGRkxFTkJRVU03V1VGRE4wUXNjVU5CUVhGRE8xbEJRM0pETEVsQlFVa3NlVUpCUVhsQ0xFTkJRVU1zVDBGQlR5eERRVUZETEVWQlFVVTdaMEpCUTNSRExFOUJRVThzSzBKQlFTdENMRU5CUVVNN1lVRkRlRU03V1VGRFJDeE5RVUZOTEdOQlFXTXNSMEZCUnl4SlFVRkpMRU5CUVVNc2FVSkJRV2xDTEVOQlFVTXNUMEZCVHl4RFFVRkRMRk5CUVZNc1EwRkJReXhEUVVGRE8xbEJRMnBGTEdOQlFXTXNRMEZCUXl4clEwRkJhME1zUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXp0WlFVTXpSQ3hOUVVGTkxHVkJRV1VzUjBGQlJ5eEpRVUZKTEVOQlFVTXNhMEpCUVd0Q0xFTkJRVU1zVDBGQlR5eERRVUZETEZOQlFWTXNRMEZCUXl4RFFVRkRPMWxCUTI1RkxHVkJRV1VzUTBGQlF5eHJRMEZCYTBNc1EwRkJReXhQUVVGUExFTkJRVU1zUTBGQlF6dFpRVU0xUkN4SlFVRkpMRWxCUVVrc1EwRkJReXhwUWtGQmFVSXNRMEZCUXl4cFFrRkJhVUlzUlVGQlJTeFBRVUZQTEVOQlFVTXNTVUZCU1N4RFFVRkRMRVZCUVVVN1owSkJRek5FTEdWQlFXVXNRMEZCUXl3clFrRkJLMElzUTBGQlF5eFBRVUZQTEVOQlFVTXNRMEZCUXp0aFFVTXhSRHRaUVVORUxFOUJRVThzSzBKQlFTdENMRU5CUVVNN1VVRkRla01zUTBGQlF5eERRVUZETzFGQlEwWXNUMEZCVHl4RFFVRkRMRlZCUVZVc1EwRkJReXhsUVVGbExFTkJRVU1zVjBGQlZ5eERRVU0xUXl4SlFVRkpMRU5CUVVNc2RVSkJRWFZDTEVWQlF6VkNMRTFCUVUwc1JVRkRUaXhKUVVGSkxFTkJRVU1zYzBKQlFYTkNMRU5CUVVNc2FVSkJRV2xDTEVOQlFVTTdXVUZETlVNc1EwRkJReXhEUVVGRExFTkJRVU1zWVVGQllTeEZRVUZGTEZWQlFWVXNRMEZCUXp0WlFVTTNRaXhEUVVGRExFTkJRVU1zUTBGQlF5eGhRVUZoTEVOQlFVTXNRMEZEY0VJc1EwRkJRenRSUVVWR0xFbEJRVWtzUTBGQlF5d3lRa0ZCTWtJc1IwRkJSeXhQUVVGUExFTkJRVU1zUlVGQlJUdFpRVU16UXl4eFEwRkJjVU03V1VGRGNrTXNTVUZCU1N4NVFrRkJlVUlzUTBGQlF5eFBRVUZQTEVOQlFVTXNSVUZCUlR0blFrRkRkRU1zVDBGQlR6dGhRVU5TTzFsQlEwUXNUVUZCVFN4alFVRmpMRWRCUVVjc1NVRkJTU3hEUVVGRExHbENRVUZwUWl4RFFVRkRMRTlCUVU4c1EwRkJReXhUUVVGVExFTkJRVU1zUTBGQlF6dFpRVU5xUlN4alFVRmpMRU5CUVVNc2MwTkJRWE5ETEVOQlFVTXNUMEZCVHl4RFFVRkRMRU5CUVVNN1dVRkRMMFFzU1VGQlNTeERRVUZETERCQ1FVRXdRaXhEUVVNM1FpeFBRVUZQTEVWQlExQXNUMEZCVHl4RlFVTlFMSFZDUVVGMVFpeEZRVUZGTEVOQlF6RkNMRU5CUVVNN1VVRkRTaXhEUVVGRExFTkJRVU03VVVGRFJpeFBRVUZQTEVOQlFVTXNWVUZCVlN4RFFVRkRMRzFDUVVGdFFpeERRVUZETEZkQlFWY3NRMEZEYUVRc1NVRkJTU3hEUVVGRExESkNRVUV5UWl4RlFVTm9ReXhOUVVGTkxFVkJRMDRzUTBGQlF5eG5Ra0ZCWjBJc1EwRkJReXhEUVVOdVFpeERRVUZETzFGQlJVWXNTVUZCU1N4RFFVRkRMSGRDUVVGM1FpeEhRVUZITEU5QlFVOHNRMEZCUXl4RlFVRkZPMWxCUTNoRExIRkRRVUZ4UXp0WlFVTnlReXhKUVVGSkxIbENRVUY1UWl4RFFVRkRMRTlCUVU4c1EwRkJReXhGUVVGRk8yZENRVU4wUXl4UFFVRlBPMkZCUTFJN1dVRkRSQ3hKUVVGSkxFTkJRVU1zZFVKQlFYVkNMRU5CUVVNc1QwRkJUeXhGUVVGRkxFOUJRVThzUlVGQlJTeDFRa0ZCZFVJc1JVRkJSU3hEUVVGRExFTkJRVU03VVVGRE5VVXNRMEZCUXl4RFFVRkRPMUZCUTBZc1QwRkJUeXhEUVVGRExGVkJRVlVzUTBGQlF5eG5Ra0ZCWjBJc1EwRkJReXhYUVVGWExFTkJRemRETEVsQlFVa3NRMEZCUXl4M1FrRkJkMElzUlVGRE4wSXNUVUZCVFN4RlFVTk9MRU5CUVVNc2FVSkJRV2xDTEVOQlFVTXNRMEZEY0VJc1EwRkJRenRSUVVWR0xFbEJRVWtzUTBGQlF5eHRRa0ZCYlVJc1IwRkJSeXhQUVVGUExFTkJRVU1zUlVGQlJUdFpRVU51UXl4eFEwRkJjVU03V1VGRGNrTXNTVUZCU1N4NVFrRkJlVUlzUTBGQlF5eFBRVUZQTEVOQlFVTXNSVUZCUlR0blFrRkRkRU1zVDBGQlR6dGhRVU5TTzFsQlEwUXNUVUZCVFN4bFFVRmxMRWRCUVVjc1NVRkJTU3hEUVVGRExHdENRVUZyUWl4RFFVRkRMRTlCUVU4c1EwRkJReXhUUVVGVExFTkJRVU1zUTBGQlF6dFpRVU51UlN4bFFVRmxMRU5CUVVNc09FSkJRVGhDTEVOQlFVTXNUMEZCVHl4RFFVRkRMRU5CUVVNN1dVRkRlRVFzU1VGQlNTeERRVUZETEd0Q1FVRnJRaXhEUVVOeVFpeFBRVUZQTEVWQlExQXNUMEZCVHl4RlFVTlFMSFZDUVVGMVFpeEZRVUZGTEVWQlEzcENMR2xDUVVGcFFpeERRVU5zUWl4RFFVRkRPMUZCUTBvc1EwRkJReXhEUVVGRE8xRkJRMFlzVDBGQlR5eERRVUZETEZWQlFWVXNRMEZCUXl4WFFVRlhMRU5CUVVNc1YwRkJWeXhEUVVONFF5eEpRVUZKTEVOQlFVTXNiVUpCUVcxQ0xFVkJRM2hDTEUxQlFVMHNSVUZEVGl4RFFVRkRMR2xDUVVGcFFpeERRVUZETEVOQlEzQkNMRU5CUVVNN1NVRkRTaXhEUVVGRE8wbEJSVTBzVDBGQlR6dFJRVU5hTEVsQlFVa3NTVUZCU1N4RFFVRkRMSFZDUVVGMVFpeEZRVUZGTzFsQlEyaERMRTlCUVU4c1EwRkJReXhWUVVGVkxFTkJRVU1zWlVGQlpTeERRVUZETEdOQlFXTXNRMEZETDBNc1NVRkJTU3hEUVVGRExIVkNRVUYxUWl4RFFVTTNRaXhEUVVGRE8xTkJRMGc3VVVGRFJDeEpRVUZKTEVsQlFVa3NRMEZCUXl3eVFrRkJNa0lzUlVGQlJUdFpRVU53UXl4UFFVRlBMRU5CUVVNc1ZVRkJWU3hEUVVGRExHMUNRVUZ0UWl4RFFVRkRMR05CUVdNc1EwRkRia1FzU1VGQlNTeERRVUZETERKQ1FVRXlRaXhEUVVOcVF5eERRVUZETzFOQlEwZzdVVUZEUkN4SlFVRkpMRWxCUVVrc1EwRkJReXgzUWtGQmQwSXNSVUZCUlR0WlFVTnFReXhQUVVGUExFTkJRVU1zVlVGQlZTeERRVUZETEdkQ1FVRm5RaXhEUVVGRExHTkJRV01zUTBGRGFFUXNTVUZCU1N4RFFVRkRMSGRDUVVGM1FpeERRVU01UWl4RFFVRkRPMU5CUTBnN1VVRkRSQ3hKUVVGSkxFbEJRVWtzUTBGQlF5eHRRa0ZCYlVJc1JVRkJSVHRaUVVNMVFpeFBRVUZQTEVOQlFVTXNWVUZCVlN4RFFVRkRMRmRCUVZjc1EwRkJReXhqUVVGakxFTkJRVU1zU1VGQlNTeERRVUZETEcxQ1FVRnRRaXhEUVVGRExFTkJRVU03VTBGRGVrVTdTVUZEU0N4RFFVRkRPMGxCUlU4c2MwSkJRWE5DTEVOQlFVTXNhVUpCUVc5RE8xRkJRMnBGTEVsQlFVa3NhVUpCUVdsQ0xFdEJRVXNzU1VGQlNTeEZRVUZGTzFsQlF6bENMRTlCUVU4c1NVRkJTU3hEUVVGRE8xTkJRMkk3VVVGRFJDeEpRVUZKTEdsQ1FVRnBRaXhMUVVGTExFdEJRVXNzUlVGQlJUdFpRVU12UWl4UFFVRlBMRXRCUVVzc1EwRkJRenRUUVVOa08xRkJRMFFzVDBGQlR5eEpRVUZKTEVOQlFVTXNkMEpCUVhkQ0xFTkJRVU1zYVVKQlFXbENMRU5CUVVNc1EwRkJReXhOUVVGTkxFZEJRVWNzUTBGQlF5eERRVUZETzBsQlEzSkZMRU5CUVVNN1NVRkZUeXgzUWtGQmQwSXNRMEZCUXl4cFFrRkJlVUk3VVVGRGVFUXNUMEZCVHl4cFFrRkJhVUlzUTBGQlF5eExRVUZMTEVOQlFVTXNSMEZCUnl4RFFVRnRRaXhEUVVGRE8wbEJRM2hFTEVOQlFVTTdTVUZGUkRzN096czdPMDlCVFVjN1NVRkRTeXhwUWtGQmFVSXNRMEZEZGtJc2FVSkJRVzlETEVWQlEzQkRMRmxCUVRCQ08xRkJSVEZDTEVsQlFVa3NhVUpCUVdsQ0xFdEJRVXNzU1VGQlNTeEZRVUZGTzFsQlF6bENMRTlCUVU4c1NVRkJTU3hEUVVGRE8xTkJRMkk3VVVGRFJDeEpRVUZKTEdsQ1FVRnBRaXhMUVVGTExFdEJRVXNzUlVGQlJUdFpRVU12UWl4UFFVRlBMRXRCUVVzc1EwRkJRenRUUVVOa08xRkJRMFFzVDBGQlR5eEpRVUZKTEVOQlFVTXNkMEpCUVhkQ0xFTkJRVU1zYVVKQlFXbENMRU5CUVVNc1EwRkJReXhSUVVGUkxFTkJRemxFTEZsQlFWa3NRMEZEWWl4RFFVRkRPMGxCUTBvc1EwRkJRenRKUVVWUExHbENRVUZwUWl4RFFVRkRMRk5CUVZNN1VVRkRha01zU1VGQlNTeERRVUZETEVsQlFVa3NRMEZCUXl4bFFVRmxMRU5CUVVNc1UwRkJVeXhEUVVGRExFVkJRVVU3V1VGRGNFTXNTVUZCU1N4RFFVRkRMR1ZCUVdVc1EwRkJReXhUUVVGVExFTkJRVU1zUjBGQlJ5eEpRVUZKTEdOQlFXTXNSVUZCUlN4RFFVRkRPMU5CUTNoRU8xRkJRMFFzVDBGQlR5eEpRVUZKTEVOQlFVTXNaVUZCWlN4RFFVRkRMRk5CUVZNc1EwRkJReXhEUVVGRE8wbEJRM3BETEVOQlFVTTdTVUZGVHl4clFrRkJhMElzUTBGQlF5eFRRVUZUTzFGQlEyeERMRWxCUVVrc1EwRkJReXhKUVVGSkxFTkJRVU1zWjBKQlFXZENMRU5CUVVNc1UwRkJVeXhEUVVGRExFVkJRVVU3V1VGRGNrTXNTVUZCU1N4RFFVRkRMR2RDUVVGblFpeERRVUZETEZOQlFWTXNRMEZCUXl4SFFVRkhMRWxCUVVrc1pVRkJaU3hGUVVGRkxFTkJRVU03VTBGRE1VUTdVVUZEUkN4UFFVRlBMRWxCUVVrc1EwRkJReXhuUWtGQlowSXNRMEZCUXl4VFFVRlRMRU5CUVVNc1EwRkJRenRKUVVNeFF5eERRVUZETzBsQlJVUTdPMDlCUlVjN1NVRkZTeXhMUVVGTExFTkJRVU1zTUVKQlFUQkNMRU5CUTNSRExFOUJRV3RFTEVWQlEyeEVMRTlCUVU4c1JVRkRVQ3haUVVGdlFqdFJRVWR3UWl4TlFVRk5MRWRCUVVjc1IwRkRVQ3hQUVVGUExFTkJRVU1zUzBGQlN5eEhRVUZITEVOQlFVTXNRMEZCUXp0WlFVTm9RaXhEUVVGRExFTkJRVU1zVFVGQlRTeFBRVUZQTEVOQlFVTXNTVUZCU1N4RFFVRkRMRWRCUVVjc1EwRkJReXhQUVVGUExFTkJRVU1zUzBGQlN5eERRVUZETzFsQlEzWkRMRU5CUVVNc1EwRkJReXhGUVVGRkxGRkJRVkVzUlVGQlJTeFRRVUZUTEVWQlFVVXNVMEZCVXl4RlFVRkZMRk5CUVZNc1JVRkJSU3hIUVVGSExFVkJRVVVzVTBGQlV5eEZRVUZGTEVOQlFVTTdVVUZGY0VVc1RVRkJUU3hOUVVGTkxFZEJRVWNzUlVGQmFVSXNRMEZCUXp0UlFVVnFReXhOUVVGTkxFTkJRVU1zVTBGQlV5eEhRVUZITEZOQlFWTXNRMEZCUXl4SFFVRkhMRU5CUVVNc1UwRkJVeXhEUVVGRExFTkJRVU03VVVGRE5VTXNUVUZCVFN4RFFVRkRMRlZCUVZVc1IwRkJSeXhQUVVGUExFTkJRVU03VVVGRE5VSXNUVUZCVFN4RFFVRkRMSE5DUVVGelFpeEhRVUZITEc5Q1FVRnZRaXhEUVVGRE8xRkJRM0pFTEUxQlFVMHNRMEZCUXl4aFFVRmhMRWRCUVVjc1dVRkJXU3hEUVVGRE8xRkJRM0JETEUxQlFVMHNRMEZCUXl4VFFVRlRMRWRCUVVjc1IwRkJSeXhEUVVGRExGRkJRVkVzUTBGQlF6dFJRVU5vUXl4TlFVRk5MRU5CUVVNc1RVRkJUU3hIUVVGSExFOUJRVThzUTBGQlF5eExRVUZMTEVOQlFVTTdVVUZET1VJc1RVRkJUU3hEUVVGRExGRkJRVkVzUjBGQlJ5eFBRVUZQTEVOQlFVTXNUMEZCVHl4RFFVRkRPMUZCUld4RExHMUdRVUZ0Ump0UlFVTnVSaXhOUVVGTkxFTkJRVU1zVlVGQlZTeEhRVUZITEUxQlFVMHNRMEZCUXl4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRExFTkJRVU03VVVGRk9VTXNUVUZCVFN4SFFVRkhMRWRCUVVjc1QwRkJUeXhEUVVGRExFZEJRVWNzUTBGQlF6dFJRVU40UWl4TlFVRk5MRU5CUVVNc1IwRkJSeXhIUVVGSExGTkJRVk1zUTBGQlF5eEhRVUZITEVOQlFVTXNRMEZCUXp0UlFVVTFRaXhOUVVGTkxHRkJRV0VzUjBGQlJ5eFBRVUZQTEVOQlFVTXNUVUZCVFN4RFFVRkRPMUZCUTNKRExFMUJRVTBzUTBGQlF5eE5RVUZOTEVkQlFVY3NXVUZCV1N4RFFVRkRMR0ZCUVdFc1EwRkJReXhEUVVGRE8xRkJSVFZETEUxQlFVMHNXVUZCV1N4SFFVRkhMRWxCUVVrc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF5eFRRVUZUTEVOQlFVTXNRMEZCUXp0UlFVTnFSQ3hOUVVGTkxFTkJRVU1zVlVGQlZTeEhRVUZITEZsQlFWa3NRMEZCUXl4WFFVRlhMRVZCUVVVc1EwRkJRenRSUVVVdlF5eEpRVUZKTEZsQlFWa3NSMEZCUnl4RlFVRkZMRU5CUVVNN1VVRkRkRUlzU1VGQlNTeFJRVUZSTEVkQlFVY3NSVUZCUlN4RFFVRkRPMUZCUTJ4Q0xFMUJRVTBzVDBGQlR5eEhRVUZITEVWQlFVVXNRMEZCUXp0UlFVTnVRaXhKUVVGSkxFMUJRVTBzUjBGQlJ5eExRVUZMTEVOQlFVTTdVVUZEYmtJc1NVRkJTU3hQUVVGUExFTkJRVU1zWTBGQll5eEZRVUZGTzFsQlF6RkNMRTlCUVU4c1EwRkJReXhqUVVGakxFTkJRVU1zUjBGQlJ5eERRVUZETEdGQlFXRXNRMEZCUXl4RlFVRkZPMmRDUVVONlF5eE5RVUZOTEVWQlFVVXNTVUZCU1N4RlFVRkZMRXRCUVVzc1JVRkJSU3hIUVVGSExHRkJRV0VzUTBGQlF6dG5Ra0ZEZEVNc1RVRkJUU3hYUVVGWExFZEJRVWNzUlVGQlJTeERRVUZETzJkQ1FVTjJRaXhYUVVGWExFTkJRVU1zU1VGQlNTeERRVUZETEZsQlFWa3NRMEZCUXl4SlFVRkpMRU5CUVVNc1EwRkJReXhEUVVGRE8yZENRVU55UXl4WFFVRlhMRU5CUVVNc1NVRkJTU3hEUVVGRExGbEJRVmtzUTBGQlF5eExRVUZMTEVOQlFVTXNRMEZCUXl4RFFVRkRPMmRDUVVOMFF5eFBRVUZQTEVOQlFVTXNTVUZCU1N4RFFVRkRMRmRCUVZjc1EwRkJReXhEUVVGRE8yZENRVU14UWl4SlFVRkpMRWxCUVVrc1MwRkJTeXhqUVVGakxFVkJRVVU3YjBKQlF6TkNMRmxCUVZrc1IwRkJSeXhMUVVGTExFTkJRVU03YjBKQlEzSkNMRWxCUVVrc1dVRkJXU3hEUVVGRExFOUJRVThzUTBGQlF5d3dRa0ZCTUVJc1EwRkJReXhMUVVGTExFTkJRVU1zUTBGQlF5eEZRVUZGTzNkQ1FVTXpSQ3hOUVVGTkxFZEJRVWNzU1VGQlNTeERRVUZETzNGQ1FVTm1PMmxDUVVOR08yZENRVU5FTEVsQlFVa3NTVUZCU1N4TFFVRkxMRk5CUVZNc1JVRkJSVHR2UWtGRGRFSXNVVUZCVVN4SFFVRkhMRXRCUVVzc1EwRkJRenRwUWtGRGJFSTdXVUZEU0N4RFFVRkRMRU5CUVVNc1EwRkJRenRUUVVOS08xRkJSVVFzVFVGQlRTeERRVUZETEZGQlFWRXNSMEZCUnl4WlFVRlpMRU5CUVVNc1VVRkJVU3hEUVVGRExFTkJRVU03VVVGRmVrTXNTVUZCU1N4aFFVRmhMRXRCUVVzc1RVRkJUU3hKUVVGSkxFTkJRVU1zVFVGQlRTeERRVUZETEdsRFFVRnBReXhGUVVGRk8xbEJRM3BGTEUxQlFVMHNZMEZCWXl4SFFVRkhMRWxCUVVrc1EwRkJReXhwUWtGQmFVSXNRMEZCUXl4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRExFTkJRVU03V1VGRGFrVXNUVUZCVFN4UlFVRlJMRWRCUVVjc1RVRkJUU3hqUVVGakxFTkJRVU1zY1VKQlFYRkNMRU5CUVVNc1NVRkJTU3hEUVVGRExFTkJRVU03V1VGRGJFVXNTVUZCU1N4RFFVRkRMRkZCUVZFc1JVRkJSVHRuUWtGRFlpeEpRVUZKTEVOQlFVTXNXVUZCV1N4RFFVRkRMRkZCUVZFc1EwRkRlRUlzY1VkQlFYRkhMRU5CUTNSSExFTkJRVU03WVVGRFNEdHBRa0ZCVFR0blFrRkRUQ3hOUVVGTkxESkNRVUV5UWl4SFFVRkhMRTFCUVUwc1kwRkJZeXhEUVVGRExESkNRVUV5UWl4RFFVRkRPMmRDUVVOeVJpeE5RVUZOTEZkQlFWY3NSMEZCUnl3eVFrRkJNa0lzUTBGQlF5eFhRVUZYTEVOQlFVTTdaMEpCUlRWRUxFbEJRVWtzVjBGQlZ5eEZRVUZGTzI5Q1FVTm1MRTFCUVUwc1ZVRkJWU3hIUVVGSExFbEJRVWtzWTBGQll5eERRVU51UXl3eVFrRkJNa0lzUlVGRE0wSXNTVUZCU1N4RFFVRkRMRmxCUVZrc1EwRkRiRUlzUTBGQlF6dHZRa0ZEUml4TlFVRk5MRTlCUVU4c1IwRkJjMElzVlVGQlZTeERRVUZETEdkQ1FVRm5RaXhGUVVGRkxFTkJRVU03YjBKQlJXcEZMR2RFUVVGblJEdHZRa0ZEYUVRc1NVRkJTU3hqUVVGakxFbEJRVWtzVDBGQlR5eEZRVUZGTzNkQ1FVTTNRaXd3UmtGQk1FWTdkMEpCUXpGR0xHMUhRVUZ0Unp0M1FrRkRia2NzVFVGQlRTeGpRVUZqTEVkQlFVYzdORUpCUTNKQ0xHTkJRV003TkVKQlEyUXNjVUpCUVhGQ096UkNRVU55UWl4blFrRkJaMEk3ZVVKQlEycENMRU5CUVVNN2QwSkJRMFlzUzBGQlN5eE5RVUZOTEVsQlFVa3NTVUZCU1N4UFFVRlBMRU5CUVVNc1dVRkJXU3hGUVVGRk96UkNRVU4yUXl4SlFVRkpMR05CUVdNc1EwRkJReXhSUVVGUkxFTkJRVU1zU1VGQlNTeERRVUZETEVWQlFVVTdaME5CUTJwRExFMUJRVTBzVjBGQlZ5eEhRVUZITEVWQlFVVXNRMEZCUXp0blEwRkRka0lzVjBGQlZ5eERRVUZETEVsQlFVa3NRMEZCUXl4WlFVRlpMRU5CUVVNc1NVRkJTU3hEUVVGRExFTkJRVU1zUTBGQlF6dG5RMEZEY2tNc1YwRkJWeXhEUVVGRExFbEJRVWtzUTBGQlF5eFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMRmxCUVZrc1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdaME5CUXpORUxFOUJRVThzUTBGQlF5eEpRVUZKTEVOQlFVTXNWMEZCVnl4RFFVRkRMRU5CUVVNN05rSkJRek5DTzNsQ1FVTkdPM0ZDUVVOR08yOUNRVU5FTEN0R1FVRXJSanR2UWtGREwwWXNTVUZCU1N4WFFVRlhMRWxCUVVrc1QwRkJUeXhGUVVGRk8zZENRVU14UWl4TlFVRk5MRU5CUVVNc1UwRkJVeXhIUVVGSExFOUJRVThzUTBGQlF5eFRRVUZUTEVOQlFVTTdjVUpCUTNSRE8yOUNRVU5FTEVsQlFVa3NaVUZCWlN4SlFVRkpMRTlCUVU4c1JVRkJSVHQzUWtGRE9VSXNUVUZCVFN4RFFVRkRMR0ZCUVdFc1IwRkJSeXhQUVVGUExFTkJRVU1zWVVGQllTeERRVUZETzNGQ1FVTTVRenRwUWtGRFJqdGhRVU5HTzFOQlEwWTdVVUZGUkN4TlFVRk5MRU5CUVVNc1QwRkJUeXhIUVVGSExFbEJRVWtzUTBGQlF5eFRRVUZUTEVOQlFVTXNUMEZCVHl4RFFVRkRMRU5CUVVNN1VVRkZla01zWlVGQlpUdFJRVU5tTEUxQlFVMHNTMEZCU3l4SFFVRkhMRTlCUVU4c1EwRkJReXhKUVVGSkxFdEJRVXNzWjBKQlFXZENMRU5CUVVNN1VVRkRhRVFzVFVGQlRTeERRVUZETEUxQlFVMHNSMEZCUnl4VFFVRlRMRU5CUVVNc1MwRkJTeXhEUVVGRExFTkJRVU03VVVGRmFrTXNOa05CUVRaRE8xRkJRemRETEVsQlFVa3NaMEpCUVdkQ0xFTkJRVU03VVVGRGNrSXNTVUZCU1N4aFFVRmhMRU5CUVVNN1VVRkRiRUlzU1VGQlNTeFBRVUZQTEVOQlFVTXNVMEZCVXl4RlFVRkZPMWxCUTNKQ0xFMUJRVTBzWlVGQlpTeEhRVUZITEVsQlFVa3NSMEZCUnl4RFFVRkRMRTlCUVU4c1EwRkJReXhUUVVGVExFTkJRVU1zUTBGQlF6dFpRVU51UkN4blFrRkJaMElzUjBGQlJ5eGxRVUZsTEVOQlFVTXNUVUZCVFN4RFFVRkRPMU5CUXpORE8xRkJRMFFzU1VGQlNTeFBRVUZQTEVOQlFVTXNWMEZCVnl4RlFVRkZPMWxCUTNaQ0xFMUJRVTBzYVVKQlFXbENMRWRCUVVjc1NVRkJTU3hIUVVGSExFTkJRVU1zVDBGQlR5eERRVUZETEZkQlFWY3NRMEZCUXl4RFFVRkRPMWxCUTNaRUxHRkJRV0VzUjBGQlJ5eHBRa0ZCYVVJc1EwRkJReXhOUVVGTkxFTkJRVU03VTBGRE1VTTdVVUZEUkN4TlFVRk5MRU5CUVVNc2FVSkJRV2xDTEVkQlFVY3NXVUZCV1N4RFFVRkRMR2RDUVVGblFpeERRVUZETEVOQlFVTTdVVUZETVVRc1RVRkJUU3hEUVVGRExHTkJRV01zUjBGQlJ5eFpRVUZaTEVOQlFVTXNZVUZCWVN4RFFVRkRMRU5CUVVNN1VVRkZjRVFzZVVKQlFYbENPMUZCUTNwQ0xIbEZRVUY1UlR0UlFVTjZSU3c0UWtGQk9FSTdVVUZET1VJc1RVRkJUU3hYUVVGWExFZEJRVWNzVDBGQlR5eERRVUZETEZkQlFWY3NRMEZCUXp0UlFVTjRReXhOUVVGTkxFTkJRVU1zV1VGQldTeEhRVUZITEZsQlFWa3NRMEZCUXl4WFFVRlhMRU5CUVVNc1EwRkJRenRSUVVWb1JDeHJSVUZCYTBVN1VVRkRiRVVzYVVaQlFXbEdPMUZCUTJwR0xHbENRVUZwUWp0UlFVTnFRaXh4UjBGQmNVYzdVVUZEY2tjc1RVRkJUU3hEUVVGRExHRkJRV0VzUjBGQlJ5eFBRVUZQTEVOQlFVTXNTVUZCU1N4RFFVRkRPMUZCUlhCRE96czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3VlVFd1EwVTdVVUZEUml4TlFVRk5MRU5CUVVNc1lVRkJZU3hIUVVGSExGTkJRVk1zUTBGQlF5eEpRVUZKTEVOQlFVTXNkMEpCUVhkQ0xFTkJRVU1zVDBGQlR5eERRVUZETEVOQlFVTXNRMEZCUXp0UlFVTjZSU3hOUVVGTkxFTkJRVU1zWlVGQlpTeEhRVUZITEU5QlFVOHNRMEZCUXl4aFFVRmhMRU5CUVVNN1VVRkRMME1zVFVGQlRTeERRVUZETEdWQlFXVXNSMEZCUnl4WlFVRlpMRU5CUTI1RExFbEJRVWtzUTBGQlF5eFRRVUZUTEVOQlFVTXNUMEZCVHl4RFFVRkRMR05CUVdNc1EwRkJReXhEUVVOMlF5eERRVUZETzFGQlEwWXNTVUZCU1N4RFFVRkRMRmxCUVZrc1EwRkJReXhWUVVGVkxFTkJRVU1zWlVGQlpTeEZRVUZGTEUxQlFVMHNRMEZCUXl4RFFVRkRPMGxCUTNoRUxFTkJRVU03U1VGRlJEczdPenM3T3pzN096czdPMDlCV1VjN1NVRkRTeXgzUWtGQmQwSXNRMEZET1VJc1QwRkJhMFE3VVVGRmJFUXNTVUZCU1N4SFFVRkhMRWRCUVVjc1JVRkJSU3hEUVVGRE8xRkJSV0lzU1VGQlNTeFBRVUZQTEVOQlFVTXNTVUZCU1N4TFFVRkxMRmxCUVZrc1JVRkJSVHRaUVVOcVF5eDNRMEZCZDBNN1dVRkRlRU1zUjBGQlJ5eEhRVUZITEU5QlFVOHNRMEZCUXl4SFFVRkhMRU5CUVVNN1UwRkRia0k3WVVGQlRTeEpRVUZKTEU5QlFVOHNRMEZCUXl4alFVRmpMRU5CUVVNc1owSkJRV2RDTEVOQlFVTXNSVUZCUlR0WlFVTnVSQ3hwUlVGQmFVVTdXVUZEYWtVc2MwVkJRWE5GTzFsQlEzUkZMRWRCUVVjc1IwRkJSeXhQUVVGUExFTkJRVU1zWTBGQll5eERRVUZETEUxQlFVMDdaMEpCUTJwRExFTkJRVU1zUTBGQlF5eFBRVUZQTEVOQlFVTXNZMEZCWXl4RFFVRkRMRTlCUVU4c1EwRkJReXhqUVVGakxFTkJRVU1zVFVGQlRTeEhRVUZITEVOQlFVTXNRMEZCUXl4RFFVRkRMRWRCUVVjN1owSkJReTlFTEVOQlFVTXNRMEZCUXl4UFFVRlBMRU5CUVVNc1YwRkJWeXhEUVVGRE8xTkJRM3BDTzJGQlFVMDdXVUZEVEN4MVJFRkJkVVE3V1VGRGRrUXNkMFpCUVhkR08xbEJRM2hHTEVkQlFVY3NSMEZCUnl4UFFVRlBMRU5CUVVNc1YwRkJWeXhEUVVGRE8xTkJRek5DTzFGQlEwUXNUMEZCVHl4SFFVRkhMRU5CUVVNN1NVRkRZaXhEUVVGRE8wbEJSVThzUzBGQlN5eERRVUZETEhWQ1FVRjFRaXhEUVVOdVF5eFBRVUVyUXl4RlFVTXZReXhQUVVGUExFVkJRMUFzV1VGQmIwSTdVVUZGY0VJN096czdPenRWUVUxRk8xRkJSVVlzTkVKQlFUUkNPMUZCUXpWQ0xHbEVRVUZwUkR0UlFVVnFSRHM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN1ZVRXlSRVU3VVVGRlJpeE5RVUZOTEdOQlFXTXNSMEZCUnl4UFFVRlBMRU5CUVVNc1ZVRkJWU3hEUVVGRE8xRkJRekZETEUxQlFVMHNhMEpCUVd0Q0xFZEJRVWNzVDBGQlR5eERRVUZETEZWQlFWVXNRMEZCUXp0UlFVVTVReXhOUVVGTkxFZEJRVWNzUjBGRFVDeFBRVUZQTEVOQlFVTXNTMEZCU3l4SFFVRkhMRU5CUVVNc1EwRkJRenRaUVVOb1FpeERRVUZETEVOQlFVTXNUVUZCVFN4UFFVRlBMRU5CUVVNc1NVRkJTU3hEUVVGRExFZEJRVWNzUTBGQlF5eFBRVUZQTEVOQlFVTXNTMEZCU3l4RFFVRkRPMWxCUTNaRExFTkJRVU1zUTBGQlF5eEZRVUZGTEZGQlFWRXNSVUZCUlN4VFFVRlRMRVZCUVVVc1UwRkJVeXhGUVVGRkxGTkJRVk1zUlVGQlJTeERRVUZETzFGQlEzQkVMRTFCUVUwc1dVRkJXU3hIUVVGcFFqdFpRVU5xUXl4VFFVRlRMRVZCUVVVc1UwRkJVeXhEUVVGRExFZEJRVWNzUTBGQlF5eFRRVUZUTEVOQlFVTTdXVUZEYmtNc1ZVRkJWU3hGUVVGRkxFOUJRVTg3V1VGRGJrSXNaVUZCWlN4RlFVRkZMRk5CUVZNc1EwRkJReXhQUVVGUExFTkJRVU1zUjBGQlJ5eERRVUZETzFsQlEzWkRMR05CUVdNc1JVRkJSU3hQUVVGUExFTkJRVU1zVTBGQlV6dFpRVU5xUXl4bFFVRmxMRVZCUVVVc1UwRkJVeXhEUVVGRExFOUJRVThzUTBGQlF5eFhRVUZYTEVOQlFVTTdXVUZETDBNc1kwRkJZeXhGUVVGRkxFbEJRVWs3V1VGRGNFSXNjMEpCUVhOQ0xFVkJRVVVzYjBKQlFXOUNPMWxCUXpWRExHRkJRV0VzUlVGQlJTeFpRVUZaTzFsQlF6TkNMRk5CUVZNc1JVRkJSU3hIUVVGSExFTkJRVU1zVVVGQlVUdFpRVU4yUWl4TlFVRk5MRVZCUVVVc1QwRkJUeXhEUVVGRExFdEJRVXM3V1VGRGNrSXNVVUZCVVN4RlFVRkZMRTlCUVU4c1EwRkJReXhQUVVGUE8xbEJRM3BDTEdWQlFXVXNSVUZCUlN4alFVRmpPMWxCUXk5Q0xHOUNRVUZ2UWl4RlFVRkZMRmxCUVZrc1EwRkJReXhyUWtGQmEwSXNRMEZCUXp0WlFVTjBSQ3hQUVVGUExFVkJRVVVzU1VGQlNTeERRVUZETEdOQlFXTXNRMEZCUXl4UFFVRlBMRU5CUVVNc1pVRkJaU3hEUVVGRExFTkJRVU1zVDBGQlR6dFpRVU0zUkN4VlFVRlZMRVZCUVVVc1NVRkJTU3hKUVVGSkxFTkJRVU1zVDBGQlR5eERRVUZETEZOQlFWTXNRMEZCUXl4RFFVRkRMRmRCUVZjc1JVRkJSVHRUUVVOMFJDeERRVUZETzFGQlJVWXNTVUZCU1N4RFFVRkRMRmxCUVZrc1EwRkJReXhWUVVGVkxFTkJRVU1zWjBKQlFXZENMRVZCUVVVc1dVRkJXU3hEUVVGRExFTkJRVU03U1VGREwwUXNRMEZCUXp0SlFVVkVPenRQUVVWSE8wbEJSVXNzUzBGQlN5eERRVUZETEcxQ1FVRnRRaXhEUVVNdlFpeFBRVUU0UXl4RlFVTTVReXhOUVVGdlFqdFJRVVZ3UWl4TlFVRk5MR1ZCUVdVc1IwRkJSeXhKUVVGSkxFTkJRVU1zYTBKQlFXdENMRU5CUVVNc1QwRkJUeXhEUVVGRExGTkJRVk1zUTBGQlF5eERRVUZETzFGQlEyNUZMRWxCUVVrN1dVRkRSaXhOUVVGTkxHOUNRVUZ2UWl4SFFVRkhMR1ZCUVdVc1EwRkJReXh2UWtGQmIwSXNRMEZCUXp0WlFVTnNSU3hOUVVGTkxGRkJRVkVzUjBGQlJ5eE5RVUZOTEc5Q1FVRnZRaXhEUVVGRExHVkJRV1VzUlVGQlJTeERRVUZETzFsQlF6bEVMRTFCUVUwc1YwRkJWeXhIUVVGSExFMUJRVTBzYjBKQlFXOUNMRU5CUVVNc1kwRkJZeXhGUVVGRkxFTkJRVU03V1VGRGFFVXNTVUZCU1N4RFFVRkRMRmxCUVZrc1EwRkJReXhYUVVGWExFTkJRVU1zVVVGQlVTeEZRVUZGTEZsQlFWa3NRMEZCUXl4WFFVRlhMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRMjVGTEUxQlFVMHNRMEZCUXl4WlFVRlpMRWRCUVVjc1YwRkJWeXhEUVVGRE8xbEJRMnhETEVsQlFVa3NRMEZCUXl4WlFVRlpMRU5CUVVNc1ZVRkJWU3hEUVVGRExHZENRVUZuUWl4RlFVRkZMRTFCUVUwc1EwRkJReXhEUVVGRE8xTkJRM2hFTzFGQlFVTXNUMEZCVHl4SFFVRkhMRVZCUVVVN1dVRkRXanM3T3pzN096dGpRVTlGTzFsQlEwWXNTVUZCU1N4RFFVRkRMRmxCUVZrc1EwRkJReXhSUVVGUkxFTkJRM2hDTEcxRFFVRnRRenRuUWtGRGFrTXNjMFJCUVhORU8yZENRVU4wUkN4SFFVRkhMRU5CUVVNc1NVRkJTVHRuUWtGRFVpeEhRVUZITEVOQlFVTXNUMEZCVHp0blFrRkRXQ3hKUVVGSk8yZENRVU5LTEVkQlFVY3NRMEZCUXl4TFFVRkxMRU5CUTFvc1EwRkJRenRaUVVOR0xFMUJRVTBzUTBGQlF5eFpRVUZaTEVkQlFVY3NVMEZCVXl4RFFVRkRPMWxCUTJoRExFbEJRVWtzUTBGQlF5eFpRVUZaTEVOQlFVTXNWVUZCVlN4RFFVRkRMR2RDUVVGblFpeEZRVUZGTEUxQlFVMHNRMEZCUXl4RFFVRkRPMU5CUTNoRU8wbEJRMGdzUTBGQlF6dEpRVVZFTERSQ1FVRTBRanRKUVVOd1FpeExRVUZMTEVOQlFVTXNhMEpCUVd0Q0xFTkJRemxDTEU5QlFUQkRMRVZCUXpGRExFOUJRVThzUlVGRFVDeFpRVUZaTEVWQlExb3NWMEZCVnp0UlFVVllPenM3T3pzN08xVkJUMFU3VVVGRlJpeE5RVUZOTEVkQlFVY3NSMEZEVUN4UFFVRlBMRU5CUVVNc1MwRkJTeXhIUVVGSExFTkJRVU1zUTBGQlF6dFpRVU5vUWl4RFFVRkRMRU5CUVVNc1RVRkJUU3hQUVVGUExFTkJRVU1zU1VGQlNTeERRVUZETEVkQlFVY3NRMEZCUXl4UFFVRlBMRU5CUVVNc1MwRkJTeXhEUVVGRE8xbEJRM1pETEVOQlFVTXNRMEZCUXl4RlFVRkZMRkZCUVZFc1JVRkJSU3hUUVVGVExFVkJRVVVzVTBGQlV5eEZRVUZGTEZOQlFWTXNSVUZCUlN4RFFVRkRPMUZCUlhCRUxFMUJRVTBzVFVGQlRTeEhRVUZITEVWQlFXdENMRU5CUVVNN1VVRkZiRU1zVFVGQlRTeERRVUZETEZOQlFWTXNSMEZCUnl4VFFVRlRMRU5CUVVNc1IwRkJSeXhEUVVGRExGTkJRVk1zUTBGQlF5eERRVUZETzFGQlF6VkRMRTFCUVUwc1EwRkJReXhWUVVGVkxFZEJRVWNzVDBGQlR5eERRVUZETzFGQlF6VkNMRTFCUVUwc1EwRkJReXh6UWtGQmMwSXNSMEZCUnl4dlFrRkJiMElzUTBGQlF6dFJRVU55UkN4TlFVRk5MRU5CUVVNc1lVRkJZU3hIUVVGSExGbEJRVmtzUTBGQlF6dFJRVU53UXl4TlFVRk5MRU5CUVVNc1UwRkJVeXhIUVVGSExFZEJRVWNzUTBGQlF5eFJRVUZSTEVOQlFVTTdVVUZEYUVNc1RVRkJUU3hEUVVGRExFMUJRVTBzUjBGQlJ5eFBRVUZQTEVOQlFVTXNTMEZCU3l4RFFVRkRPMUZCUXpsQ0xFMUJRVTBzUTBGQlF5eFJRVUZSTEVkQlFVY3NUMEZCVHl4RFFVRkRMRTlCUVU4c1EwRkJRenRSUVVWc1F5eHRSa0ZCYlVZN1VVRkRia1lzVFVGQlRTeERRVUZETEZWQlFWVXNSMEZCUnl4TlFVRk5MRU5CUVVNc1QwRkJUeXhEUVVGRExGTkJRVk1zUTBGQlF5eERRVUZETzFGQlJUbERMRTFCUVUwc1VVRkJVU3hIUVVGSExFOUJRVThzUTBGQlF5eFRRVUZUTEVOQlFVTTdVVUZEYmtNc1RVRkJUU3hEUVVGRExGTkJRVk1zUjBGQlJ5eFRRVUZUTEVOQlFVTXNVVUZCVVN4RFFVRkRMRU5CUVVNN1VVRkZka01zVFVGQlRTeEhRVUZITEVkQlFVY3NUMEZCVHl4RFFVRkRMRWRCUVVjc1EwRkJRenRSUVVONFFpeE5RVUZOTEVOQlFVTXNSMEZCUnl4SFFVRkhMRk5CUVZNc1EwRkJReXhIUVVGSExFTkJRVU1zUTBGQlF6dFJRVVUxUWl4TlFVRk5MR0ZCUVdFc1IwRkJSeXhQUVVGUExFTkJRVU1zVFVGQlRTeERRVUZETzFGQlEzSkRMRTFCUVUwc1EwRkJReXhOUVVGTkxFZEJRVWNzV1VGQldTeERRVUZETEdGQlFXRXNRMEZCUXl4RFFVRkRPMUZCUlRWRExEQkVRVUV3UkR0UlFVTXhSQ3cyUlVGQk5rVTdVVUZETjBVc01rVkJRVEpGTzFGQlF6TkZMRVZCUVVVN1VVRkRSaXh4UWtGQmNVSTdVVUZEY2tJc01FSkJRVEJDTzFGQlF6RkNMSE5EUVVGelF6dFJRVU4wUXl4SlFVRkpPMUZCUTBvc05FTkJRVFJETzFGQlJUVkRMRTFCUVUwc1kwRkJZeXhIUVVGSExFOUJRVThzUTBGQlF5eFZRVUZWTEVOQlFVTTdVVUZETVVNc1RVRkJUU3hEUVVGRExHVkJRV1VzUjBGQlJ5eGpRVUZqTEVOQlFVTTdVVUZGZUVNc1RVRkJUU3hyUWtGQmEwSXNSMEZCUnl4UFFVRlBMRU5CUVVNc1ZVRkJWU3hEUVVGRE8xRkJRemxETEUxQlFVMHNRMEZCUXl4dlFrRkJiMElzUjBGQlJ5eFpRVUZaTEVOQlFVTXNhMEpCUVd0Q0xFTkJRVU1zUTBGQlF6dFJRVVV2UkN4TlFVRk5MRmxCUVZrc1IwRkJSeXhKUVVGSkxFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNVMEZCVXl4RFFVRkRMRU5CUVVNN1VVRkRha1FzVFVGQlRTeERRVUZETEZWQlFWVXNSMEZCUnl4WlFVRlpMRU5CUVVNc1YwRkJWeXhGUVVGRkxFTkJRVU03VVVGRkwwTXNUVUZCVFN4aFFVRmhMRWRCUVVjc1NVRkJTU3hEUVVGRExHTkJRV01zUTBGQlF5eFBRVUZQTEVOQlFVTXNaVUZCWlN4RFFVRkRMRU5CUVVNN1VVRkRia1VzVFVGQlRTeERRVUZETEU5QlFVOHNSMEZCUnl4aFFVRmhMRU5CUVVNc1QwRkJUeXhEUVVGRE8xRkJRM1pETEUxQlFVMHNRMEZCUXl4UlFVRlJMRWRCUVVjc1lVRkJZU3hEUVVGRExGRkJRVkVzUTBGQlF6dFJRVVY2UXl4SlFVRkpMRWxCUVVrc1EwRkJReXhwUWtGQmFVSXNRMEZCUXl4WFFVRlhMRVZCUVVVc1QwRkJUeXhEUVVGRExFbEJRVWtzUTBGQlF5eEZRVUZGTzFsQlEzSkVMRWxCUVVrc1EwRkJReXh0UWtGQmJVSXNRMEZCUXl4UFFVRlBMRVZCUVVVc1RVRkJUU3hEUVVGRExFTkJRVU03VTBGRE0wTTdZVUZCVFR0WlFVTk1MRWxCUVVrc1EwRkJReXhaUVVGWkxFTkJRVU1zVlVGQlZTeERRVUZETEdkQ1FVRm5RaXhGUVVGRkxFMUJRVTBzUTBGQlF5eERRVUZETzFOQlEzaEVPMGxCUTBnc1EwRkJRenRKUVVWUExHTkJRV01zUTBGQlF5eFBRVUZ2UWp0UlFVTjZReXhOUVVGTkxHRkJRV0VzUjBGQlJ5eEZRVUZGTEVOQlFVTTdVVUZEZWtJc1NVRkJTU3hSUVVGUkxFZEJRVWNzUlVGQlJTeERRVUZETzFGQlEyeENMRWxCUVVrc1QwRkJUeXhGUVVGRk8xbEJRMWdzVDBGQlR5eERRVUZETEVkQlFVY3NRMEZCUXl4alFVRmpMRU5CUVVNc1JVRkJSVHRuUWtGRE0wSXNUVUZCVFN4RlFVRkZMRWxCUVVrc1JVRkJSU3hMUVVGTExFVkJRVVVzUjBGQlJ5eGpRVUZqTEVOQlFVTTdaMEpCUTNaRExFMUJRVTBzVjBGQlZ5eEhRVUZITEVWQlFVVXNRMEZCUXp0blFrRkRka0lzVjBGQlZ5eERRVUZETEVsQlFVa3NRMEZCUXl4WlFVRlpMRU5CUVVNc1NVRkJTU3hEUVVGRExFTkJRVU1zUTBGQlF6dG5Ra0ZEY2tNc1YwRkJWeXhEUVVGRExFbEJRVWtzUTBGQlF5eFpRVUZaTEVOQlFVTXNTMEZCU3l4RFFVRkRMRU5CUVVNc1EwRkJRenRuUWtGRGRFTXNZVUZCWVN4RFFVRkRMRWxCUVVrc1EwRkJReXhYUVVGWExFTkJRVU1zUTBGQlF6dG5Ra0ZEYUVNc1NVRkJTU3hKUVVGSkxFTkJRVU1zVjBGQlZ5eEZRVUZGTEV0QlFVc3NWVUZCVlN4RlFVRkZPMjlDUVVOeVF5eFJRVUZSTEVkQlFVY3NTMEZCU3l4RFFVRkRPMmxDUVVOc1FqdFpRVU5JTEVOQlFVTXNRMEZCUXl4RFFVRkRPMU5CUTBvN1VVRkRSQ3hQUVVGUE8xbEJRMHdzVDBGQlR5eEZRVUZGTEVsQlFVa3NRMEZCUXl4VFFVRlRMRU5CUVVNc1lVRkJZU3hEUVVGRE8xbEJRM1JETEZGQlFWRXNSVUZCUlN4WlFVRlpMRU5CUVVNc1VVRkJVU3hEUVVGRE8xTkJRMnBETEVOQlFVTTdTVUZEU2l4RFFVRkRPME5CUTBZaWZRPT0iLCJpbXBvcnQgeyBpbmNyZW1lbnRlZEV2ZW50T3JkaW5hbCB9IGZyb20gXCIuLi9saWIvZXh0ZW5zaW9uLXNlc3Npb24tZXZlbnQtb3JkaW5hbFwiO1xuaW1wb3J0IHsgZXh0ZW5zaW9uU2Vzc2lvblV1aWQgfSBmcm9tIFwiLi4vbGliL2V4dGVuc2lvbi1zZXNzaW9uLXV1aWRcIjtcbmltcG9ydCB7IGJvb2xUb0ludCwgZXNjYXBlU3RyaW5nLCBlc2NhcGVVcmwgfSBmcm9tIFwiLi4vbGliL3N0cmluZy11dGlsc1wiO1xuZXhwb3J0IGNsYXNzIEphdmFzY3JpcHRJbnN0cnVtZW50IHtcbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyByZWNlaXZlZCBjYWxsIGFuZCB2YWx1ZXMgZGF0YSBmcm9tIHRoZSBKUyBJbnN0cnVtZW50YXRpb25cbiAgICAgKiBpbnRvIHRoZSBmb3JtYXQgdGhhdCB0aGUgc2NoZW1hIGV4cGVjdHMuXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiBAcGFyYW0gc2VuZGVyXG4gICAgICovXG4gICAgc3RhdGljIHByb2Nlc3NDYWxsc0FuZFZhbHVlcyhkYXRhLCBzZW5kZXIpIHtcbiAgICAgICAgY29uc3QgdXBkYXRlID0ge307XG4gICAgICAgIHVwZGF0ZS5leHRlbnNpb25fc2Vzc2lvbl91dWlkID0gZXh0ZW5zaW9uU2Vzc2lvblV1aWQ7XG4gICAgICAgIHVwZGF0ZS5ldmVudF9vcmRpbmFsID0gaW5jcmVtZW50ZWRFdmVudE9yZGluYWwoKTtcbiAgICAgICAgdXBkYXRlLnBhZ2Vfc2NvcGVkX2V2ZW50X29yZGluYWwgPSBkYXRhLm9yZGluYWw7XG4gICAgICAgIHVwZGF0ZS53aW5kb3dfaWQgPSBzZW5kZXIudGFiLndpbmRvd0lkO1xuICAgICAgICB1cGRhdGUudGFiX2lkID0gc2VuZGVyLnRhYi5pZDtcbiAgICAgICAgdXBkYXRlLmZyYW1lX2lkID0gc2VuZGVyLmZyYW1lSWQ7XG4gICAgICAgIHVwZGF0ZS5zY3JpcHRfdXJsID0gZXNjYXBlVXJsKGRhdGEuc2NyaXB0VXJsKTtcbiAgICAgICAgdXBkYXRlLnNjcmlwdF9saW5lID0gZXNjYXBlU3RyaW5nKGRhdGEuc2NyaXB0TGluZSk7XG4gICAgICAgIHVwZGF0ZS5zY3JpcHRfY29sID0gZXNjYXBlU3RyaW5nKGRhdGEuc2NyaXB0Q29sKTtcbiAgICAgICAgdXBkYXRlLmZ1bmNfbmFtZSA9IGVzY2FwZVN0cmluZyhkYXRhLmZ1bmNOYW1lKTtcbiAgICAgICAgdXBkYXRlLnNjcmlwdF9sb2NfZXZhbCA9IGVzY2FwZVN0cmluZyhkYXRhLnNjcmlwdExvY0V2YWwpO1xuICAgICAgICB1cGRhdGUuY2FsbF9zdGFjayA9IGVzY2FwZVN0cmluZyhkYXRhLmNhbGxTdGFjayk7XG4gICAgICAgIHVwZGF0ZS5zeW1ib2wgPSBlc2NhcGVTdHJpbmcoZGF0YS5zeW1ib2wpO1xuICAgICAgICB1cGRhdGUub3BlcmF0aW9uID0gZXNjYXBlU3RyaW5nKGRhdGEub3BlcmF0aW9uKTtcbiAgICAgICAgdXBkYXRlLnZhbHVlID0gZXNjYXBlU3RyaW5nKGRhdGEudmFsdWUpO1xuICAgICAgICB1cGRhdGUudGltZV9zdGFtcCA9IGRhdGEudGltZVN0YW1wO1xuICAgICAgICB1cGRhdGUuaW5jb2duaXRvID0gYm9vbFRvSW50KHNlbmRlci50YWIuaW5jb2duaXRvKTtcbiAgICAgICAgLy8gZG9jdW1lbnRfdXJsIGlzIHRoZSBjdXJyZW50IGZyYW1lJ3MgZG9jdW1lbnQgaHJlZlxuICAgICAgICAvLyB0b3BfbGV2ZWxfdXJsIGlzIHRoZSB0b3AtbGV2ZWwgZnJhbWUncyBkb2N1bWVudCBocmVmXG4gICAgICAgIHVwZGF0ZS5kb2N1bWVudF91cmwgPSBlc2NhcGVVcmwoc2VuZGVyLnVybCk7XG4gICAgICAgIHVwZGF0ZS50b3BfbGV2ZWxfdXJsID0gZXNjYXBlVXJsKHNlbmRlci50YWIudXJsKTtcbiAgICAgICAgaWYgKGRhdGEub3BlcmF0aW9uID09PSBcImNhbGxcIiAmJiBkYXRhLmFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdXBkYXRlLmFyZ3VtZW50cyA9IGVzY2FwZVN0cmluZyhKU09OLnN0cmluZ2lmeShkYXRhLmFyZ3MpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXBkYXRlO1xuICAgIH1cbiAgICBkYXRhUmVjZWl2ZXI7XG4gICAgb25NZXNzYWdlTGlzdGVuZXI7XG4gICAgY29uZmlndXJlZCA9IGZhbHNlO1xuICAgIHBlbmRpbmdSZWNvcmRzID0gW107XG4gICAgY3Jhd2xJRDtcbiAgICBjb25zdHJ1Y3RvcihkYXRhUmVjZWl2ZXIpIHtcbiAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIgPSBkYXRhUmVjZWl2ZXI7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGxpc3RlbmluZyBmb3IgbWVzc2FnZXMgZnJvbSBwYWdlL2NvbnRlbnQvYmFja2dyb3VuZCBzY3JpcHRzIGluamVjdGVkIHRvIGluc3RydW1lbnQgSmF2YVNjcmlwdCBBUElzXG4gICAgICovXG4gICAgbGlzdGVuKCkge1xuICAgICAgICB0aGlzLm9uTWVzc2FnZUxpc3RlbmVyID0gKG1lc3NhZ2UsIHNlbmRlcikgPT4ge1xuICAgICAgICAgICAgaWYgKG1lc3NhZ2UubmFtZXNwYWNlICYmXG4gICAgICAgICAgICAgICAgbWVzc2FnZS5uYW1lc3BhY2UgPT09IFwiamF2YXNjcmlwdC1pbnN0cnVtZW50YXRpb25cIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlSnNJbnN0cnVtZW50YXRpb25NZXNzYWdlKG1lc3NhZ2UsIHNlbmRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIodGhpcy5vbk1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEVpdGhlciBzZW5kcyB0aGUgbG9nIGRhdGEgdG8gdGhlIGRhdGFSZWNlaXZlciBvciBzdG9yZSBpdCBpbiBtZW1vcnlcbiAgICAgKiBhcyBhIHBlbmRpbmcgcmVjb3JkIGlmIHRoZSBKUyBpbnN0cnVtZW50YXRpb24gaXMgbm90IHlldCBjb25maWd1cmVkXG4gICAgICogQHBhcmFtIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0gc2VuZGVyXG4gICAgICovXG4gICAgaGFuZGxlSnNJbnN0cnVtZW50YXRpb25NZXNzYWdlKG1lc3NhZ2UsIHNlbmRlcikge1xuICAgICAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBcImxvZ0NhbGxcIjpcbiAgICAgICAgICAgIGNhc2UgXCJsb2dWYWx1ZVwiOlxuICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZSA9IEphdmFzY3JpcHRJbnN0cnVtZW50LnByb2Nlc3NDYWxsc0FuZFZhbHVlcyhtZXNzYWdlLmRhdGEsIHNlbmRlcik7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY29uZmlndXJlZCkge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGUuYnJvd3Nlcl9pZCA9IHRoaXMuY3Jhd2xJRDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZVJlY29yZChcImphdmFzY3JpcHRcIiwgdXBkYXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGVuZGluZ1JlY29yZHMucHVzaCh1cGRhdGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBTdGFydHMgbGlzdGVuaW5nIGlmIGhhdmVuJ3QgZG9uZSBzbyBhbHJlYWR5LCBzZXRzIHRoZSBjcmF3bCBJRCxcbiAgICAgKiBtYXJrcyB0aGUgSlMgaW5zdHJ1bWVudGF0aW9uIGFzIGNvbmZpZ3VyZWQgYW5kIHNlbmRzIGFueSBwZW5kaW5nXG4gICAgICogcmVjb3JkcyB0aGF0IGhhdmUgYmVlbiByZWNlaXZlZCB1cCB1bnRpbCB0aGlzIHBvaW50LlxuICAgICAqIEBwYXJhbSBjcmF3bElEXG4gICAgICovXG4gICAgcnVuKGNyYXdsSUQpIHtcbiAgICAgICAgaWYgKCF0aGlzLm9uTWVzc2FnZUxpc3RlbmVyKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3Jhd2xJRCA9IGNyYXdsSUQ7XG4gICAgICAgIHRoaXMuY29uZmlndXJlZCA9IHRydWU7XG4gICAgICAgIHRoaXMucGVuZGluZ1JlY29yZHMubWFwKHVwZGF0ZSA9PiB7XG4gICAgICAgICAgICB1cGRhdGUuYnJvd3Nlcl9pZCA9IHRoaXMuY3Jhd2xJRDtcbiAgICAgICAgICAgIHRoaXMuZGF0YVJlY2VpdmVyLnNhdmVSZWNvcmQoXCJqYXZhc2NyaXB0XCIsIHVwZGF0ZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhc3luYyByZWdpc3RlckNvbnRlbnRTY3JpcHQodGVzdGluZywganNJbnN0cnVtZW50YXRpb25TZXR0aW5ncykge1xuICAgICAgICBjb25zdCBjb250ZW50U2NyaXB0Q29uZmlnID0ge1xuICAgICAgICAgICAgdGVzdGluZyxcbiAgICAgICAgICAgIGpzSW5zdHJ1bWVudGF0aW9uU2V0dGluZ3MsXG4gICAgICAgIH07XG4gICAgICAgIGlmIChjb250ZW50U2NyaXB0Q29uZmlnKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBBdm9pZCB1c2luZyB3aW5kb3cgdG8gcGFzcyB0aGUgY29udGVudCBzY3JpcHQgY29uZmlnXG4gICAgICAgICAgICBhd2FpdCBicm93c2VyLmNvbnRlbnRTY3JpcHRzLnJlZ2lzdGVyKHtcbiAgICAgICAgICAgICAgICBqczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBgd2luZG93Lm9wZW5XcG1Db250ZW50U2NyaXB0Q29uZmlnID0gJHtKU09OLnN0cmluZ2lmeShjb250ZW50U2NyaXB0Q29uZmlnKX07YCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIG1hdGNoZXM6IFtcIjxhbGxfdXJscz5cIl0sXG4gICAgICAgICAgICAgICAgYWxsRnJhbWVzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJ1bkF0OiBcImRvY3VtZW50X3N0YXJ0XCIsXG4gICAgICAgICAgICAgICAgbWF0Y2hBYm91dEJsYW5rOiB0cnVlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJyb3dzZXIuY29udGVudFNjcmlwdHMucmVnaXN0ZXIoe1xuICAgICAgICAgICAganM6IFt7IGZpbGU6IFwiL2NvbnRlbnQuanNcIiB9XSxcbiAgICAgICAgICAgIG1hdGNoZXM6IFtcIjxhbGxfdXJscz5cIl0sXG4gICAgICAgICAgICBhbGxGcmFtZXM6IHRydWUsXG4gICAgICAgICAgICBydW5BdDogXCJkb2N1bWVudF9zdGFydFwiLFxuICAgICAgICAgICAgbWF0Y2hBYm91dEJsYW5rOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgY2xlYW51cCgpIHtcbiAgICAgICAgdGhpcy5wZW5kaW5nUmVjb3JkcyA9IFtdO1xuICAgICAgICBpZiAodGhpcy5vbk1lc3NhZ2VMaXN0ZW5lcikge1xuICAgICAgICAgICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcih0aGlzLm9uTWVzc2FnZUxpc3RlbmVyKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWFtRjJZWE5qY21sd2RDMXBibk4wY25WdFpXNTBMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE1pT2xzaUxpNHZMaTR2TGk0dmMzSmpMMkpoWTJ0bmNtOTFibVF2YW1GMllYTmpjbWx3ZEMxcGJuTjBjblZ0Wlc1MExuUnpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSkJRVU5CTEU5QlFVOHNSVUZCUXl4MVFrRkJkVUlzUlVGQlF5eE5RVUZOTEhkRFFVRjNReXhEUVVGRE8wRkJReTlGTEU5QlFVOHNSVUZCUXl4dlFrRkJiMElzUlVGQlF5eE5RVUZOTEN0Q1FVRXJRaXhEUVVGRE8wRkJRMjVGTEU5QlFVOHNSVUZCUXl4VFFVRlRMRVZCUVVVc1dVRkJXU3hGUVVGRkxGTkJRVk1zUlVGQlF5eE5RVUZOTEhGQ1FVRnhRaXhEUVVGRE8wRkJSM1pGTEUxQlFVMHNUMEZCVHl4dlFrRkJiMEk3U1VGREwwSTdPenM3TzA5QlMwYzdTVUZEU3l4TlFVRk5MRU5CUVVNc2NVSkJRWEZDTEVOQlFVTXNTVUZCU1N4RlFVRkZMRTFCUVhGQ08xRkJRemxFTEUxQlFVMHNUVUZCVFN4SFFVRkhMRVZCUVhsQ0xFTkJRVU03VVVGRGVrTXNUVUZCVFN4RFFVRkRMSE5DUVVGelFpeEhRVUZITEc5Q1FVRnZRaXhEUVVGRE8xRkJRM0pFTEUxQlFVMHNRMEZCUXl4aFFVRmhMRWRCUVVjc2RVSkJRWFZDTEVWQlFVVXNRMEZCUXp0UlFVTnFSQ3hOUVVGTkxFTkJRVU1zZVVKQlFYbENMRWRCUVVjc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF6dFJRVU5vUkN4TlFVRk5MRU5CUVVNc1UwRkJVeXhIUVVGSExFMUJRVTBzUTBGQlF5eEhRVUZITEVOQlFVTXNVVUZCVVN4RFFVRkRPMUZCUTNaRExFMUJRVTBzUTBGQlF5eE5RVUZOTEVkQlFVY3NUVUZCVFN4RFFVRkRMRWRCUVVjc1EwRkJReXhGUVVGRkxFTkJRVU03VVVGRE9VSXNUVUZCVFN4RFFVRkRMRkZCUVZFc1IwRkJSeXhOUVVGTkxFTkJRVU1zVDBGQlR5eERRVUZETzFGQlEycERMRTFCUVUwc1EwRkJReXhWUVVGVkxFZEJRVWNzVTBGQlV5eERRVUZETEVsQlFVa3NRMEZCUXl4VFFVRlRMRU5CUVVNc1EwRkJRenRSUVVNNVF5eE5RVUZOTEVOQlFVTXNWMEZCVnl4SFFVRkhMRmxCUVZrc1EwRkJReXhKUVVGSkxFTkJRVU1zVlVGQlZTeERRVUZETEVOQlFVTTdVVUZEYmtRc1RVRkJUU3hEUVVGRExGVkJRVlVzUjBGQlJ5eFpRVUZaTEVOQlFVTXNTVUZCU1N4RFFVRkRMRk5CUVZNc1EwRkJReXhEUVVGRE8xRkJRMnBFTEUxQlFVMHNRMEZCUXl4VFFVRlRMRWRCUVVjc1dVRkJXU3hEUVVGRExFbEJRVWtzUTBGQlF5eFJRVUZSTEVOQlFVTXNRMEZCUXp0UlFVTXZReXhOUVVGTkxFTkJRVU1zWlVGQlpTeEhRVUZITEZsQlFWa3NRMEZCUXl4SlFVRkpMRU5CUVVNc1lVRkJZU3hEUVVGRExFTkJRVU03VVVGRE1VUXNUVUZCVFN4RFFVRkRMRlZCUVZVc1IwRkJSeXhaUVVGWkxFTkJRVU1zU1VGQlNTeERRVUZETEZOQlFWTXNRMEZCUXl4RFFVRkRPMUZCUTJwRUxFMUJRVTBzUTBGQlF5eE5RVUZOTEVkQlFVY3NXVUZCV1N4RFFVRkRMRWxCUVVrc1EwRkJReXhOUVVGTkxFTkJRVU1zUTBGQlF6dFJRVU14UXl4TlFVRk5MRU5CUVVNc1UwRkJVeXhIUVVGSExGbEJRVmtzUTBGQlF5eEpRVUZKTEVOQlFVTXNVMEZCVXl4RFFVRkRMRU5CUVVNN1VVRkRhRVFzVFVGQlRTeERRVUZETEV0QlFVc3NSMEZCUnl4WlFVRlpMRU5CUVVNc1NVRkJTU3hEUVVGRExFdEJRVXNzUTBGQlF5eERRVUZETzFGQlEzaERMRTFCUVUwc1EwRkJReXhWUVVGVkxFZEJRVWNzU1VGQlNTeERRVUZETEZOQlFWTXNRMEZCUXp0UlFVTnVReXhOUVVGTkxFTkJRVU1zVTBGQlV5eEhRVUZITEZOQlFWTXNRMEZCUXl4TlFVRk5MRU5CUVVNc1IwRkJSeXhEUVVGRExGTkJRVk1zUTBGQlF5eERRVUZETzFGQlJXNUVMRzlFUVVGdlJEdFJRVU53UkN4MVJFRkJkVVE3VVVGRGRrUXNUVUZCVFN4RFFVRkRMRmxCUVZrc1IwRkJSeXhUUVVGVExFTkJRVU1zVFVGQlRTeERRVUZETEVkQlFVY3NRMEZCUXl4RFFVRkRPMUZCUXpWRExFMUJRVTBzUTBGQlF5eGhRVUZoTEVkQlFVY3NVMEZCVXl4RFFVRkRMRTFCUVUwc1EwRkJReXhIUVVGSExFTkJRVU1zUjBGQlJ5eERRVUZETEVOQlFVTTdVVUZGYWtRc1NVRkJTU3hKUVVGSkxFTkJRVU1zVTBGQlV5eExRVUZMTEUxQlFVMHNTVUZCU1N4SlFVRkpMRU5CUVVNc1NVRkJTU3hEUVVGRExFMUJRVTBzUjBGQlJ5eERRVUZETEVWQlFVVTdXVUZEY2tRc1RVRkJUU3hEUVVGRExGTkJRVk1zUjBGQlJ5eFpRVUZaTEVOQlFVTXNTVUZCU1N4RFFVRkRMRk5CUVZNc1EwRkJReXhKUVVGSkxFTkJRVU1zU1VGQlNTeERRVUZETEVOQlFVTXNRMEZCUXp0VFFVTTFSRHRSUVVWRUxFOUJRVThzVFVGQlRTeERRVUZETzBsQlEyaENMRU5CUVVNN1NVRkRaMElzV1VGQldTeERRVUZETzBsQlEzUkNMR2xDUVVGcFFpeERRVUZETzBsQlEyeENMRlZCUVZVc1IwRkJXU3hMUVVGTExFTkJRVU03U1VGRE5VSXNZMEZCWXl4SFFVRXdRaXhGUVVGRkxFTkJRVU03U1VGRE0wTXNUMEZCVHl4RFFVRkRPMGxCUldoQ0xGbEJRVmtzV1VGQldUdFJRVU4wUWl4SlFVRkpMRU5CUVVNc1dVRkJXU3hIUVVGSExGbEJRVmtzUTBGQlF6dEpRVU51UXl4RFFVRkRPMGxCUlVRN08wOUJSVWM3U1VGRFNTeE5RVUZOTzFGQlExZ3NTVUZCU1N4RFFVRkRMR2xDUVVGcFFpeEhRVUZITEVOQlFVTXNUMEZCVHl4RlFVRkZMRTFCUVUwc1JVRkJSU3hGUVVGRk8xbEJRek5ETEVsQlEwVXNUMEZCVHl4RFFVRkRMRk5CUVZNN1owSkJRMnBDTEU5QlFVOHNRMEZCUXl4VFFVRlRMRXRCUVVzc05FSkJRVFJDTEVWQlEyeEVPMmRDUVVOQkxFbEJRVWtzUTBGQlF5dzRRa0ZCT0VJc1EwRkJReXhQUVVGUExFVkJRVVVzVFVGQlRTeERRVUZETEVOQlFVTTdZVUZEZEVRN1VVRkRTQ3hEUVVGRExFTkJRVU03VVVGRFJpeFBRVUZQTEVOQlFVTXNUMEZCVHl4RFFVRkRMRk5CUVZNc1EwRkJReXhYUVVGWExFTkJRVU1zU1VGQlNTeERRVUZETEdsQ1FVRnBRaXhEUVVGRExFTkJRVU03U1VGRGFFVXNRMEZCUXp0SlFVVkVPenM3T3p0UFFVdEhPMGxCUTBrc09FSkJRVGhDTEVOQlFVTXNUMEZCVHl4RlFVRkZMRTFCUVhGQ08xRkJRMnhGTEZGQlFWRXNUMEZCVHl4RFFVRkRMRWxCUVVrc1JVRkJSVHRaUVVOd1FpeExRVUZMTEZOQlFWTXNRMEZCUXp0WlFVTm1MRXRCUVVzc1ZVRkJWVHRuUWtGRFlpeE5RVUZOTEUxQlFVMHNSMEZCUnl4dlFrRkJiMElzUTBGQlF5eHhRa0ZCY1VJc1EwRkRka1FzVDBGQlR5eERRVUZETEVsQlFVa3NSVUZEV2l4TlFVRk5MRU5CUTFBc1EwRkJRenRuUWtGRFJpeEpRVUZKTEVsQlFVa3NRMEZCUXl4VlFVRlZMRVZCUVVVN2IwSkJRMjVDTEUxQlFVMHNRMEZCUXl4VlFVRlZMRWRCUVVjc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF6dHZRa0ZEYWtNc1NVRkJTU3hEUVVGRExGbEJRVmtzUTBGQlF5eFZRVUZWTEVOQlFVTXNXVUZCV1N4RlFVRkZMRTFCUVUwc1EwRkJReXhEUVVGRE8ybENRVU53UkR0eFFrRkJUVHR2UWtGRFRDeEpRVUZKTEVOQlFVTXNZMEZCWXl4RFFVRkRMRWxCUVVrc1EwRkJReXhOUVVGTkxFTkJRVU1zUTBGQlF6dHBRa0ZEYkVNN1owSkJRMFFzVFVGQlRUdFRRVU5VTzBsQlEwZ3NRMEZCUXp0SlFVVkVPenM3T3p0UFFVdEhPMGxCUTBrc1IwRkJSeXhEUVVGRExFOUJRVTg3VVVGRGFFSXNTVUZCU1N4RFFVRkRMRWxCUVVrc1EwRkJReXhwUWtGQmFVSXNSVUZCUlR0WlFVTXpRaXhKUVVGSkxFTkJRVU1zVFVGQlRTeEZRVUZGTEVOQlFVTTdVMEZEWmp0UlFVTkVMRWxCUVVrc1EwRkJReXhQUVVGUExFZEJRVWNzVDBGQlR5eERRVUZETzFGQlEzWkNMRWxCUVVrc1EwRkJReXhWUVVGVkxFZEJRVWNzU1VGQlNTeERRVUZETzFGQlEzWkNMRWxCUVVrc1EwRkJReXhqUVVGakxFTkJRVU1zUjBGQlJ5eERRVUZETEUxQlFVMHNRMEZCUXl4RlFVRkZPMWxCUXk5Q0xFMUJRVTBzUTBGQlF5eFZRVUZWTEVkQlFVY3NTVUZCU1N4RFFVRkRMRTlCUVU4c1EwRkJRenRaUVVOcVF5eEpRVUZKTEVOQlFVTXNXVUZCV1N4RFFVRkRMRlZCUVZVc1EwRkJReXhaUVVGWkxFVkJRVVVzVFVGQlRTeERRVUZETEVOQlFVTTdVVUZEY2tRc1EwRkJReXhEUVVGRExFTkJRVU03U1VGRFRDeERRVUZETzBsQlJVMHNTMEZCU3l4RFFVRkRMSEZDUVVGeFFpeERRVU5vUXl4UFFVRm5RaXhGUVVOb1FpeDVRa0ZCYVVNN1VVRkZha01zVFVGQlRTeHRRa0ZCYlVJc1IwRkJSenRaUVVNeFFpeFBRVUZQTzFsQlExQXNlVUpCUVhsQ08xTkJRekZDTEVOQlFVTTdVVUZEUml4SlFVRkpMRzFDUVVGdFFpeEZRVUZGTzFsQlEzWkNMRFpFUVVFMlJEdFpRVU0zUkN4TlFVRk5MRTlCUVU4c1EwRkJReXhqUVVGakxFTkJRVU1zVVVGQlVTeERRVUZETzJkQ1FVTndReXhGUVVGRkxFVkJRVVU3YjBKQlEwWTdkMEpCUTBVc1NVRkJTU3hGUVVGRkxIVkRRVUYxUXl4SlFVRkpMRU5CUVVNc1UwRkJVeXhEUVVONlJDeHRRa0ZCYlVJc1EwRkRjRUlzUjBGQlJ6dHhRa0ZEVER0cFFrRkRSanRuUWtGRFJDeFBRVUZQTEVWQlFVVXNRMEZCUXl4WlFVRlpMRU5CUVVNN1owSkJRM1pDTEZOQlFWTXNSVUZCUlN4SlFVRkpPMmRDUVVObUxFdEJRVXNzUlVGQlJTeG5Ra0ZCWjBJN1owSkJRM1pDTEdWQlFXVXNSVUZCUlN4SlFVRkpPMkZCUTNSQ0xFTkJRVU1zUTBGQlF6dFRRVU5LTzFGQlEwUXNUMEZCVHl4UFFVRlBMRU5CUVVNc1kwRkJZeXhEUVVGRExGRkJRVkVzUTBGQlF6dFpRVU55UXl4RlFVRkZMRVZCUVVVc1EwRkJReXhGUVVGRkxFbEJRVWtzUlVGQlJTeGhRVUZoTEVWQlFVVXNRMEZCUXp0WlFVTTNRaXhQUVVGUExFVkJRVVVzUTBGQlF5eFpRVUZaTEVOQlFVTTdXVUZEZGtJc1UwRkJVeXhGUVVGRkxFbEJRVWs3V1VGRFppeExRVUZMTEVWQlFVVXNaMEpCUVdkQ08xbEJRM1pDTEdWQlFXVXNSVUZCUlN4SlFVRkpPMU5CUTNSQ0xFTkJRVU1zUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZGVFN4UFFVRlBPMUZCUTFvc1NVRkJTU3hEUVVGRExHTkJRV01zUjBGQlJ5eEZRVUZGTEVOQlFVTTdVVUZEZWtJc1NVRkJTU3hKUVVGSkxFTkJRVU1zYVVKQlFXbENMRVZCUVVVN1dVRkRNVUlzVDBGQlR5eERRVUZETEU5QlFVOHNRMEZCUXl4VFFVRlRMRU5CUVVNc1kwRkJZeXhEUVVGRExFbEJRVWtzUTBGQlF5eHBRa0ZCYVVJc1EwRkJReXhEUVVGRE8xTkJRMnhGTzBsQlEwZ3NRMEZCUXp0RFFVTkdJbjA9IiwiaW1wb3J0IHsgaW5jcmVtZW50ZWRFdmVudE9yZGluYWwgfSBmcm9tIFwiLi4vbGliL2V4dGVuc2lvbi1zZXNzaW9uLWV2ZW50LW9yZGluYWxcIjtcbmltcG9ydCB7IGV4dGVuc2lvblNlc3Npb25VdWlkIH0gZnJvbSBcIi4uL2xpYi9leHRlbnNpb24tc2Vzc2lvbi11dWlkXCI7XG5pbXBvcnQgeyBQZW5kaW5nTmF2aWdhdGlvbiB9IGZyb20gXCIuLi9saWIvcGVuZGluZy1uYXZpZ2F0aW9uXCI7XG5pbXBvcnQgeyBib29sVG9JbnQsIGVzY2FwZVN0cmluZywgZXNjYXBlVXJsIH0gZnJvbSBcIi4uL2xpYi9zdHJpbmctdXRpbHNcIjtcbmltcG9ydCB7IG1ha2VVVUlEIH0gZnJvbSBcIi4uL2xpYi91dWlkXCI7XG5leHBvcnQgY29uc3QgdHJhbnNmb3JtV2ViTmF2aWdhdGlvbkJhc2VFdmVudERldGFpbHNUb09wZW5XUE1TY2hlbWEgPSBhc3luYyAoY3Jhd2xJRCwgZGV0YWlscykgPT4ge1xuICAgIGNvbnN0IHRhYiA9IGRldGFpbHMudGFiSWQgPiAtMVxuICAgICAgICA/IGF3YWl0IGJyb3dzZXIudGFicy5nZXQoZGV0YWlscy50YWJJZClcbiAgICAgICAgOiB7XG4gICAgICAgICAgICB3aW5kb3dJZDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgaW5jb2duaXRvOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBjb29raWVTdG9yZUlkOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBvcGVuZXJUYWJJZDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgd2lkdGg6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGhlaWdodDogdW5kZWZpbmVkLFxuICAgICAgICB9O1xuICAgIGNvbnN0IHdpbmRvdyA9IHRhYi53aW5kb3dJZFxuICAgICAgICA/IGF3YWl0IGJyb3dzZXIud2luZG93cy5nZXQodGFiLndpbmRvd0lkKVxuICAgICAgICA6IHsgd2lkdGg6IHVuZGVmaW5lZCwgaGVpZ2h0OiB1bmRlZmluZWQsIHR5cGU6IHVuZGVmaW5lZCB9O1xuICAgIGNvbnN0IG5hdmlnYXRpb24gPSB7XG4gICAgICAgIGJyb3dzZXJfaWQ6IGNyYXdsSUQsXG4gICAgICAgIGluY29nbml0bzogYm9vbFRvSW50KHRhYi5pbmNvZ25pdG8pLFxuICAgICAgICBleHRlbnNpb25fc2Vzc2lvbl91dWlkOiBleHRlbnNpb25TZXNzaW9uVXVpZCxcbiAgICAgICAgcHJvY2Vzc19pZDogZGV0YWlscy5wcm9jZXNzSWQsXG4gICAgICAgIHdpbmRvd19pZDogdGFiLndpbmRvd0lkLFxuICAgICAgICB0YWJfaWQ6IGRldGFpbHMudGFiSWQsXG4gICAgICAgIHRhYl9vcGVuZXJfdGFiX2lkOiB0YWIub3BlbmVyVGFiSWQsXG4gICAgICAgIGZyYW1lX2lkOiBkZXRhaWxzLmZyYW1lSWQsXG4gICAgICAgIHdpbmRvd193aWR0aDogd2luZG93LndpZHRoLFxuICAgICAgICB3aW5kb3dfaGVpZ2h0OiB3aW5kb3cuaGVpZ2h0LFxuICAgICAgICB3aW5kb3dfdHlwZTogd2luZG93LnR5cGUsXG4gICAgICAgIHRhYl93aWR0aDogdGFiLndpZHRoLFxuICAgICAgICB0YWJfaGVpZ2h0OiB0YWIuaGVpZ2h0LFxuICAgICAgICB0YWJfY29va2llX3N0b3JlX2lkOiBlc2NhcGVTdHJpbmcodGFiLmNvb2tpZVN0b3JlSWQpLFxuICAgICAgICB1dWlkOiBtYWtlVVVJRCgpLFxuICAgICAgICB1cmw6IGVzY2FwZVVybChkZXRhaWxzLnVybCksXG4gICAgfTtcbiAgICByZXR1cm4gbmF2aWdhdGlvbjtcbn07XG5leHBvcnQgY2xhc3MgTmF2aWdhdGlvbkluc3RydW1lbnQge1xuICAgIHN0YXRpYyBuYXZpZ2F0aW9uSWQocHJvY2Vzc0lkLCB0YWJJZCwgZnJhbWVJZCkge1xuICAgICAgICByZXR1cm4gYCR7cHJvY2Vzc0lkfS0ke3RhYklkfS0ke2ZyYW1lSWR9YDtcbiAgICB9XG4gICAgZGF0YVJlY2VpdmVyO1xuICAgIG9uQmVmb3JlTmF2aWdhdGVMaXN0ZW5lcjtcbiAgICBvbkNvbW1pdHRlZExpc3RlbmVyO1xuICAgIHBlbmRpbmdOYXZpZ2F0aW9ucyA9IHt9O1xuICAgIGNvbnN0cnVjdG9yKGRhdGFSZWNlaXZlcikge1xuICAgICAgICB0aGlzLmRhdGFSZWNlaXZlciA9IGRhdGFSZWNlaXZlcjtcbiAgICB9XG4gICAgcnVuKGNyYXdsSUQpIHtcbiAgICAgICAgdGhpcy5vbkJlZm9yZU5hdmlnYXRlTGlzdGVuZXIgPSBhc3luYyAoZGV0YWlscykgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmF2aWdhdGlvbklkID0gTmF2aWdhdGlvbkluc3RydW1lbnQubmF2aWdhdGlvbklkKGRldGFpbHMucHJvY2Vzc0lkLCBkZXRhaWxzLnRhYklkLCBkZXRhaWxzLmZyYW1lSWQpO1xuICAgICAgICAgICAgY29uc3QgcGVuZGluZ05hdmlnYXRpb24gPSB0aGlzLmluc3RhbnRpYXRlUGVuZGluZ05hdmlnYXRpb24obmF2aWdhdGlvbklkKTtcbiAgICAgICAgICAgIGNvbnN0IG5hdmlnYXRpb24gPSBhd2FpdCB0cmFuc2Zvcm1XZWJOYXZpZ2F0aW9uQmFzZUV2ZW50RGV0YWlsc1RvT3BlbldQTVNjaGVtYShjcmF3bElELCBkZXRhaWxzKTtcbiAgICAgICAgICAgIG5hdmlnYXRpb24ucGFyZW50X2ZyYW1lX2lkID0gZGV0YWlscy5wYXJlbnRGcmFtZUlkO1xuICAgICAgICAgICAgbmF2aWdhdGlvbi5iZWZvcmVfbmF2aWdhdGVfZXZlbnRfb3JkaW5hbCA9IGluY3JlbWVudGVkRXZlbnRPcmRpbmFsKCk7XG4gICAgICAgICAgICBuYXZpZ2F0aW9uLmJlZm9yZV9uYXZpZ2F0ZV90aW1lX3N0YW1wID0gbmV3IERhdGUoZGV0YWlscy50aW1lU3RhbXApLnRvSVNPU3RyaW5nKCk7XG4gICAgICAgICAgICBwZW5kaW5nTmF2aWdhdGlvbi5yZXNvbHZlT25CZWZvcmVOYXZpZ2F0ZUV2ZW50TmF2aWdhdGlvbihuYXZpZ2F0aW9uKTtcbiAgICAgICAgfTtcbiAgICAgICAgYnJvd3Nlci53ZWJOYXZpZ2F0aW9uLm9uQmVmb3JlTmF2aWdhdGUuYWRkTGlzdGVuZXIodGhpcy5vbkJlZm9yZU5hdmlnYXRlTGlzdGVuZXIpO1xuICAgICAgICB0aGlzLm9uQ29tbWl0dGVkTGlzdGVuZXIgPSBhc3luYyAoZGV0YWlscykgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmF2aWdhdGlvbklkID0gTmF2aWdhdGlvbkluc3RydW1lbnQubmF2aWdhdGlvbklkKGRldGFpbHMucHJvY2Vzc0lkLCBkZXRhaWxzLnRhYklkLCBkZXRhaWxzLmZyYW1lSWQpO1xuICAgICAgICAgICAgY29uc3QgbmF2aWdhdGlvbiA9IGF3YWl0IHRyYW5zZm9ybVdlYk5hdmlnYXRpb25CYXNlRXZlbnREZXRhaWxzVG9PcGVuV1BNU2NoZW1hKGNyYXdsSUQsIGRldGFpbHMpO1xuICAgICAgICAgICAgbmF2aWdhdGlvbi50cmFuc2l0aW9uX3F1YWxpZmllcnMgPSBlc2NhcGVTdHJpbmcoSlNPTi5zdHJpbmdpZnkoZGV0YWlscy50cmFuc2l0aW9uUXVhbGlmaWVycykpO1xuICAgICAgICAgICAgbmF2aWdhdGlvbi50cmFuc2l0aW9uX3R5cGUgPSBlc2NhcGVTdHJpbmcoZGV0YWlscy50cmFuc2l0aW9uVHlwZSk7XG4gICAgICAgICAgICBuYXZpZ2F0aW9uLmNvbW1pdHRlZF9ldmVudF9vcmRpbmFsID0gaW5jcmVtZW50ZWRFdmVudE9yZGluYWwoKTtcbiAgICAgICAgICAgIG5hdmlnYXRpb24uY29tbWl0dGVkX3RpbWVfc3RhbXAgPSBuZXcgRGF0ZShkZXRhaWxzLnRpbWVTdGFtcCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgICAgIC8vIGluY2x1ZGUgYXR0cmlidXRlcyBmcm9tIHRoZSBjb3JyZXNwb25kaW5nIG9uQmVmb3JlTmF2aWdhdGlvbiBldmVudFxuICAgICAgICAgICAgY29uc3QgcGVuZGluZ05hdmlnYXRpb24gPSB0aGlzLmdldFBlbmRpbmdOYXZpZ2F0aW9uKG5hdmlnYXRpb25JZCk7XG4gICAgICAgICAgICBpZiAocGVuZGluZ05hdmlnYXRpb24pIHtcbiAgICAgICAgICAgICAgICBwZW5kaW5nTmF2aWdhdGlvbi5yZXNvbHZlT25Db21taXR0ZWRFdmVudE5hdmlnYXRpb24obmF2aWdhdGlvbik7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCBwZW5kaW5nTmF2aWdhdGlvbi5yZXNvbHZlZFdpdGhpblRpbWVvdXQoMTAwMCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc29sdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9uQmVmb3JlTmF2aWdhdGVFdmVudE5hdmlnYXRpb24gPSBhd2FpdCBwZW5kaW5nTmF2aWdhdGlvbi5vbkJlZm9yZU5hdmlnYXRlRXZlbnROYXZpZ2F0aW9uO1xuICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0aW9uLnBhcmVudF9mcmFtZV9pZCA9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkJlZm9yZU5hdmlnYXRlRXZlbnROYXZpZ2F0aW9uLnBhcmVudF9mcmFtZV9pZDtcbiAgICAgICAgICAgICAgICAgICAgbmF2aWdhdGlvbi5iZWZvcmVfbmF2aWdhdGVfZXZlbnRfb3JkaW5hbCA9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkJlZm9yZU5hdmlnYXRlRXZlbnROYXZpZ2F0aW9uLmJlZm9yZV9uYXZpZ2F0ZV9ldmVudF9vcmRpbmFsO1xuICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0aW9uLmJlZm9yZV9uYXZpZ2F0ZV90aW1lX3N0YW1wID1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQmVmb3JlTmF2aWdhdGVFdmVudE5hdmlnYXRpb24uYmVmb3JlX25hdmlnYXRlX3RpbWVfc3RhbXA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kYXRhUmVjZWl2ZXIuc2F2ZVJlY29yZChcIm5hdmlnYXRpb25zXCIsIG5hdmlnYXRpb24pO1xuICAgICAgICB9O1xuICAgICAgICBicm93c2VyLndlYk5hdmlnYXRpb24ub25Db21taXR0ZWQuYWRkTGlzdGVuZXIodGhpcy5vbkNvbW1pdHRlZExpc3RlbmVyKTtcbiAgICB9XG4gICAgY2xlYW51cCgpIHtcbiAgICAgICAgaWYgKHRoaXMub25CZWZvcmVOYXZpZ2F0ZUxpc3RlbmVyKSB7XG4gICAgICAgICAgICBicm93c2VyLndlYk5hdmlnYXRpb24ub25CZWZvcmVOYXZpZ2F0ZS5yZW1vdmVMaXN0ZW5lcih0aGlzLm9uQmVmb3JlTmF2aWdhdGVMaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub25Db21taXR0ZWRMaXN0ZW5lcikge1xuICAgICAgICAgICAgYnJvd3Nlci53ZWJOYXZpZ2F0aW9uLm9uQ29tbWl0dGVkLnJlbW92ZUxpc3RlbmVyKHRoaXMub25Db21taXR0ZWRMaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaW5zdGFudGlhdGVQZW5kaW5nTmF2aWdhdGlvbihuYXZpZ2F0aW9uSWQpIHtcbiAgICAgICAgdGhpcy5wZW5kaW5nTmF2aWdhdGlvbnNbbmF2aWdhdGlvbklkXSA9IG5ldyBQZW5kaW5nTmF2aWdhdGlvbigpO1xuICAgICAgICByZXR1cm4gdGhpcy5wZW5kaW5nTmF2aWdhdGlvbnNbbmF2aWdhdGlvbklkXTtcbiAgICB9XG4gICAgZ2V0UGVuZGluZ05hdmlnYXRpb24obmF2aWdhdGlvbklkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBlbmRpbmdOYXZpZ2F0aW9uc1tuYXZpZ2F0aW9uSWRdO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWJtRjJhV2RoZEdsdmJpMXBibk4wY25WdFpXNTBMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE1pT2xzaUxpNHZMaTR2TGk0dmMzSmpMMkpoWTJ0bmNtOTFibVF2Ym1GMmFXZGhkR2x2YmkxcGJuTjBjblZ0Wlc1MExuUnpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSkJRVUZCTEU5QlFVOHNSVUZCUXl4MVFrRkJkVUlzUlVGQlF5eE5RVUZOTEhkRFFVRjNReXhEUVVGRE8wRkJReTlGTEU5QlFVOHNSVUZCUXl4dlFrRkJiMElzUlVGQlF5eE5RVUZOTEN0Q1FVRXJRaXhEUVVGRE8wRkJRMjVGTEU5QlFVOHNSVUZCUXl4cFFrRkJhVUlzUlVGQlF5eE5RVUZOTERKQ1FVRXlRaXhEUVVGRE8wRkJRelZFTEU5QlFVOHNSVUZCUXl4VFFVRlRMRVZCUVVVc1dVRkJXU3hGUVVGRkxGTkJRVk1zUlVGQlF5eE5RVUZOTEhGQ1FVRnhRaXhEUVVGRE8wRkJRM1pGTEU5QlFVOHNSVUZCUXl4UlFVRlJMRVZCUVVNc1RVRkJUU3hoUVVGaExFTkJRVU03UVVGUmNrTXNUVUZCVFN4RFFVRkRMRTFCUVUwc2NVUkJRWEZFTEVkQlFVY3NTMEZCU3l4RlFVTjRSU3hQUVVGUExFVkJRMUFzVDBGQmMwTXNSVUZEYWtJc1JVRkJSVHRKUVVOMlFpeE5RVUZOTEVkQlFVY3NSMEZEVUN4UFFVRlBMRU5CUVVNc1MwRkJTeXhIUVVGSExFTkJRVU1zUTBGQlF6dFJRVU5vUWl4RFFVRkRMRU5CUVVNc1RVRkJUU3hQUVVGUExFTkJRVU1zU1VGQlNTeERRVUZETEVkQlFVY3NRMEZCUXl4UFFVRlBMRU5CUVVNc1MwRkJTeXhEUVVGRE8xRkJRM1pETEVOQlFVTXNRMEZCUXp0WlFVTkZMRkZCUVZFc1JVRkJSU3hUUVVGVE8xbEJRMjVDTEZOQlFWTXNSVUZCUlN4VFFVRlRPMWxCUTNCQ0xHRkJRV0VzUlVGQlJTeFRRVUZUTzFsQlEzaENMRmRCUVZjc1JVRkJSU3hUUVVGVE8xbEJRM1JDTEV0QlFVc3NSVUZCUlN4VFFVRlRPMWxCUTJoQ0xFMUJRVTBzUlVGQlJTeFRRVUZUTzFOQlEyeENMRU5CUVVNN1NVRkRVaXhOUVVGTkxFMUJRVTBzUjBGQlJ5eEhRVUZITEVOQlFVTXNVVUZCVVR0UlFVTjZRaXhEUVVGRExFTkJRVU1zVFVGQlRTeFBRVUZQTEVOQlFVTXNUMEZCVHl4RFFVRkRMRWRCUVVjc1EwRkJReXhIUVVGSExFTkJRVU1zVVVGQlVTeERRVUZETzFGQlEzcERMRU5CUVVNc1EwRkJReXhGUVVGRkxFdEJRVXNzUlVGQlJTeFRRVUZUTEVWQlFVVXNUVUZCVFN4RlFVRkZMRk5CUVZNc1JVRkJSU3hKUVVGSkxFVkJRVVVzVTBGQlV5eEZRVUZGTEVOQlFVTTdTVUZETjBRc1RVRkJUU3hWUVVGVkxFZEJRV1U3VVVGRE4wSXNWVUZCVlN4RlFVRkZMRTlCUVU4N1VVRkRia0lzVTBGQlV5eEZRVUZGTEZOQlFWTXNRMEZCUXl4SFFVRkhMRU5CUVVNc1UwRkJVeXhEUVVGRE8xRkJRMjVETEhOQ1FVRnpRaXhGUVVGRkxHOUNRVUZ2UWp0UlFVTTFReXhWUVVGVkxFVkJRVVVzVDBGQlR5eERRVUZETEZOQlFWTTdVVUZETjBJc1UwRkJVeXhGUVVGRkxFZEJRVWNzUTBGQlF5eFJRVUZSTzFGQlEzWkNMRTFCUVUwc1JVRkJSU3hQUVVGUExFTkJRVU1zUzBGQlN6dFJRVU55UWl4cFFrRkJhVUlzUlVGQlJTeEhRVUZITEVOQlFVTXNWMEZCVnp0UlFVTnNReXhSUVVGUkxFVkJRVVVzVDBGQlR5eERRVUZETEU5QlFVODdVVUZEZWtJc1dVRkJXU3hGUVVGRkxFMUJRVTBzUTBGQlF5eExRVUZMTzFGQlF6RkNMR0ZCUVdFc1JVRkJSU3hOUVVGTkxFTkJRVU1zVFVGQlRUdFJRVU0xUWl4WFFVRlhMRVZCUVVVc1RVRkJUU3hEUVVGRExFbEJRVWs3VVVGRGVFSXNVMEZCVXl4RlFVRkZMRWRCUVVjc1EwRkJReXhMUVVGTE8xRkJRM0JDTEZWQlFWVXNSVUZCUlN4SFFVRkhMRU5CUVVNc1RVRkJUVHRSUVVOMFFpeHRRa0ZCYlVJc1JVRkJSU3haUVVGWkxFTkJRVU1zUjBGQlJ5eERRVUZETEdGQlFXRXNRMEZCUXp0UlFVTndSQ3hKUVVGSkxFVkJRVVVzVVVGQlVTeEZRVUZGTzFGQlEyaENMRWRCUVVjc1JVRkJSU3hUUVVGVExFTkJRVU1zVDBGQlR5eERRVUZETEVkQlFVY3NRMEZCUXp0TFFVTTFRaXhEUVVGRE8wbEJRMFlzVDBGQlR5eFZRVUZWTEVOQlFVTTdRVUZEY0VJc1EwRkJReXhEUVVGRE8wRkJSVVlzVFVGQlRTeFBRVUZQTEc5Q1FVRnZRanRKUVVONFFpeE5RVUZOTEVOQlFVTXNXVUZCV1N4RFFVRkRMRk5CUVZNc1JVRkJSU3hMUVVGTExFVkJRVVVzVDBGQlR6dFJRVU5zUkN4UFFVRlBMRWRCUVVjc1UwRkJVeXhKUVVGSkxFdEJRVXNzU1VGQlNTeFBRVUZQTEVWQlFVVXNRMEZCUXp0SlFVTTFReXhEUVVGRE8wbEJRMmRDTEZsQlFWa3NRMEZCUXp0SlFVTjBRaXgzUWtGQmQwSXNRMEZCUXp0SlFVTjZRaXh0UWtGQmJVSXNRMEZCUXp0SlFVTndRaXhyUWtGQmEwSXNSMEZGZEVJc1JVRkJSU3hEUVVGRE8wbEJSVkFzV1VGQldTeFpRVUZaTzFGQlEzUkNMRWxCUVVrc1EwRkJReXhaUVVGWkxFZEJRVWNzV1VGQldTeERRVUZETzBsQlEyNURMRU5CUVVNN1NVRkZUU3hIUVVGSExFTkJRVU1zVDBGQlR6dFJRVU5vUWl4SlFVRkpMRU5CUVVNc2QwSkJRWGRDTEVkQlFVY3NTMEZCU3l4RlFVTnVReXhQUVVGclJDeEZRVU5zUkN4RlFVRkZPMWxCUTBZc1RVRkJUU3haUVVGWkxFZEJRVWNzYjBKQlFXOUNMRU5CUVVNc1dVRkJXU3hEUVVOd1JDeFBRVUZQTEVOQlFVTXNVMEZCVXl4RlFVTnFRaXhQUVVGUExFTkJRVU1zUzBGQlN5eEZRVU5pTEU5QlFVOHNRMEZCUXl4UFFVRlBMRU5CUTJoQ0xFTkJRVU03V1VGRFJpeE5RVUZOTEdsQ1FVRnBRaXhIUVVGSExFbEJRVWtzUTBGQlF5dzBRa0ZCTkVJc1EwRkJReXhaUVVGWkxFTkJRVU1zUTBGQlF6dFpRVU14UlN4TlFVRk5MRlZCUVZVc1IwRkJaU3hOUVVGTkxIRkVRVUZ4UkN4RFFVTjRSaXhQUVVGUExFVkJRMUFzVDBGQlR5eERRVU5TTEVOQlFVTTdXVUZEUml4VlFVRlZMRU5CUVVNc1pVRkJaU3hIUVVGSExFOUJRVThzUTBGQlF5eGhRVUZoTEVOQlFVTTdXVUZEYmtRc1ZVRkJWU3hEUVVGRExEWkNRVUUyUWl4SFFVRkhMSFZDUVVGMVFpeEZRVUZGTEVOQlFVTTdXVUZEY2tVc1ZVRkJWU3hEUVVGRExEQkNRVUV3UWl4SFFVRkhMRWxCUVVrc1NVRkJTU3hEUVVNNVF5eFBRVUZQTEVOQlFVTXNVMEZCVXl4RFFVTnNRaXhEUVVGRExGZEJRVmNzUlVGQlJTeERRVUZETzFsQlEyaENMR2xDUVVGcFFpeERRVUZETEhORFFVRnpReXhEUVVGRExGVkJRVlVzUTBGQlF5eERRVUZETzFGQlEzWkZMRU5CUVVNc1EwRkJRenRSUVVOR0xFOUJRVThzUTBGQlF5eGhRVUZoTEVOQlFVTXNaMEpCUVdkQ0xFTkJRVU1zVjBGQlZ5eERRVU5vUkN4SlFVRkpMRU5CUVVNc2QwSkJRWGRDTEVOQlF6bENMRU5CUVVNN1VVRkRSaXhKUVVGSkxFTkJRVU1zYlVKQlFXMUNMRWRCUVVjc1MwRkJTeXhGUVVNNVFpeFBRVUUyUXl4RlFVTTNReXhGUVVGRk8xbEJRMFlzVFVGQlRTeFpRVUZaTEVkQlFVY3NiMEpCUVc5Q0xFTkJRVU1zV1VGQldTeERRVU53UkN4UFFVRlBMRU5CUVVNc1UwRkJVeXhGUVVOcVFpeFBRVUZQTEVOQlFVTXNTMEZCU3l4RlFVTmlMRTlCUVU4c1EwRkJReXhQUVVGUExFTkJRMmhDTEVOQlFVTTdXVUZEUml4TlFVRk5MRlZCUVZVc1IwRkJaU3hOUVVGTkxIRkVRVUZ4UkN4RFFVTjRSaXhQUVVGUExFVkJRMUFzVDBGQlR5eERRVU5TTEVOQlFVTTdXVUZEUml4VlFVRlZMRU5CUVVNc2NVSkJRWEZDTEVkQlFVY3NXVUZCV1N4RFFVTTNReXhKUVVGSkxFTkJRVU1zVTBGQlV5eERRVUZETEU5QlFVOHNRMEZCUXl4dlFrRkJiMElzUTBGQlF5eERRVU0zUXl4RFFVRkRPMWxCUTBZc1ZVRkJWU3hEUVVGRExHVkJRV1VzUjBGQlJ5eFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMR05CUVdNc1EwRkJReXhEUVVGRE8xbEJRMnhGTEZWQlFWVXNRMEZCUXl4MVFrRkJkVUlzUjBGQlJ5eDFRa0ZCZFVJc1JVRkJSU3hEUVVGRE8xbEJReTlFTEZWQlFWVXNRMEZCUXl4dlFrRkJiMElzUjBGQlJ5eEpRVUZKTEVsQlFVa3NRMEZEZUVNc1QwRkJUeXhEUVVGRExGTkJRVk1zUTBGRGJFSXNRMEZCUXl4WFFVRlhMRVZCUVVVc1EwRkJRenRaUVVWb1FpeHhSVUZCY1VVN1dVRkRja1VzVFVGQlRTeHBRa0ZCYVVJc1IwRkJSeXhKUVVGSkxFTkJRVU1zYjBKQlFXOUNMRU5CUVVNc1dVRkJXU3hEUVVGRExFTkJRVU03V1VGRGJFVXNTVUZCU1N4cFFrRkJhVUlzUlVGQlJUdG5Ra0ZEY2tJc2FVSkJRV2xDTEVOQlFVTXNhVU5CUVdsRExFTkJRVU1zVlVGQlZTeERRVUZETEVOQlFVTTdaMEpCUTJoRkxFMUJRVTBzVVVGQlVTeEhRVUZITEUxQlFVMHNhVUpCUVdsQ0xFTkJRVU1zY1VKQlFYRkNMRU5CUVVNc1NVRkJTU3hEUVVGRExFTkJRVU03WjBKQlEzSkZMRWxCUVVrc1VVRkJVU3hGUVVGRk8yOUNRVU5hTEUxQlFVMHNLMEpCUVN0Q0xFZEJRVWNzVFVGQlRTeHBRa0ZCYVVJc1EwRkJReXdyUWtGQkswSXNRMEZCUXp0dlFrRkRhRWNzVlVGQlZTeERRVUZETEdWQlFXVTdkMEpCUTNoQ0xDdENRVUVyUWl4RFFVRkRMR1ZCUVdVc1EwRkJRenR2UWtGRGJFUXNWVUZCVlN4RFFVRkRMRFpDUVVFMlFqdDNRa0ZEZEVNc0swSkJRU3RDTEVOQlFVTXNOa0pCUVRaQ0xFTkJRVU03YjBKQlEyaEZMRlZCUVZVc1EwRkJReXd3UWtGQk1FSTdkMEpCUTI1RExDdENRVUVyUWl4RFFVRkRMREJDUVVFd1FpeERRVUZETzJsQ1FVTTVSRHRoUVVOR08xbEJSVVFzU1VGQlNTeERRVUZETEZsQlFWa3NRMEZCUXl4VlFVRlZMRU5CUVVNc1lVRkJZU3hGUVVGRkxGVkJRVlVzUTBGQlF5eERRVUZETzFGQlF6RkVMRU5CUVVNc1EwRkJRenRSUVVOR0xFOUJRVThzUTBGQlF5eGhRVUZoTEVOQlFVTXNWMEZCVnl4RFFVRkRMRmRCUVZjc1EwRkJReXhKUVVGSkxFTkJRVU1zYlVKQlFXMUNMRU5CUVVNc1EwRkJRenRKUVVNeFJTeERRVUZETzBsQlJVMHNUMEZCVHp0UlFVTmFMRWxCUVVrc1NVRkJTU3hEUVVGRExIZENRVUYzUWl4RlFVRkZPMWxCUTJwRExFOUJRVThzUTBGQlF5eGhRVUZoTEVOQlFVTXNaMEpCUVdkQ0xFTkJRVU1zWTBGQll5eERRVU51UkN4SlFVRkpMRU5CUVVNc2QwSkJRWGRDTEVOQlF6bENMRU5CUVVNN1UwRkRTRHRSUVVORUxFbEJRVWtzU1VGQlNTeERRVUZETEcxQ1FVRnRRaXhGUVVGRk8xbEJRelZDTEU5QlFVOHNRMEZCUXl4aFFVRmhMRU5CUVVNc1YwRkJWeXhEUVVGRExHTkJRV01zUTBGRE9VTXNTVUZCU1N4RFFVRkRMRzFDUVVGdFFpeERRVU42UWl4RFFVRkRPMU5CUTBnN1NVRkRTQ3hEUVVGRE8wbEJSVThzTkVKQlFUUkNMRU5CUTJ4RExGbEJRVzlDTzFGQlJYQkNMRWxCUVVrc1EwRkJReXhyUWtGQmEwSXNRMEZCUXl4WlFVRlpMRU5CUVVNc1IwRkJSeXhKUVVGSkxHbENRVUZwUWl4RlFVRkZMRU5CUVVNN1VVRkRhRVVzVDBGQlR5eEpRVUZKTEVOQlFVTXNhMEpCUVd0Q0xFTkJRVU1zV1VGQldTeERRVUZETEVOQlFVTTdTVUZETDBNc1EwRkJRenRKUVVWUExHOUNRVUZ2UWl4RFFVRkRMRmxCUVc5Q08xRkJReTlETEU5QlFVOHNTVUZCU1N4RFFVRkRMR3RDUVVGclFpeERRVUZETEZsQlFWa3NRMEZCUXl4RFFVRkRPMGxCUXk5RExFTkJRVU03UTBGRFJpSjkiLCJpbXBvcnQgeyBnZXRJbnN0cnVtZW50SlMgfSBmcm9tIFwiLi4vbGliL2pzLWluc3RydW1lbnRzXCI7XG5pbXBvcnQgeyBwYWdlU2NyaXB0IH0gZnJvbSBcIi4vamF2YXNjcmlwdC1pbnN0cnVtZW50LXBhZ2Utc2NvcGVcIjtcbmZ1bmN0aW9uIGdldFBhZ2VTY3JpcHRBc1N0cmluZyhqc0luc3RydW1lbnRhdGlvblNldHRpbmdzKSB7XG4gICAgLy8gVGhlIEpTIEluc3RydW1lbnQgUmVxdWVzdHMgYXJlIHNldHVwIGFuZCB2YWxpZGF0ZWQgcHl0aG9uIHNpZGVcbiAgICAvLyBpbmNsdWRpbmcgc2V0dGluZyBkZWZhdWx0cyBmb3IgbG9nU2V0dGluZ3MuIFNlZSBKU0luc3RydW1lbnRhdGlvbi5weVxuICAgIGNvbnN0IHBhZ2VTY3JpcHRTdHJpbmcgPSBgXG4vLyBTdGFydCBvZiBqcy1pbnN0cnVtZW50cy5cbiR7Z2V0SW5zdHJ1bWVudEpTfVxuLy8gRW5kIG9mIGpzLWluc3RydW1lbnRzLlxuXG4vLyBTdGFydCBvZiBjdXN0b20gaW5zdHJ1bWVudFJlcXVlc3RzLlxuY29uc3QganNJbnN0cnVtZW50YXRpb25TZXR0aW5ncyA9ICR7SlNPTi5zdHJpbmdpZnkoanNJbnN0cnVtZW50YXRpb25TZXR0aW5ncyl9O1xuLy8gRW5kIG9mIGN1c3RvbSBpbnN0cnVtZW50UmVxdWVzdHMuXG5cbi8vIFN0YXJ0IG9mIGFub255bW91cyBmdW5jdGlvbiBmcm9tIGphdmFzY3JpcHQtaW5zdHJ1bWVudC1wYWdlLXNjb3BlLnRzXG4oJHtwYWdlU2NyaXB0fShnZXRJbnN0cnVtZW50SlMsIGpzSW5zdHJ1bWVudGF0aW9uU2V0dGluZ3MpKTtcbi8vIEVuZC5cbiAgYDtcbiAgICByZXR1cm4gcGFnZVNjcmlwdFN0cmluZztcbn1cbmZ1bmN0aW9uIGluc2VydFNjcmlwdChwYWdlU2NyaXB0U3RyaW5nLCBldmVudElkLCB0ZXN0aW5nID0gZmFsc2UpIHtcbiAgICBjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gICAgc2NyaXB0LnRleHQgPSBwYWdlU2NyaXB0U3RyaW5nO1xuICAgIHNjcmlwdC5hc3luYyA9IGZhbHNlO1xuICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWV2ZW50LWlkXCIsIGV2ZW50SWQpO1xuICAgIHNjcmlwdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLXRlc3RpbmdcIiwgYCR7dGVzdGluZ31gKTtcbiAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKHNjcmlwdCwgcGFyZW50LmZpcnN0Q2hpbGQpO1xuICAgIHBhcmVudC5yZW1vdmVDaGlsZChzY3JpcHQpO1xufVxuZnVuY3Rpb24gZW1pdE1zZyh0eXBlLCBtc2cpIHtcbiAgICBtc2cudGltZVN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGJyb3dzZXIucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgIG5hbWVzcGFjZTogXCJqYXZhc2NyaXB0LWluc3RydW1lbnRhdGlvblwiLFxuICAgICAgICB0eXBlLFxuICAgICAgICBkYXRhOiBtc2csXG4gICAgfSk7XG59XG5jb25zdCBldmVudElkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygpO1xuLy8gbGlzdGVuIGZvciBtZXNzYWdlcyBmcm9tIHRoZSBzY3JpcHQgd2UgYXJlIGFib3V0IHRvIGluc2VydFxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudElkLCBmdW5jdGlvbiAoZSkge1xuICAgIC8vIHBhc3MgdGhlc2Ugb24gdG8gdGhlIGJhY2tncm91bmQgcGFnZVxuICAgIGNvbnN0IG1zZ3MgPSBlLmRldGFpbDtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShtc2dzKSkge1xuICAgICAgICBtc2dzLmZvckVhY2goZnVuY3Rpb24gKG1zZykge1xuICAgICAgICAgICAgZW1pdE1zZyhtc2cudHlwZSwgbXNnLmNvbnRlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGVtaXRNc2cobXNncy50eXBlLCBtc2dzLmNvbnRlbnQpO1xuICAgIH1cbn0pO1xuZXhwb3J0IGZ1bmN0aW9uIGluamVjdEphdmFzY3JpcHRJbnN0cnVtZW50UGFnZVNjcmlwdChjb250ZW50U2NyaXB0Q29uZmlnKSB7XG4gICAgaW5zZXJ0U2NyaXB0KGdldFBhZ2VTY3JpcHRBc1N0cmluZyhjb250ZW50U2NyaXB0Q29uZmlnLmpzSW5zdHJ1bWVudGF0aW9uU2V0dGluZ3MpLCBldmVudElkLCBjb250ZW50U2NyaXB0Q29uZmlnLnRlc3RpbmcpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pYW1GMllYTmpjbWx3ZEMxcGJuTjBjblZ0Wlc1MExXTnZiblJsYm5RdGMyTnZjR1V1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sY3lJNld5SXVMaTh1TGk4dUxpOXpjbU12WTI5dWRHVnVkQzlxWVhaaGMyTnlhWEIwTFdsdWMzUnlkVzFsYm5RdFkyOXVkR1Z1ZEMxelkyOXdaUzUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTeFBRVUZQTEVWQlFVTXNaVUZCWlN4RlFVRkRMRTFCUVUwc2RVSkJRWFZDTEVOQlFVTTdRVUZEZEVRc1QwRkJUeXhGUVVGRExGVkJRVlVzUlVGQlF5eE5RVUZOTEc5RFFVRnZReXhEUVVGRE8wRkJSVGxFTEZOQlFWTXNjVUpCUVhGQ0xFTkJRelZDTEhsQ1FVRnBRenRKUVVWcVF5eHBSVUZCYVVVN1NVRkRha1VzZFVWQlFYVkZPMGxCUTNaRkxFMUJRVTBzWjBKQlFXZENMRWRCUVVjN08wVkJSWHBDTEdWQlFXVTdPenM3YjBOQlNXMUNMRWxCUVVrc1EwRkJReXhUUVVGVExFTkJRVU1zZVVKQlFYbENMRU5CUVVNN096czdSMEZKTVVVc1ZVRkJWVHM3UjBGRlZpeERRVUZETzBsQlEwWXNUMEZCVHl4blFrRkJaMElzUTBGQlF6dEJRVU14UWl4RFFVRkRPMEZCUlVRc1UwRkJVeXhaUVVGWkxFTkJRMjVDTEdkQ1FVRjNRaXhGUVVONFFpeFBRVUZsTEVWQlEyWXNWVUZCYlVJc1MwRkJTenRKUVVWNFFpeE5RVUZOTEUxQlFVMHNSMEZCUnl4UlFVRlJMRU5CUVVNc1pVRkJaU3hGUVVOeVF5eE5RVUZOTEVkQlFVY3NVVUZCVVN4RFFVRkRMR0ZCUVdFc1EwRkJReXhSUVVGUkxFTkJRVU1zUTBGQlF6dEpRVU0xUXl4TlFVRk5MRU5CUVVNc1NVRkJTU3hIUVVGSExHZENRVUZuUWl4RFFVRkRPMGxCUXk5Q0xFMUJRVTBzUTBGQlF5eExRVUZMTEVkQlFVY3NTMEZCU3l4RFFVRkRPMGxCUTNKQ0xFMUJRVTBzUTBGQlF5eFpRVUZaTEVOQlFVTXNaVUZCWlN4RlFVRkZMRTlCUVU4c1EwRkJReXhEUVVGRE8wbEJRemxETEUxQlFVMHNRMEZCUXl4WlFVRlpMRU5CUVVNc1kwRkJZeXhGUVVGRkxFZEJRVWNzVDBGQlR5eEZRVUZGTEVOQlFVTXNRMEZCUXp0SlFVTnNSQ3hOUVVGTkxFTkJRVU1zV1VGQldTeERRVUZETEUxQlFVMHNSVUZCUlN4TlFVRk5MRU5CUVVNc1ZVRkJWU3hEUVVGRExFTkJRVU03U1VGREwwTXNUVUZCVFN4RFFVRkRMRmRCUVZjc1EwRkJReXhOUVVGTkxFTkJRVU1zUTBGQlF6dEJRVU0zUWl4RFFVRkRPMEZCUlVRc1UwRkJVeXhQUVVGUExFTkJRVU1zU1VGQlNTeEZRVUZGTEVkQlFVYzdTVUZEZUVJc1IwRkJSeXhEUVVGRExGTkJRVk1zUjBGQlJ5eEpRVUZKTEVsQlFVa3NSVUZCUlN4RFFVRkRMRmRCUVZjc1JVRkJSU3hEUVVGRE8wbEJRM3BETEU5QlFVOHNRMEZCUXl4UFFVRlBMRU5CUVVNc1YwRkJWeXhEUVVGRE8xRkJRekZDTEZOQlFWTXNSVUZCUlN3MFFrRkJORUk3VVVGRGRrTXNTVUZCU1R0UlFVTktMRWxCUVVrc1JVRkJSU3hIUVVGSE8wdEJRMVlzUTBGQlF5eERRVUZETzBGQlEwd3NRMEZCUXp0QlFVVkVMRTFCUVUwc1QwRkJUeXhIUVVGSExFbEJRVWtzUTBGQlF5eE5RVUZOTEVWQlFVVXNRMEZCUXl4UlFVRlJMRVZCUVVVc1EwRkJRenRCUVVWNlF5dzJSRUZCTmtRN1FVRkROMFFzVVVGQlVTeERRVUZETEdkQ1FVRm5RaXhEUVVGRExFOUJRVThzUlVGQlJTeFZRVUZUTEVOQlFXTTdTVUZEZUVRc2RVTkJRWFZETzBsQlEzWkRMRTFCUVUwc1NVRkJTU3hIUVVGSExFTkJRVU1zUTBGQlF5eE5RVUZOTEVOQlFVTTdTVUZEZEVJc1NVRkJTU3hMUVVGTExFTkJRVU1zVDBGQlR5eERRVUZETEVsQlFVa3NRMEZCUXl4RlFVRkZPMUZCUTNaQ0xFbEJRVWtzUTBGQlF5eFBRVUZQTEVOQlFVTXNWVUZCVXl4SFFVRkhPMWxCUTNaQ0xFOUJRVThzUTBGQlF5eEhRVUZITEVOQlFVTXNTVUZCU1N4RlFVRkZMRWRCUVVjc1EwRkJReXhQUVVGUExFTkJRVU1zUTBGQlF6dFJRVU5xUXl4RFFVRkRMRU5CUVVNc1EwRkJRenRMUVVOS08xTkJRVTA3VVVGRFRDeFBRVUZQTEVOQlFVTXNTVUZCU1N4RFFVRkRMRWxCUVVrc1JVRkJSU3hKUVVGSkxFTkJRVU1zVDBGQlR5eERRVUZETEVOQlFVTTdTMEZEYkVNN1FVRkRTQ3hEUVVGRExFTkJRVU1zUTBGQlF6dEJRVVZJTEUxQlFVMHNWVUZCVlN4dlEwRkJiME1zUTBGQlF5eHRRa0ZCYlVJN1NVRkRkRVVzV1VGQldTeERRVU5XTEhGQ1FVRnhRaXhEUVVGRExHMUNRVUZ0UWl4RFFVRkRMSGxDUVVGNVFpeERRVUZETEVWQlEzQkZMRTlCUVU4c1JVRkRVQ3h0UWtGQmJVSXNRMEZCUXl4UFFVRlBMRU5CUXpWQ0xFTkJRVU03UVVGRFNpeERRVUZESW4wPSIsIi8vIENvZGUgYmVsb3cgaXMgbm90IGEgY29udGVudCBzY3JpcHQ6IG5vIEZpcmVmb3ggQVBJcyBzaG91bGQgYmUgdXNlZFxuLy8gQWxzbywgbm8gd2VicGFjay9lczYgaW1wb3J0cyBtYXkgYmUgdXNlZCBpbiB0aGlzIGZpbGUgc2luY2UgdGhlIHNjcmlwdFxuLy8gaXMgZXhwb3J0ZWQgYXMgYSBwYWdlIHNjcmlwdCBhcyBhIHN0cmluZ1xuZXhwb3J0IGNvbnN0IHBhZ2VTY3JpcHQgPSBmdW5jdGlvbiAoZ2V0SW5zdHJ1bWVudEpTLCBqc0luc3RydW1lbnRhdGlvblNldHRpbmdzKSB7XG4gICAgLy8gbWVzc2FnZXMgdGhlIGluamVjdGVkIHNjcmlwdFxuICAgIGZ1bmN0aW9uIHNlbmRNZXNzYWdlc1RvTG9nZ2VyKGV2ZW50SWQsIG1lc3NhZ2VzKSB7XG4gICAgICAgIGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KGV2ZW50SWQsIHtcbiAgICAgICAgICAgIGRldGFpbDogbWVzc2FnZXMsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgY29uc3QgZXZlbnRJZCA9IGRvY3VtZW50LmN1cnJlbnRTY3JpcHQuZ2V0QXR0cmlidXRlKFwiZGF0YS1ldmVudC1pZFwiKTtcbiAgICBjb25zdCB0ZXN0aW5nID0gZG9jdW1lbnQuY3VycmVudFNjcmlwdC5nZXRBdHRyaWJ1dGUoXCJkYXRhLXRlc3RpbmdcIik7XG4gICAgY29uc3QgaW5zdHJ1bWVudEpTID0gZ2V0SW5zdHJ1bWVudEpTKGV2ZW50SWQsIHNlbmRNZXNzYWdlc1RvTG9nZ2VyKTtcbiAgICBsZXQgdDA7XG4gICAgaWYgKHRlc3RpbmcgPT09IFwidHJ1ZVwiKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiT3BlbldQTTogQ3VycmVudGx5IHRlc3RpbmdcIik7XG4gICAgICAgIHQwID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQmVnaW4gbG9hZGluZyBKUyBpbnN0cnVtZW50YXRpb24uXCIpO1xuICAgIH1cbiAgICBpbnN0cnVtZW50SlMoanNJbnN0cnVtZW50YXRpb25TZXR0aW5ncyk7XG4gICAgaWYgKHRlc3RpbmcgPT09IFwidHJ1ZVwiKSB7XG4gICAgICAgIGNvbnN0IHQxID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBDYWxsIHRvIGluc3RydW1lbnRKUyB0b29rICR7dDEgLSB0MH0gbWlsbGlzZWNvbmRzLmApO1xuICAgICAgICB3aW5kb3cuaW5zdHJ1bWVudEpTID0gaW5zdHJ1bWVudEpTO1xuICAgICAgICBjb25zb2xlLmxvZyhcIk9wZW5XUE06IENvbnRlbnQtc2lkZSBqYXZhc2NyaXB0IGluc3RydW1lbnRhdGlvbiBzdGFydGVkIHdpdGggc3BlYzpcIiwganNJbnN0cnVtZW50YXRpb25TZXR0aW5ncywgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLCBcIihpZiBzcGVjIGlzICc8dW5hdmFpbGFibGU+JyBjaGVjayB3ZWIgY29uc29sZS4pXCIpO1xuICAgIH1cbn07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2lhbUYyWVhOamNtbHdkQzFwYm5OMGNuVnRaVzUwTFhCaFoyVXRjMk52Y0dVdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGN5STZXeUl1TGk4dUxpOHVMaTl6Y21NdlkyOXVkR1Z1ZEM5cVlYWmhjMk55YVhCMExXbHVjM1J5ZFcxbGJuUXRjR0ZuWlMxelkyOXdaUzUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTeHhSVUZCY1VVN1FVRkRja1VzZVVWQlFYbEZPMEZCUTNwRkxESkRRVUV5UXp0QlFVVXpReXhOUVVGTkxFTkJRVU1zVFVGQlRTeFZRVUZWTEVkQlFVY3NWVUZCVXl4bFFVRmxMRVZCUVVVc2VVSkJRWGxDTzBsQlF6TkZMQ3RDUVVFclFqdEpRVU12UWl4VFFVRlRMRzlDUVVGdlFpeERRVUZETEU5QlFVOHNSVUZCUlN4UlFVRlJPMUZCUXpkRExGRkJRVkVzUTBGQlF5eGhRVUZoTEVOQlEzQkNMRWxCUVVrc1YwRkJWeXhEUVVGRExFOUJRVThzUlVGQlJUdFpRVU4yUWl4TlFVRk5MRVZCUVVVc1VVRkJVVHRUUVVOcVFpeERRVUZETEVOQlEwZ3NRMEZCUXp0SlFVTktMRU5CUVVNN1NVRkZSQ3hOUVVGTkxFOUJRVThzUjBGQlJ5eFJRVUZSTEVOQlFVTXNZVUZCWVN4RFFVRkRMRmxCUVZrc1EwRkJReXhsUVVGbExFTkJRVU1zUTBGQlF6dEpRVU55UlN4TlFVRk5MRTlCUVU4c1IwRkJSeXhSUVVGUkxFTkJRVU1zWVVGQllTeERRVUZETEZsQlFWa3NRMEZCUXl4alFVRmpMRU5CUVVNc1EwRkJRenRKUVVOd1JTeE5RVUZOTEZsQlFWa3NSMEZCUnl4bFFVRmxMRU5CUVVNc1QwRkJUeXhGUVVGRkxHOUNRVUZ2UWl4RFFVRkRMRU5CUVVNN1NVRkRjRVVzU1VGQlNTeEZRVUZWTEVOQlFVTTdTVUZEWml4SlFVRkpMRTlCUVU4c1MwRkJTeXhOUVVGTkxFVkJRVVU3VVVGRGRFSXNUMEZCVHl4RFFVRkRMRWRCUVVjc1EwRkJReXcwUWtGQk5FSXNRMEZCUXl4RFFVRkRPMUZCUXpGRExFVkJRVVVzUjBGQlJ5eFhRVUZYTEVOQlFVTXNSMEZCUnl4RlFVRkZMRU5CUVVNN1VVRkRka0lzVDBGQlR5eERRVUZETEVkQlFVY3NRMEZCUXl4dFEwRkJiVU1zUTBGQlF5eERRVUZETzB0QlEyeEVPMGxCUTBRc1dVRkJXU3hEUVVGRExIbENRVUY1UWl4RFFVRkRMRU5CUVVNN1NVRkRlRU1zU1VGQlNTeFBRVUZQTEV0QlFVc3NUVUZCVFN4RlFVRkZPMUZCUTNSQ0xFMUJRVTBzUlVGQlJTeEhRVUZITEZkQlFWY3NRMEZCUXl4SFFVRkhMRVZCUVVVc1EwRkJRenRSUVVNM1FpeFBRVUZQTEVOQlFVTXNSMEZCUnl4RFFVRkRMRFpDUVVFMlFpeEZRVUZGTEVkQlFVY3NSVUZCUlN4blFrRkJaMElzUTBGQlF5eERRVUZETzFGQlEycEZMRTFCUVdNc1EwRkJReXhaUVVGWkxFZEJRVWNzV1VGQldTeERRVUZETzFGQlF6VkRMRTlCUVU4c1EwRkJReXhIUVVGSExFTkJRMVFzY1VWQlFYRkZMRVZCUTNKRkxIbENRVUY1UWl4RlFVTjZRaXhKUVVGSkxFbEJRVWtzUlVGQlJTeERRVUZETEZkQlFWY3NSVUZCUlN4RlFVTjRRaXhwUkVGQmFVUXNRMEZEYkVRc1EwRkJRenRMUVVOSU8wRkJRMGdzUTBGQlF5eERRVUZESW4wPSIsImV4cG9ydCAqIGZyb20gXCIuL2JhY2tncm91bmQvY29va2llLWluc3RydW1lbnRcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2JhY2tncm91bmQvZG5zLWluc3RydW1lbnRcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2JhY2tncm91bmQvaHR0cC1pbnN0cnVtZW50XCI7XG5leHBvcnQgKiBmcm9tIFwiLi9iYWNrZ3JvdW5kL2phdmFzY3JpcHQtaW5zdHJ1bWVudFwiO1xuZXhwb3J0ICogZnJvbSBcIi4vYmFja2dyb3VuZC9uYXZpZ2F0aW9uLWluc3RydW1lbnRcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2NvbnRlbnQvamF2YXNjcmlwdC1pbnN0cnVtZW50LWNvbnRlbnQtc2NvcGVcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2xpYi9odHRwLXBvc3QtcGFyc2VyXCI7XG5leHBvcnQgKiBmcm9tIFwiLi9saWIvc3RyaW5nLXV0aWxzXCI7XG5leHBvcnQgKiBmcm9tIFwiLi9zY2hlbWFcIjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWFXNWtaWGd1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sY3lJNld5SXVMaTh1TGk5emNtTXZhVzVrWlhndWRITWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklrRkJRVUVzWTBGQll5eG5RMEZCWjBNc1EwRkJRenRCUVVNdlF5eGpRVUZqTERaQ1FVRTJRaXhEUVVGRE8wRkJRelZETEdOQlFXTXNPRUpCUVRoQ0xFTkJRVU03UVVGRE4wTXNZMEZCWXl4dlEwRkJiME1zUTBGQlF6dEJRVU51UkN4alFVRmpMRzlEUVVGdlF5eERRVUZETzBGQlEyNUVMR05CUVdNc0swTkJRU3RETEVOQlFVTTdRVUZET1VRc1kwRkJZeXgzUWtGQmQwSXNRMEZCUXp0QlFVTjJReXhqUVVGakxHOUNRVUZ2UWl4RFFVRkRPMEZCUTI1RExHTkJRV01zVlVGQlZTeERRVUZESW4wPSIsIi8qKlxuICogVGhpcyBlbmFibGVzIHVzIHRvIGtlZXAgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG9yaWdpbmFsIG9yZGVyXG4gKiBpbiB3aGljaCBldmVudHMgYXJyaXZlZCB0byBvdXIgZXZlbnQgbGlzdGVuZXJzLlxuICovXG5sZXQgZXZlbnRPcmRpbmFsID0gMDtcbmV4cG9ydCBjb25zdCBpbmNyZW1lbnRlZEV2ZW50T3JkaW5hbCA9ICgpID0+IHtcbiAgICByZXR1cm4gZXZlbnRPcmRpbmFsKys7XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pWlhoMFpXNXphVzl1TFhObGMzTnBiMjR0WlhabGJuUXRiM0prYVc1aGJDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpJanBiSWk0dUx5NHVMeTR1TDNOeVl5OXNhV0l2WlhoMFpXNXphVzl1TFhObGMzTnBiMjR0WlhabGJuUXRiM0prYVc1aGJDNTBjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lRVUZCUVRzN08wZEJSMGM3UVVGRFNDeEpRVUZKTEZsQlFWa3NSMEZCUnl4RFFVRkRMRU5CUVVNN1FVRkZja0lzVFVGQlRTeERRVUZETEUxQlFVMHNkVUpCUVhWQ0xFZEJRVWNzUjBGQlJ5eEZRVUZGTzBsQlF6RkRMRTlCUVU4c1dVRkJXU3hGUVVGRkxFTkJRVU03UVVGRGVFSXNRMEZCUXl4RFFVRkRJbjA9IiwiaW1wb3J0IHsgbWFrZVVVSUQgfSBmcm9tIFwiLi91dWlkXCI7XG4vKipcbiAqIFRoaXMgZW5hYmxlcyB1cyB0byBhY2Nlc3MgYSB1bmlxdWUgcmVmZXJlbmNlIHRvIHRoaXMgYnJvd3NlclxuICogc2Vzc2lvbiAtIHJlZ2VuZXJhdGVkIGFueSB0aW1lIHRoZSBiYWNrZ3JvdW5kIHByb2Nlc3MgZ2V0c1xuICogcmVzdGFydGVkICh3aGljaCBzaG91bGQgb25seSBiZSBvbiBicm93c2VyIHJlc3RhcnRzKVxuICovXG5leHBvcnQgY29uc3QgZXh0ZW5zaW9uU2Vzc2lvblV1aWQgPSBtYWtlVVVJRCgpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pWlhoMFpXNXphVzl1TFhObGMzTnBiMjR0ZFhWcFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpJanBiSWk0dUx5NHVMeTR1TDNOeVl5OXNhV0l2WlhoMFpXNXphVzl1TFhObGMzTnBiMjR0ZFhWcFpDNTBjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lRVUZCUVN4UFFVRlBMRVZCUVVNc1VVRkJVU3hGUVVGRExFMUJRVTBzVVVGQlVTeERRVUZETzBGQlJXaERPenM3TzBkQlNVYzdRVUZEU0N4TlFVRk5MRU5CUVVNc1RVRkJUU3h2UWtGQmIwSXNSMEZCUnl4UlFVRlJMRVZCUVVVc1EwRkJReUo5IiwiaW1wb3J0IHsgZXNjYXBlU3RyaW5nLCBVaW50OFRvQmFzZTY0IH0gZnJvbSBcIi4vc3RyaW5nLXV0aWxzXCI7XG5leHBvcnQgY2xhc3MgSHR0cFBvc3RQYXJzZXIge1xuICAgIG9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscztcbiAgICBkYXRhUmVjZWl2ZXI7XG4gICAgY29uc3RydWN0b3Iob25CZWZvcmVSZXF1ZXN0RXZlbnREZXRhaWxzLCBkYXRhUmVjZWl2ZXIpIHtcbiAgICAgICAgdGhpcy5vbkJlZm9yZVJlcXVlc3RFdmVudERldGFpbHMgPSBvbkJlZm9yZVJlcXVlc3RFdmVudERldGFpbHM7XG4gICAgICAgIHRoaXMuZGF0YVJlY2VpdmVyID0gZGF0YVJlY2VpdmVyO1xuICAgIH1cbiAgICBwYXJzZVBvc3RSZXF1ZXN0KCkge1xuICAgICAgICBjb25zdCByZXF1ZXN0Qm9keSA9IHRoaXMub25CZWZvcmVSZXF1ZXN0RXZlbnREZXRhaWxzLnJlcXVlc3RCb2R5O1xuICAgICAgICBpZiAocmVxdWVzdEJvZHkuZXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YVJlY2VpdmVyLmxvZ0Vycm9yKFwiRXhjZXB0aW9uOiBVcHN0cmVhbSBmYWlsZWQgdG8gcGFyc2UgUE9TVDogXCIgKyByZXF1ZXN0Qm9keS5lcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlcXVlc3RCb2R5LmZvcm1EYXRhKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBvc3RfYm9keTogZXNjYXBlU3RyaW5nKEpTT04uc3RyaW5naWZ5KHJlcXVlc3RCb2R5LmZvcm1EYXRhKSksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXF1ZXN0Qm9keS5yYXcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcG9zdF9ib2R5X3JhdzogSlNPTi5zdHJpbmdpZnkocmVxdWVzdEJvZHkucmF3Lm1hcCh4ID0+IFtcbiAgICAgICAgICAgICAgICAgICAgeC5maWxlLFxuICAgICAgICAgICAgICAgICAgICBVaW50OFRvQmFzZTY0KG5ldyBVaW50OEFycmF5KHguYnl0ZXMpKSxcbiAgICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7fTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2lhSFIwY0Mxd2IzTjBMWEJoY25ObGNpNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpJanBiSWk0dUx5NHVMeTR1TDNOeVl5OXNhV0l2YUhSMGNDMXdiM04wTFhCaGNuTmxjaTUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGRFFTeFBRVUZQTEVWQlFVTXNXVUZCV1N4RlFVRkZMR0ZCUVdFc1JVRkJReXhOUVVGTkxHZENRVUZuUWl4RFFVRkRPMEZCVVRORUxFMUJRVTBzVDBGQlR5eGpRVUZqTzBsQlExSXNNa0pCUVRKQ0xFTkJRWGRETzBsQlEyNUZMRmxCUVZrc1EwRkJRenRKUVVVNVFpeFpRVU5GTERKQ1FVRnJSU3hGUVVOc1JTeFpRVUZaTzFGQlJWb3NTVUZCU1N4RFFVRkRMREpDUVVFeVFpeEhRVUZITERKQ1FVRXlRaXhEUVVGRE8xRkJReTlFTEVsQlFVa3NRMEZCUXl4WlFVRlpMRWRCUVVjc1dVRkJXU3hEUVVGRE8wbEJRMjVETEVOQlFVTTdTVUZGVFN4blFrRkJaMEk3VVVGRGNrSXNUVUZCVFN4WFFVRlhMRWRCUVVjc1NVRkJTU3hEUVVGRExESkNRVUV5UWl4RFFVRkRMRmRCUVZjc1EwRkJRenRSUVVOcVJTeEpRVUZKTEZkQlFWY3NRMEZCUXl4TFFVRkxMRVZCUVVVN1dVRkRja0lzU1VGQlNTeERRVUZETEZsQlFWa3NRMEZCUXl4UlFVRlJMRU5CUTNoQ0xEUkRRVUUwUXl4SFFVRkhMRmRCUVZjc1EwRkJReXhMUVVGTExFTkJRMnBGTEVOQlFVTTdVMEZEU0R0UlFVTkVMRWxCUVVrc1YwRkJWeXhEUVVGRExGRkJRVkVzUlVGQlJUdFpRVU40UWl4UFFVRlBPMmRDUVVOTUxGTkJRVk1zUlVGQlJTeFpRVUZaTEVOQlFVTXNTVUZCU1N4RFFVRkRMRk5CUVZNc1EwRkJReXhYUVVGWExFTkJRVU1zVVVGQlVTeERRVUZETEVOQlFVTTdZVUZET1VRc1EwRkJRenRUUVVOSU8xRkJRMFFzU1VGQlNTeFhRVUZYTEVOQlFVTXNSMEZCUnl4RlFVRkZPMWxCUTI1Q0xFOUJRVTg3WjBKQlEwd3NZVUZCWVN4RlFVRkZMRWxCUVVrc1EwRkJReXhUUVVGVExFTkJRek5DTEZkQlFWY3NRMEZCUXl4SFFVRkhMRU5CUVVNc1IwRkJSeXhEUVVGRExFTkJRVU1zUTBGQlF5eEZRVUZGTEVOQlFVTTdiMEpCUTNaQ0xFTkJRVU1zUTBGQlF5eEpRVUZKTzI5Q1FVTk9MR0ZCUVdFc1EwRkJReXhKUVVGSkxGVkJRVlVzUTBGQlF5eERRVUZETEVOQlFVTXNTMEZCU3l4RFFVRkRMRU5CUVVNN2FVSkJRM1pETEVOQlFVTXNRMEZEU0R0aFFVTkdMRU5CUVVNN1UwRkRTRHRSUVVORUxFOUJRVThzUlVGQlJTeERRVUZETzBsQlExb3NRMEZCUXp0RFFVTkdJbjA9IiwiLy8gSW50cnVtZW50YXRpb24gaW5qZWN0aW9uIGNvZGUgaXMgYmFzZWQgb24gcHJpdmFjeWJhZGdlcmZpcmVmb3hcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9FRkZvcmcvcHJpdmFjeWJhZGdlcmZpcmVmb3gvYmxvYi9tYXN0ZXIvZGF0YS9maW5nZXJwcmludGluZy5qc1xuZXhwb3J0IGZ1bmN0aW9uIGdldEluc3RydW1lbnRKUyhldmVudElkLCBzZW5kTWVzc2FnZXNUb0xvZ2dlcikge1xuICAgIC8qXG4gICAgICogSW5zdHJ1bWVudGF0aW9uIGhlbHBlcnNcbiAgICAgKiAoSW5saW5lZCBpbiBvcmRlciBmb3IganNJbnN0cnVtZW50cyB0byBiZSBlYXNpbHkgZXhwb3J0YWJsZSBhcyBhIHN0cmluZylcbiAgICAgKi9cbiAgICAvLyBDb3VudGVyIHRvIGNhcCAjIG9mIGNhbGxzIGxvZ2dlZCBmb3IgZWFjaCBzY3JpcHQvYXBpIGNvbWJpbmF0aW9uXG4gICAgY29uc3QgbWF4TG9nQ291bnQgPSA1MDA7XG4gICAgLy8gbG9nQ291bnRlclxuICAgIGNvbnN0IGxvZ0NvdW50ZXIgPSBuZXcgT2JqZWN0KCk7XG4gICAgLy8gUHJldmVudCBsb2dnaW5nIG9mIGdldHMgYXJpc2luZyBmcm9tIGxvZ2dpbmdcbiAgICBsZXQgaW5Mb2cgPSBmYWxzZTtcbiAgICAvLyBUbyBrZWVwIHRyYWNrIG9mIHRoZSBvcmlnaW5hbCBvcmRlciBvZiBldmVudHNcbiAgICBsZXQgb3JkaW5hbCA9IDA7XG4gICAgLy8gT3B0aW9ucyBmb3IgSlNPcGVyYXRpb25cbiAgICBjb25zdCBKU09wZXJhdGlvbiA9IHtcbiAgICAgICAgY2FsbDogXCJjYWxsXCIsXG4gICAgICAgIGdldDogXCJnZXRcIixcbiAgICAgICAgZ2V0X2ZhaWxlZDogXCJnZXQoZmFpbGVkKVwiLFxuICAgICAgICBnZXRfZnVuY3Rpb246IFwiZ2V0KGZ1bmN0aW9uKVwiLFxuICAgICAgICBzZXQ6IFwic2V0XCIsXG4gICAgICAgIHNldF9mYWlsZWQ6IFwic2V0KGZhaWxlZClcIixcbiAgICAgICAgc2V0X3ByZXZlbnRlZDogXCJzZXQocHJldmVudGVkKVwiLFxuICAgIH07XG4gICAgLy8gUm91Z2ggaW1wbGVtZW50YXRpb25zIG9mIE9iamVjdC5nZXRQcm9wZXJ0eURlc2NyaXB0b3IgYW5kIE9iamVjdC5nZXRQcm9wZXJ0eU5hbWVzXG4gICAgLy8gU2VlIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZXh0ZW5kZWRfb2JqZWN0X2FwaVxuICAgIE9iamVjdC5nZXRQcm9wZXJ0eURlc2NyaXB0b3IgPSBmdW5jdGlvbiAoc3ViamVjdCwgbmFtZSkge1xuICAgICAgICBpZiAoc3ViamVjdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBnZXQgcHJvcGVydHkgZGVzY3JpcHRvciBmb3IgdW5kZWZpbmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBwZCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Ioc3ViamVjdCwgbmFtZSk7XG4gICAgICAgIGxldCBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihzdWJqZWN0KTtcbiAgICAgICAgd2hpbGUgKHBkID09PSB1bmRlZmluZWQgJiYgcHJvdG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHBkID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm90bywgbmFtZSk7XG4gICAgICAgICAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90byk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBkO1xuICAgIH07XG4gICAgT2JqZWN0LmdldFByb3BlcnR5TmFtZXMgPSBmdW5jdGlvbiAoc3ViamVjdCkge1xuICAgICAgICBpZiAoc3ViamVjdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBnZXQgcHJvcGVydHkgbmFtZXMgZm9yIHVuZGVmaW5lZFwiKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcHJvcHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhzdWJqZWN0KTtcbiAgICAgICAgbGV0IHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHN1YmplY3QpO1xuICAgICAgICB3aGlsZSAocHJvdG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHByb3BzID0gcHJvcHMuY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHByb3RvKSk7XG4gICAgICAgICAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90byk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRklYTUU6IHJlbW92ZSBkdXBsaWNhdGUgcHJvcGVydHkgbmFtZXMgZnJvbSBwcm9wc1xuICAgICAgICByZXR1cm4gcHJvcHM7XG4gICAgfTtcbiAgICAvLyBkZWJvdW5jZSAtIGZyb20gVW5kZXJzY29yZSB2MS42LjBcbiAgICBmdW5jdGlvbiBkZWJvdW5jZShmdW5jLCB3YWl0LCBpbW1lZGlhdGUgPSBmYWxzZSkge1xuICAgICAgICBsZXQgdGltZW91dCwgYXJncywgY29udGV4dCwgdGltZXN0YW1wLCByZXN1bHQ7XG4gICAgICAgIGNvbnN0IGxhdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY29uc3QgbGFzdCA9IERhdGUubm93KCkgLSB0aW1lc3RhbXA7XG4gICAgICAgICAgICBpZiAobGFzdCA8IHdhaXQpIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgaWYgKCFpbW1lZGlhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgICAgIHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICBjb25zdCBjYWxsTm93ID0gaW1tZWRpYXRlICYmICF0aW1lb3V0O1xuICAgICAgICAgICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICAgICAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNhbGxOb3cpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgfVxuICAgIC8vIFJlY3Vyc2l2ZWx5IGdlbmVyYXRlcyBhIHBhdGggZm9yIGFuIGVsZW1lbnRcbiAgICBmdW5jdGlvbiBnZXRQYXRoVG9Eb21FbGVtZW50KGVsZW1lbnQsIHZpc2liaWxpdHlBdHRyID0gZmFsc2UpIHtcbiAgICAgICAgaWYgKGVsZW1lbnQgPT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnRhZ05hbWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVsZW1lbnQucGFyZW50Tm9kZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiTlVMTC9cIiArIGVsZW1lbnQudGFnTmFtZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZ0luZGV4ID0gMTtcbiAgICAgICAgY29uc3Qgc2libGluZ3MgPSBlbGVtZW50LnBhcmVudE5vZGUuY2hpbGROb2RlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaWJsaW5ncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2libGluZyA9IHNpYmxpbmdzW2ldO1xuICAgICAgICAgICAgaWYgKHNpYmxpbmcgPT09IGVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBsZXQgcGF0aCA9IGdldFBhdGhUb0RvbUVsZW1lbnQoZWxlbWVudC5wYXJlbnROb2RlLCB2aXNpYmlsaXR5QXR0cik7XG4gICAgICAgICAgICAgICAgcGF0aCArPSBcIi9cIiArIGVsZW1lbnQudGFnTmFtZSArIFwiW1wiICsgc2libGluZ0luZGV4O1xuICAgICAgICAgICAgICAgIHBhdGggKz0gXCIsXCIgKyBlbGVtZW50LmlkO1xuICAgICAgICAgICAgICAgIHBhdGggKz0gXCIsXCIgKyBlbGVtZW50LmNsYXNzTmFtZTtcbiAgICAgICAgICAgICAgICBpZiAodmlzaWJpbGl0eUF0dHIpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF0aCArPSBcIixcIiArIGVsZW1lbnQuaGlkZGVuO1xuICAgICAgICAgICAgICAgICAgICBwYXRoICs9IFwiLFwiICsgZWxlbWVudC5zdHlsZS5kaXNwbGF5O1xuICAgICAgICAgICAgICAgICAgICBwYXRoICs9IFwiLFwiICsgZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC50YWdOYW1lID09PSBcIkFcIikge1xuICAgICAgICAgICAgICAgICAgICBwYXRoICs9IFwiLFwiICsgZWxlbWVudC5ocmVmO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXRoICs9IFwiXVwiO1xuICAgICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNpYmxpbmcubm9kZVR5cGUgPT09IDEgJiYgc2libGluZy50YWdOYW1lID09PSBlbGVtZW50LnRhZ05hbWUpIHtcbiAgICAgICAgICAgICAgICBzaWJsaW5nSW5kZXgrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBIZWxwZXIgZm9yIEpTT05pZnlpbmcgb2JqZWN0c1xuICAgIGZ1bmN0aW9uIHNlcmlhbGl6ZU9iamVjdChvYmplY3QsIHN0cmluZ2lmeUZ1bmN0aW9ucyA9IGZhbHNlKSB7XG4gICAgICAgIC8vIEhhbmRsZSBwZXJtaXNzaW9ucyBlcnJvcnNcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChvYmplY3QgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJudWxsXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIG9iamVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0cmluZ2lmeUZ1bmN0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb2JqZWN0LnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJGVU5DVElPTlwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHNlZW5PYmplY3RzID0gW107XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkob2JqZWN0LCBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJudWxsXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3RyaW5naWZ5RnVuY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIkZVTkNUSU9OXCI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgd3JhcHBpbmcgb24gY29udGVudCBvYmplY3RzXG4gICAgICAgICAgICAgICAgICAgIGlmIChcIndyYXBwZWRKU09iamVjdFwiIGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLndyYXBwZWRKU09iamVjdDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBTZXJpYWxpemUgRE9NIGVsZW1lbnRzXG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0UGF0aFRvRG9tRWxlbWVudCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gUHJldmVudCBzZXJpYWxpemF0aW9uIGN5Y2xlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSBcIlwiIHx8IHNlZW5PYmplY3RzLmluZGV4T2YodmFsdWUpIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2Vlbk9iamVjdHMucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mIHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJPcGVuV1BNOiBTRVJJQUxJWkFUSU9OIEVSUk9SOiBcIiArIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBcIlNFUklBTElaQVRJT04gRVJST1I6IFwiICsgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gdXBkYXRlQ291bnRlckFuZENoZWNrSWZPdmVyKHNjcmlwdFVybCwgc3ltYm9sKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IHNjcmlwdFVybCArIFwifFwiICsgc3ltYm9sO1xuICAgICAgICBpZiAoa2V5IGluIGxvZ0NvdW50ZXIgJiYgbG9nQ291bnRlcltrZXldID49IG1heExvZ0NvdW50KSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghKGtleSBpbiBsb2dDb3VudGVyKSkge1xuICAgICAgICAgICAgbG9nQ291bnRlcltrZXldID0gMTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZ0NvdW50ZXJba2V5XSArPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gRm9yIGdldHMsIHNldHMsIGV0Yy4gb24gYSBzaW5nbGUgdmFsdWVcbiAgICBmdW5jdGlvbiBsb2dWYWx1ZShpbnN0cnVtZW50ZWRWYXJpYWJsZU5hbWUsIHZhbHVlLCBvcGVyYXRpb24sIC8vIGZyb20gSlNPcGVyYXRpb24gb2JqZWN0IHBsZWFzZVxuICAgIGNhbGxDb250ZXh0LCBsb2dTZXR0aW5ncykge1xuICAgICAgICBpZiAoaW5Mb2cpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpbkxvZyA9IHRydWU7XG4gICAgICAgIGNvbnN0IG92ZXJMaW1pdCA9IHVwZGF0ZUNvdW50ZXJBbmRDaGVja0lmT3ZlcihjYWxsQ29udGV4dC5zY3JpcHRVcmwsIGluc3RydW1lbnRlZFZhcmlhYmxlTmFtZSk7XG4gICAgICAgIGlmIChvdmVyTGltaXQpIHtcbiAgICAgICAgICAgIGluTG9nID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbXNnID0ge1xuICAgICAgICAgICAgb3BlcmF0aW9uLFxuICAgICAgICAgICAgc3ltYm9sOiBpbnN0cnVtZW50ZWRWYXJpYWJsZU5hbWUsXG4gICAgICAgICAgICB2YWx1ZTogc2VyaWFsaXplT2JqZWN0KHZhbHVlLCBsb2dTZXR0aW5ncy5sb2dGdW5jdGlvbnNBc1N0cmluZ3MpLFxuICAgICAgICAgICAgc2NyaXB0VXJsOiBjYWxsQ29udGV4dC5zY3JpcHRVcmwsXG4gICAgICAgICAgICBzY3JpcHRMaW5lOiBjYWxsQ29udGV4dC5zY3JpcHRMaW5lLFxuICAgICAgICAgICAgc2NyaXB0Q29sOiBjYWxsQ29udGV4dC5zY3JpcHRDb2wsXG4gICAgICAgICAgICBmdW5jTmFtZTogY2FsbENvbnRleHQuZnVuY05hbWUsXG4gICAgICAgICAgICBzY3JpcHRMb2NFdmFsOiBjYWxsQ29udGV4dC5zY3JpcHRMb2NFdmFsLFxuICAgICAgICAgICAgY2FsbFN0YWNrOiBjYWxsQ29udGV4dC5jYWxsU3RhY2ssXG4gICAgICAgICAgICBvcmRpbmFsOiBvcmRpbmFsKyssXG4gICAgICAgIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzZW5kKFwibG9nVmFsdWVcIiwgbXNnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiT3BlbldQTTogVW5zdWNjZXNzZnVsIHZhbHVlIGxvZyFcIik7XG4gICAgICAgICAgICBsb2dFcnJvclRvQ29uc29sZShlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgaW5Mb2cgPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gRm9yIGZ1bmN0aW9uc1xuICAgIGZ1bmN0aW9uIGxvZ0NhbGwoaW5zdHJ1bWVudGVkRnVuY3Rpb25OYW1lLCBhcmdzLCBjYWxsQ29udGV4dCwgbG9nU2V0dGluZ3MpIHtcbiAgICAgICAgaWYgKGluTG9nKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaW5Mb2cgPSB0cnVlO1xuICAgICAgICBjb25zdCBvdmVyTGltaXQgPSB1cGRhdGVDb3VudGVyQW5kQ2hlY2tJZk92ZXIoY2FsbENvbnRleHQuc2NyaXB0VXJsLCBpbnN0cnVtZW50ZWRGdW5jdGlvbk5hbWUpO1xuICAgICAgICBpZiAob3ZlckxpbWl0KSB7XG4gICAgICAgICAgICBpbkxvZyA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBDb252ZXJ0IHNwZWNpYWwgYXJndW1lbnRzIGFycmF5IHRvIGEgc3RhbmRhcmQgYXJyYXkgZm9yIEpTT05pZnlpbmdcbiAgICAgICAgICAgIGNvbnN0IHNlcmlhbEFyZ3MgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXJnIG9mIGFyZ3MpIHtcbiAgICAgICAgICAgICAgICBzZXJpYWxBcmdzLnB1c2goc2VyaWFsaXplT2JqZWN0KGFyZywgbG9nU2V0dGluZ3MubG9nRnVuY3Rpb25zQXNTdHJpbmdzKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBtc2cgPSB7XG4gICAgICAgICAgICAgICAgb3BlcmF0aW9uOiBKU09wZXJhdGlvbi5jYWxsLFxuICAgICAgICAgICAgICAgIHN5bWJvbDogaW5zdHJ1bWVudGVkRnVuY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHNlcmlhbEFyZ3MsXG4gICAgICAgICAgICAgICAgdmFsdWU6IFwiXCIsXG4gICAgICAgICAgICAgICAgc2NyaXB0VXJsOiBjYWxsQ29udGV4dC5zY3JpcHRVcmwsXG4gICAgICAgICAgICAgICAgc2NyaXB0TGluZTogY2FsbENvbnRleHQuc2NyaXB0TGluZSxcbiAgICAgICAgICAgICAgICBzY3JpcHRDb2w6IGNhbGxDb250ZXh0LnNjcmlwdENvbCxcbiAgICAgICAgICAgICAgICBmdW5jTmFtZTogY2FsbENvbnRleHQuZnVuY05hbWUsXG4gICAgICAgICAgICAgICAgc2NyaXB0TG9jRXZhbDogY2FsbENvbnRleHQuc2NyaXB0TG9jRXZhbCxcbiAgICAgICAgICAgICAgICBjYWxsU3RhY2s6IGNhbGxDb250ZXh0LmNhbGxTdGFjayxcbiAgICAgICAgICAgICAgICBvcmRpbmFsOiBvcmRpbmFsKyssXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc2VuZChcImxvZ0NhbGxcIiwgbXNnKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiT3BlbldQTTogVW5zdWNjZXNzZnVsIGNhbGwgbG9nOiBcIiArIGluc3RydW1lbnRlZEZ1bmN0aW9uTmFtZSk7XG4gICAgICAgICAgICBsb2dFcnJvclRvQ29uc29sZShlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgaW5Mb2cgPSBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbG9nRXJyb3JUb0NvbnNvbGUoZXJyb3IsIGNvbnRleHQgPSBmYWxzZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiT3BlbldQTTogRXJyb3IgbmFtZTogXCIgKyBlcnJvci5uYW1lKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk9wZW5XUE06IEVycm9yIG1lc3NhZ2U6IFwiICsgZXJyb3IubWVzc2FnZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJPcGVuV1BNOiBFcnJvciBmaWxlbmFtZTogXCIgKyBlcnJvci5maWxlTmFtZSk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJPcGVuV1BNOiBFcnJvciBsaW5lIG51bWJlcjogXCIgKyBlcnJvci5saW5lTnVtYmVyKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk9wZW5XUE06IEVycm9yIHN0YWNrOiBcIiArIGVycm9yLnN0YWNrKTtcbiAgICAgICAgaWYgKGNvbnRleHQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJPcGVuV1BNOiBFcnJvciBjb250ZXh0OiBcIiArIEpTT04uc3RyaW5naWZ5KGNvbnRleHQpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBIZWxwZXIgdG8gZ2V0IG9yaWdpbmF0aW5nIHNjcmlwdCB1cmxzXG4gICAgZnVuY3Rpb24gZ2V0U3RhY2tUcmFjZSgpIHtcbiAgICAgICAgbGV0IHN0YWNrO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgc3RhY2sgPSBlcnIuc3RhY2s7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0YWNrO1xuICAgIH1cbiAgICAvLyBmcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzUyMDIxODVcbiAgICBjb25zdCByc3BsaXQgPSBmdW5jdGlvbiAoc291cmNlLCBzZXAsIG1heHNwbGl0KSB7XG4gICAgICAgIGNvbnN0IHNwbGl0ID0gc291cmNlLnNwbGl0KHNlcCk7XG4gICAgICAgIHJldHVybiBtYXhzcGxpdFxuICAgICAgICAgICAgPyBbc3BsaXQuc2xpY2UoMCwgLW1heHNwbGl0KS5qb2luKHNlcCldLmNvbmNhdChzcGxpdC5zbGljZSgtbWF4c3BsaXQpKVxuICAgICAgICAgICAgOiBzcGxpdDtcbiAgICB9O1xuICAgIGZ1bmN0aW9uIGdldE9yaWdpbmF0aW5nU2NyaXB0Q29udGV4dChnZXRDYWxsU3RhY2sgPSBmYWxzZSkge1xuICAgICAgICBjb25zdCB0cmFjZSA9IGdldFN0YWNrVHJhY2UoKVxuICAgICAgICAgICAgLnRyaW0oKVxuICAgICAgICAgICAgLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAvLyByZXR1cm4gYSBjb250ZXh0IG9iamVjdCBldmVuIGlmIHRoZXJlIGlzIGFuIGVycm9yXG4gICAgICAgIGNvbnN0IGVtcHR5X2NvbnRleHQgPSB7XG4gICAgICAgICAgICBzY3JpcHRVcmw6IFwiXCIsXG4gICAgICAgICAgICBzY3JpcHRMaW5lOiBcIlwiLFxuICAgICAgICAgICAgc2NyaXB0Q29sOiBcIlwiLFxuICAgICAgICAgICAgZnVuY05hbWU6IFwiXCIsXG4gICAgICAgICAgICBzY3JpcHRMb2NFdmFsOiBcIlwiLFxuICAgICAgICAgICAgY2FsbFN0YWNrOiBcIlwiLFxuICAgICAgICB9O1xuICAgICAgICBpZiAodHJhY2UubGVuZ3RoIDwgNCkge1xuICAgICAgICAgICAgcmV0dXJuIGVtcHR5X2NvbnRleHQ7XG4gICAgICAgIH1cbiAgICAgICAgLy8gMCwgMSBhbmQgMiBhcmUgT3BlbldQTSdzIG93biBmdW5jdGlvbnMgKGUuZy4gZ2V0U3RhY2tUcmFjZSksIHNraXAgdGhlbS5cbiAgICAgICAgY29uc3QgY2FsbFNpdGUgPSB0cmFjZVszXTtcbiAgICAgICAgaWYgKCFjYWxsU2l0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVtcHR5X2NvbnRleHQ7XG4gICAgICAgIH1cbiAgICAgICAgLypcbiAgICAgICAgICogU3RhY2sgZnJhbWUgZm9ybWF0IGlzIHNpbXBseTogRlVOQ19OQU1FQEZJTEVOQU1FOkxJTkVfTk86Q09MVU1OX05PXG4gICAgICAgICAqXG4gICAgICAgICAqIElmIGV2YWwgb3IgRnVuY3Rpb24gaXMgaW52b2x2ZWQgd2UgaGF2ZSBhbiBhZGRpdGlvbmFsIHBhcnQgYWZ0ZXIgdGhlIEZJTEVOQU1FLCBlLmcuOlxuICAgICAgICAgKiBGVU5DX05BTUVARklMRU5BTUUgbGluZSAxMjMgPiBldmFsIGxpbmUgMSA+IGV2YWw6TElORV9OTzpDT0xVTU5fTk9cbiAgICAgICAgICogb3IgRlVOQ19OQU1FQEZJTEVOQU1FIGxpbmUgMjM0ID4gRnVuY3Rpb246TElORV9OTzpDT0xVTU5fTk9cbiAgICAgICAgICpcbiAgICAgICAgICogV2Ugc3RvcmUgdGhlIHBhcnQgYmV0d2VlbiB0aGUgRklMRU5BTUUgYW5kIHRoZSBMSU5FX05PIGluIHNjcmlwdExvY0V2YWxcbiAgICAgICAgICovXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgc2NyaXB0VXJsID0gXCJcIjtcbiAgICAgICAgICAgIGxldCBzY3JpcHRMb2NFdmFsID0gXCJcIjsgLy8gZm9yIGV2YWwgb3IgRnVuY3Rpb24gY2FsbHNcbiAgICAgICAgICAgIGNvbnN0IGNhbGxTaXRlUGFydHMgPSBjYWxsU2l0ZS5zcGxpdChcIkBcIik7XG4gICAgICAgICAgICBjb25zdCBmdW5jTmFtZSA9IGNhbGxTaXRlUGFydHNbMF0gfHwgXCJcIjtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gcnNwbGl0KGNhbGxTaXRlUGFydHNbMV0sIFwiOlwiLCAyKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbHVtbk5vID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICBjb25zdCBsaW5lTm8gPSBpdGVtc1tpdGVtcy5sZW5ndGggLSAyXTtcbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdEZpbGVOYW1lID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gM10gfHwgXCJcIjtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVOb0lkeCA9IHNjcmlwdEZpbGVOYW1lLmluZGV4T2YoXCIgbGluZSBcIik7IC8vIGxpbmUgaW4gdGhlIFVSTCBtZWFucyBldmFsIG9yIEZ1bmN0aW9uXG4gICAgICAgICAgICBpZiAobGluZU5vSWR4ID09PSAtMSkge1xuICAgICAgICAgICAgICAgIHNjcmlwdFVybCA9IHNjcmlwdEZpbGVOYW1lOyAvLyBUT0RPOiBzb21ldGltZXMgd2UgaGF2ZSBmaWxlbmFtZSBvbmx5LCBlLmcuIFhYLmpzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzY3JpcHRVcmwgPSBzY3JpcHRGaWxlTmFtZS5zbGljZSgwLCBsaW5lTm9JZHgpO1xuICAgICAgICAgICAgICAgIHNjcmlwdExvY0V2YWwgPSBzY3JpcHRGaWxlTmFtZS5zbGljZShsaW5lTm9JZHggKyAxLCBzY3JpcHRGaWxlTmFtZS5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY2FsbENvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgc2NyaXB0VXJsLFxuICAgICAgICAgICAgICAgIHNjcmlwdExpbmU6IGxpbmVObyxcbiAgICAgICAgICAgICAgICBzY3JpcHRDb2w6IGNvbHVtbk5vLFxuICAgICAgICAgICAgICAgIGZ1bmNOYW1lLFxuICAgICAgICAgICAgICAgIHNjcmlwdExvY0V2YWwsXG4gICAgICAgICAgICAgICAgY2FsbFN0YWNrOiBnZXRDYWxsU3RhY2tcbiAgICAgICAgICAgICAgICAgICAgPyB0cmFjZVxuICAgICAgICAgICAgICAgICAgICAgICAgLnNsaWNlKDMpXG4gICAgICAgICAgICAgICAgICAgICAgICAuam9pbihcIlxcblwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRyaW0oKVxuICAgICAgICAgICAgICAgICAgICA6IFwiXCIsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxDb250ZXh0O1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIk9wZW5XUE06IEVycm9yIHBhcnNpbmcgdGhlIHNjcmlwdCBjb250ZXh0XCIsIGUudG9TdHJpbmcoKSwgY2FsbFNpdGUpO1xuICAgICAgICAgICAgcmV0dXJuIGVtcHR5X2NvbnRleHQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gaXNPYmplY3Qob2JqZWN0LCBwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICAgbGV0IHByb3BlcnR5O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcHJvcGVydHkgPSBvYmplY3RbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcGVydHkgPT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIG51bGwgaXMgdHlwZSBcIm9iamVjdFwiXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHR5cGVvZiBwcm9wZXJ0eSA9PT0gXCJvYmplY3RcIjtcbiAgICB9XG4gICAgLy8gTG9nIGNhbGxzIHRvIGEgZ2l2ZW4gZnVuY3Rpb25cbiAgICAvLyBUaGlzIGhlbHBlciBmdW5jdGlvbiByZXR1cm5zIGEgd3JhcHBlciBhcm91bmQgYGZ1bmNgIHdoaWNoIGxvZ3MgY2FsbHNcbiAgICAvLyB0byBgZnVuY2AuIGBvYmplY3ROYW1lYCBhbmQgYG1ldGhvZE5hbWVgIGFyZSB1c2VkIHN0cmljdGx5IHRvIGlkZW50aWZ5XG4gICAgLy8gd2hpY2ggb2JqZWN0IG1ldGhvZCBgZnVuY2AgaXMgY29taW5nIGZyb20gaW4gdGhlIGxvZ3NcbiAgICBmdW5jdGlvbiBpbnN0cnVtZW50RnVuY3Rpb24ob2JqZWN0TmFtZSwgbWV0aG9kTmFtZSwgZnVuYywgbG9nU2V0dGluZ3MpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbGxDb250ZXh0ID0gZ2V0T3JpZ2luYXRpbmdTY3JpcHRDb250ZXh0KGxvZ1NldHRpbmdzLmxvZ0NhbGxTdGFjayk7XG4gICAgICAgICAgICBsb2dDYWxsKG9iamVjdE5hbWUgKyBcIi5cIiArIG1ldGhvZE5hbWUsIGFyZ3VtZW50cywgY2FsbENvbnRleHQsIGxvZ1NldHRpbmdzKTtcbiAgICAgICAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIC8vIExvZyBwcm9wZXJ0aWVzIG9mIHByb3RvdHlwZXMgYW5kIG9iamVjdHNcbiAgICBmdW5jdGlvbiBpbnN0cnVtZW50T2JqZWN0UHJvcGVydHkob2JqZWN0LCBvYmplY3ROYW1lLCBwcm9wZXJ0eU5hbWUsIGxvZ1NldHRpbmdzKSB7XG4gICAgICAgIGlmICghb2JqZWN0IHx8XG4gICAgICAgICAgICAhb2JqZWN0TmFtZSB8fFxuICAgICAgICAgICAgIXByb3BlcnR5TmFtZSB8fFxuICAgICAgICAgICAgcHJvcGVydHlOYW1lID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcmVxdWVzdCB0byBpbnN0cnVtZW50T2JqZWN0UHJvcGVydHkuXG4gICAgICAgIE9iamVjdDogJHtvYmplY3R9XG4gICAgICAgIG9iamVjdE5hbWU6ICR7b2JqZWN0TmFtZX1cbiAgICAgICAgcHJvcGVydHlOYW1lOiAke3Byb3BlcnR5TmFtZX1cbiAgICAgICAgYCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU3RvcmUgb3JpZ2luYWwgZGVzY3JpcHRvciBpbiBjbG9zdXJlXG4gICAgICAgIGNvbnN0IHByb3BEZXNjID0gT2JqZWN0LmdldFByb3BlcnR5RGVzY3JpcHRvcihvYmplY3QsIHByb3BlcnR5TmFtZSk7XG4gICAgICAgIC8vIFByb3BlcnR5IGRlc2NyaXB0b3IgbXVzdCBleGlzdCB1bmxlc3Mgd2UgYXJlIGluc3RydW1lbnRpbmcgYSBub25FeGlzdGluZyBwcm9wZXJ0eVxuICAgICAgICBpZiAoIXByb3BEZXNjICYmXG4gICAgICAgICAgICAhbG9nU2V0dGluZ3Mubm9uRXhpc3RpbmdQcm9wZXJ0aWVzVG9JbnN0cnVtZW50LmluY2x1ZGVzKHByb3BlcnR5TmFtZSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJQcm9wZXJ0eSBkZXNjcmlwdG9yIG5vdCBmb3VuZCBmb3JcIiwgb2JqZWN0TmFtZSwgcHJvcGVydHlOYW1lLCBvYmplY3QpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIFByb3BlcnR5IGRlc2NyaXB0b3IgZm9yIHVuZGVmaW5lZCBwcm9wZXJ0aWVzXG4gICAgICAgIGxldCB1bmRlZmluZWRQcm9wVmFsdWU7XG4gICAgICAgIGNvbnN0IHVuZGVmaW5lZFByb3BEZXNjID0ge1xuICAgICAgICAgICAgZ2V0OiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZFByb3BWYWx1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IHZhbHVlID0+IHtcbiAgICAgICAgICAgICAgICB1bmRlZmluZWRQcm9wVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgfTtcbiAgICAgICAgLy8gSW5zdHJ1bWVudCBkYXRhIG9yIGFjY2Vzc29yIHByb3BlcnR5IGRlc2NyaXB0b3JzXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsR2V0dGVyID0gcHJvcERlc2MgPyBwcm9wRGVzYy5nZXQgOiB1bmRlZmluZWRQcm9wRGVzYy5nZXQ7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsU2V0dGVyID0gcHJvcERlc2MgPyBwcm9wRGVzYy5zZXQgOiB1bmRlZmluZWRQcm9wRGVzYy5zZXQ7XG4gICAgICAgIGxldCBvcmlnaW5hbFZhbHVlID0gcHJvcERlc2MgPyBwcm9wRGVzYy52YWx1ZSA6IHVuZGVmaW5lZFByb3BWYWx1ZTtcbiAgICAgICAgLy8gV2Ugb3ZlcndyaXRlIGJvdGggZGF0YSBhbmQgYWNjZXNzb3IgcHJvcGVydGllcyBhcyBhbiBpbnN0cnVtZW50ZWRcbiAgICAgICAgLy8gYWNjZXNzb3IgcHJvcGVydHlcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgcHJvcGVydHlOYW1lLCB7XG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICBnZXQ6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG9yaWdQcm9wZXJ0eTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FsbENvbnRleHQgPSBnZXRPcmlnaW5hdGluZ1NjcmlwdENvbnRleHQobG9nU2V0dGluZ3MubG9nQ2FsbFN0YWNrKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdHJ1bWVudGVkVmFyaWFibGVOYW1lID0gYCR7b2JqZWN0TmFtZX0uJHtwcm9wZXJ0eU5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IG9yaWdpbmFsIHZhbHVlXG4gICAgICAgICAgICAgICAgICAgIGlmICghcHJvcERlc2MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHVuZGVmaW5lZCBwcm9wZXJ0eVxuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ1Byb3BlcnR5ID0gdW5kZWZpbmVkUHJvcFZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG9yaWdpbmFsR2V0dGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBhY2Nlc3NvciBwcm9wZXJ0eVxuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ1Byb3BlcnR5ID0gb3JpZ2luYWxHZXR0ZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChcInZhbHVlXCIgaW4gcHJvcERlc2MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIGRhdGEgcHJvcGVydHlcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdQcm9wZXJ0eSA9IG9yaWdpbmFsVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBQcm9wZXJ0eSBkZXNjcmlwdG9yIGZvciAke2luc3RydW1lbnRlZFZhcmlhYmxlTmFtZX0gZG9lc24ndCBoYXZlIGdldHRlciBvciB2YWx1ZT9gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ1ZhbHVlKGluc3RydW1lbnRlZFZhcmlhYmxlTmFtZSwgXCJcIiwgSlNPcGVyYXRpb24uZ2V0X2ZhaWxlZCwgY2FsbENvbnRleHQsIGxvZ1NldHRpbmdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBMb2cgYGdldHNgIGV4Y2VwdCB0aG9zZSB0aGF0IGhhdmUgaW5zdHJ1bWVudGVkIHJldHVybiB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgLy8gKiBBbGwgcmV0dXJuZWQgZnVuY3Rpb25zIGFyZSBpbnN0cnVtZW50ZWQgd2l0aCBhIHdyYXBwZXJcbiAgICAgICAgICAgICAgICAgICAgLy8gKiBSZXR1cm5lZCBvYmplY3RzIG1heSBiZSBpbnN0cnVtZW50ZWQgaWYgcmVjdXJzaXZlXG4gICAgICAgICAgICAgICAgICAgIC8vICAgaW5zdHJ1bWVudGF0aW9uIGlzIGVuYWJsZWQgYW5kIHRoaXMgaXNuJ3QgYXQgdGhlIGRlcHRoIGxpbWl0LlxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9yaWdQcm9wZXJ0eSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9nU2V0dGluZ3MubG9nRnVuY3Rpb25HZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nVmFsdWUoaW5zdHJ1bWVudGVkVmFyaWFibGVOYW1lLCBvcmlnUHJvcGVydHksIEpTT3BlcmF0aW9uLmdldF9mdW5jdGlvbiwgY2FsbENvbnRleHQsIGxvZ1NldHRpbmdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGluc3RydW1lbnRlZEZ1bmN0aW9uV3JhcHBlciA9IGluc3RydW1lbnRGdW5jdGlvbihvYmplY3ROYW1lLCBwcm9wZXJ0eU5hbWUsIG9yaWdQcm9wZXJ0eSwgbG9nU2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVzdG9yZSB0aGUgb3JpZ2luYWwgcHJvdG90eXBlIGFuZCBjb25zdHJ1Y3RvciBzbyB0aGF0IGluc3RydW1lbnRlZCBjbGFzc2VzIHJlbWFpbiBpbnRhY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IFRoaXMgbWF5IGhhdmUgaW50cm9kdWNlZCBwcm90b3R5cGUgcG9sbHV0aW9uIGFzIHBlciBodHRwczovL2dpdGh1Yi5jb20vbW96aWxsYS9PcGVuV1BNL2lzc3Vlcy80NzFcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcmlnUHJvcGVydHkucHJvdG90eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdHJ1bWVudGVkRnVuY3Rpb25XcmFwcGVyLnByb3RvdHlwZSA9IG9yaWdQcm9wZXJ0eS5wcm90b3R5cGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9yaWdQcm9wZXJ0eS5wcm90b3R5cGUuY29uc3RydWN0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdHJ1bWVudGVkRnVuY3Rpb25XcmFwcGVyLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmlnUHJvcGVydHkucHJvdG90eXBlLmNvbnN0cnVjdG9yO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0cnVtZW50ZWRGdW5jdGlvbldyYXBwZXI7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9yaWdQcm9wZXJ0eSA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nU2V0dGluZ3MucmVjdXJzaXZlICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dTZXR0aW5ncy5kZXB0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvcmlnUHJvcGVydHk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dWYWx1ZShpbnN0cnVtZW50ZWRWYXJpYWJsZU5hbWUsIG9yaWdQcm9wZXJ0eSwgSlNPcGVyYXRpb24uZ2V0LCBjYWxsQ29udGV4dCwgbG9nU2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9yaWdQcm9wZXJ0eTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KSgpLFxuICAgICAgICAgICAgc2V0OiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FsbENvbnRleHQgPSBnZXRPcmlnaW5hdGluZ1NjcmlwdENvbnRleHQobG9nU2V0dGluZ3MubG9nQ2FsbFN0YWNrKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5zdHJ1bWVudGVkVmFyaWFibGVOYW1lID0gYCR7b2JqZWN0TmFtZX0uJHtwcm9wZXJ0eU5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJldHVyblZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IHNldHMgZm9yIGZ1bmN0aW9ucyBhbmQgb2JqZWN0cyBpZiBlbmFibGVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2dTZXR0aW5ncy5wcmV2ZW50U2V0cyAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgKHR5cGVvZiBvcmlnaW5hbFZhbHVlID09PSBcImZ1bmN0aW9uXCIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2Ygb3JpZ2luYWxWYWx1ZSA9PT0gXCJvYmplY3RcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ1ZhbHVlKGluc3RydW1lbnRlZFZhcmlhYmxlTmFtZSwgdmFsdWUsIEpTT3BlcmF0aW9uLnNldF9wcmV2ZW50ZWQsIGNhbGxDb250ZXh0LCBsb2dTZXR0aW5ncyk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gc2V0IG5ldyB2YWx1ZSB0byBvcmlnaW5hbCBzZXR0ZXIvbG9jYXRpb25cbiAgICAgICAgICAgICAgICAgICAgaWYgKG9yaWdpbmFsU2V0dGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBhY2Nlc3NvciBwcm9wZXJ0eVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuVmFsdWUgPSBvcmlnaW5hbFNldHRlci5jYWxsKHRoaXMsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChcInZhbHVlXCIgaW4gcHJvcERlc2MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluTG9nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmplY3QuaXNQcm90b3R5cGVPZih0aGlzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wZXJ0eU5hbWUsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbFZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5WYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5Mb2cgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFByb3BlcnR5IGRlc2NyaXB0b3IgZm9yICR7aW5zdHJ1bWVudGVkVmFyaWFibGVOYW1lfSBkb2Vzbid0IGhhdmUgc2V0dGVyIG9yIHZhbHVlP2ApO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nVmFsdWUoaW5zdHJ1bWVudGVkVmFyaWFibGVOYW1lLCB2YWx1ZSwgSlNPcGVyYXRpb24uc2V0X2ZhaWxlZCwgY2FsbENvbnRleHQsIGxvZ1NldHRpbmdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsb2dWYWx1ZShpbnN0cnVtZW50ZWRWYXJpYWJsZU5hbWUsIHZhbHVlLCBKU09wZXJhdGlvbi5zZXQsIGNhbGxDb250ZXh0LCBsb2dTZXR0aW5ncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSkoKSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGluc3RydW1lbnRPYmplY3Qob2JqZWN0LCBpbnN0cnVtZW50ZWROYW1lLCBsb2dTZXR0aW5ncykge1xuICAgICAgICAvLyBTZXQgcHJvcGVydGllc1RvSW5zdHJ1bWVudCB0byBudWxsIHRvIGZvcmNlIG5vIHByb3BlcnRpZXMgdG8gYmUgaW5zdHJ1bWVudGVkLlxuICAgICAgICAvLyAodGhpcyBpcyB1c2VkIGluIHRlc3RpbmcgZm9yIGV4YW1wbGUpXG4gICAgICAgIGxldCBwcm9wZXJ0aWVzVG9JbnN0cnVtZW50O1xuICAgICAgICBpZiAobG9nU2V0dGluZ3MucHJvcGVydGllc1RvSW5zdHJ1bWVudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcHJvcGVydGllc1RvSW5zdHJ1bWVudCA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGxvZ1NldHRpbmdzLnByb3BlcnRpZXNUb0luc3RydW1lbnQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBwcm9wZXJ0aWVzVG9JbnN0cnVtZW50ID0gT2JqZWN0LmdldFByb3BlcnR5TmFtZXMob2JqZWN0KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHByb3BlcnRpZXNUb0luc3RydW1lbnQgPSBsb2dTZXR0aW5ncy5wcm9wZXJ0aWVzVG9JbnN0cnVtZW50O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcHJvcGVydHlOYW1lIG9mIHByb3BlcnRpZXNUb0luc3RydW1lbnQpIHtcbiAgICAgICAgICAgIGlmIChsb2dTZXR0aW5ncy5leGNsdWRlZFByb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHlOYW1lKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gSWYgYHJlY3Vyc2l2ZWAgZmxhZyBzZXQgd2Ugd2FudCB0byByZWN1cnNpdmVseSBpbnN0cnVtZW50IGFueVxuICAgICAgICAgICAgLy8gb2JqZWN0IHByb3BlcnRpZXMgdGhhdCBhcmVuJ3QgdGhlIHByb3RvdHlwZSBvYmplY3QuXG4gICAgICAgICAgICBpZiAobG9nU2V0dGluZ3MucmVjdXJzaXZlICYmXG4gICAgICAgICAgICAgICAgbG9nU2V0dGluZ3MuZGVwdGggPiAwICYmXG4gICAgICAgICAgICAgICAgaXNPYmplY3Qob2JqZWN0LCBwcm9wZXJ0eU5hbWUpICYmXG4gICAgICAgICAgICAgICAgcHJvcGVydHlOYW1lICE9PSBcIl9fcHJvdG9fX1wiKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3SW5zdHJ1bWVudGVkTmFtZSA9IGAke2luc3RydW1lbnRlZE5hbWV9LiR7cHJvcGVydHlOYW1lfWA7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3TG9nU2V0dGluZ3MgPSB7IC4uLmxvZ1NldHRpbmdzIH07XG4gICAgICAgICAgICAgICAgbmV3TG9nU2V0dGluZ3MuZGVwdGggPSBsb2dTZXR0aW5ncy5kZXB0aCAtIDE7XG4gICAgICAgICAgICAgICAgbmV3TG9nU2V0dGluZ3MucHJvcGVydGllc1RvSW5zdHJ1bWVudCA9IFtdO1xuICAgICAgICAgICAgICAgIGluc3RydW1lbnRPYmplY3Qob2JqZWN0W3Byb3BlcnR5TmFtZV0sIG5ld0luc3RydW1lbnRlZE5hbWUsIG5ld0xvZ1NldHRpbmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaW5zdHJ1bWVudE9iamVjdFByb3BlcnR5KG9iamVjdCwgaW5zdHJ1bWVudGVkTmFtZSwgcHJvcGVydHlOYW1lLCBsb2dTZXR0aW5ncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBUeXBlRXJyb3IgJiZcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IubWVzc2FnZS5pbmNsdWRlcyhcImNhbid0IHJlZGVmaW5lIG5vbi1jb25maWd1cmFibGUgcHJvcGVydHlcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBDYW5ub3QgaW5zdHJ1bWVudCBub24tY29uZmlndXJhYmxlIHByb3BlcnR5OiAke2luc3RydW1lbnRlZE5hbWV9OiR7cHJvcGVydHlOYW1lfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRXJyb3JUb0NvbnNvbGUoZXJyb3IsIHsgaW5zdHJ1bWVudGVkTmFtZSwgcHJvcGVydHlOYW1lIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHByb3BlcnR5TmFtZSBvZiBsb2dTZXR0aW5ncy5ub25FeGlzdGluZ1Byb3BlcnRpZXNUb0luc3RydW1lbnQpIHtcbiAgICAgICAgICAgIGlmIChsb2dTZXR0aW5ncy5leGNsdWRlZFByb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHlOYW1lKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpbnN0cnVtZW50T2JqZWN0UHJvcGVydHkob2JqZWN0LCBpbnN0cnVtZW50ZWROYW1lLCBwcm9wZXJ0eU5hbWUsIGxvZ1NldHRpbmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yVG9Db25zb2xlKGVycm9yLCB7IGluc3RydW1lbnRlZE5hbWUsIHByb3BlcnR5TmFtZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBzZW5kRmFjdG9yeSA9IGZ1bmN0aW9uIChldmVudElkLCAkc2VuZE1lc3NhZ2VzVG9Mb2dnZXIpIHtcbiAgICAgICAgbGV0IG1lc3NhZ2VzID0gW107XG4gICAgICAgIC8vIGRlYm91bmNlIHNlbmRpbmcgcXVldWVkIG1lc3NhZ2VzXG4gICAgICAgIGNvbnN0IF9zZW5kID0gZGVib3VuY2UoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNlbmRNZXNzYWdlc1RvTG9nZ2VyKGV2ZW50SWQsIG1lc3NhZ2VzKTtcbiAgICAgICAgICAgIC8vIGNsZWFyIHRoZSBxdWV1ZVxuICAgICAgICAgICAgbWVzc2FnZXMgPSBbXTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChtc2dUeXBlLCBtc2cpIHtcbiAgICAgICAgICAgIC8vIHF1ZXVlIHRoZSBtZXNzYWdlXG4gICAgICAgICAgICBtZXNzYWdlcy5wdXNoKHsgdHlwZTogbXNnVHlwZSwgY29udGVudDogbXNnIH0pO1xuICAgICAgICAgICAgX3NlbmQoKTtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIGNvbnN0IHNlbmQgPSBzZW5kRmFjdG9yeShldmVudElkLCBzZW5kTWVzc2FnZXNUb0xvZ2dlcik7XG4gICAgZnVuY3Rpb24gaW5zdHJ1bWVudEpTKEpTSW5zdHJ1bWVudFJlcXVlc3RzKSB7XG4gICAgICAgIC8vIFRoZSBKUyBJbnN0cnVtZW50IFJlcXVlc3RzIGFyZSBzZXR1cCBhbmQgdmFsaWRhdGVkIHB5dGhvbiBzaWRlXG4gICAgICAgIC8vIGluY2x1ZGluZyBzZXR0aW5nIGRlZmF1bHRzIGZvciBsb2dTZXR0aW5ncy5cbiAgICAgICAgLy8gTW9yZSBkZXRhaWxzIGFib3V0IGhvdyB0aGlzIGZ1bmN0aW9uIGlzIGludm9rZWQgYXJlIGluXG4gICAgICAgIC8vIGNvbnRlbnQvamF2YXNjcmlwdC1pbnN0cnVtZW50LWNvbnRlbnQtc2NvcGUudHNcbiAgICAgICAgSlNJbnN0cnVtZW50UmVxdWVzdHMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgaW5zdHJ1bWVudE9iamVjdChldmFsKGl0ZW0ub2JqZWN0KSwgaXRlbS5pbnN0cnVtZW50ZWROYW1lLCBpdGVtLmxvZ1NldHRpbmdzKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vIFRoaXMgd2hvbGUgZnVuY3Rpb24gZ2V0SW5zdHJ1bWVudEpTIHJldHVybnMganVzdCB0aGUgZnVuY3Rpb24gYGluc3RydW1lbnRKU2AuXG4gICAgcmV0dXJuIGluc3RydW1lbnRKUztcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWFuTXRhVzV6ZEhKMWJXVnVkSE11YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sY3lJNld5SXVMaTh1TGk4dUxpOXpjbU12YkdsaUwycHpMV2x1YzNSeWRXMWxiblJ6TG5SeklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lKQlFVRkJMR2xGUVVGcFJUdEJRVU5xUlN4dlJrRkJiMFk3UVVFNFFuQkdMRTFCUVUwc1ZVRkJWU3hsUVVGbExFTkJRVU1zVDBGQlpTeEZRVUZGTEc5Q1FVRnZRanRKUVVOdVJUczdPMDlCUjBjN1NVRkZTQ3h0UlVGQmJVVTdTVUZEYmtVc1RVRkJUU3hYUVVGWExFZEJRVWNzUjBGQlJ5eERRVUZETzBsQlEzaENMR0ZCUVdFN1NVRkRZaXhOUVVGTkxGVkJRVlVzUjBGQlJ5eEpRVUZKTEUxQlFVMHNSVUZCUlN4RFFVRkRPMGxCUTJoRExDdERRVUVyUXp0SlFVTXZReXhKUVVGSkxFdEJRVXNzUjBGQlJ5eExRVUZMTEVOQlFVTTdTVUZEYkVJc1owUkJRV2RFTzBsQlEyaEVMRWxCUVVrc1QwRkJUeXhIUVVGSExFTkJRVU1zUTBGQlF6dEpRVVZvUWl3d1FrRkJNRUk3U1VGRE1VSXNUVUZCVFN4WFFVRlhMRWRCUVVjN1VVRkRiRUlzU1VGQlNTeEZRVUZGTEUxQlFVMDdVVUZEV2l4SFFVRkhMRVZCUVVVc1MwRkJTenRSUVVOV0xGVkJRVlVzUlVGQlJTeGhRVUZoTzFGQlEzcENMRmxCUVZrc1JVRkJSU3hsUVVGbE8xRkJRemRDTEVkQlFVY3NSVUZCUlN4TFFVRkxPMUZCUTFZc1ZVRkJWU3hGUVVGRkxHRkJRV0U3VVVGRGVrSXNZVUZCWVN4RlFVRkZMR2RDUVVGblFqdExRVU5vUXl4RFFVRkRPMGxCUlVZc2IwWkJRVzlHTzBsQlEzQkdMSGxGUVVGNVJUdEpRVU42UlN4TlFVRk5MRU5CUVVNc2NVSkJRWEZDTEVkQlFVY3NWVUZCVXl4UFFVRlBMRVZCUVVVc1NVRkJTVHRSUVVOdVJDeEpRVUZKTEU5QlFVOHNTMEZCU3l4VFFVRlRMRVZCUVVVN1dVRkRla0lzVFVGQlRTeEpRVUZKTEV0QlFVc3NRMEZCUXl3MlEwRkJOa01zUTBGQlF5eERRVUZETzFOQlEyaEZPMUZCUTBRc1NVRkJTU3hGUVVGRkxFZEJRVWNzVFVGQlRTeERRVUZETEhkQ1FVRjNRaXhEUVVGRExFOUJRVThzUlVGQlJTeEpRVUZKTEVOQlFVTXNRMEZCUXp0UlFVTjRSQ3hKUVVGSkxFdEJRVXNzUjBGQlJ5eE5RVUZOTEVOQlFVTXNZMEZCWXl4RFFVRkRMRTlCUVU4c1EwRkJReXhEUVVGRE8xRkJRek5ETEU5QlFVOHNSVUZCUlN4TFFVRkxMRk5CUVZNc1NVRkJTU3hMUVVGTExFdEJRVXNzU1VGQlNTeEZRVUZGTzFsQlEzcERMRVZCUVVVc1IwRkJSeXhOUVVGTkxFTkJRVU1zZDBKQlFYZENMRU5CUVVNc1MwRkJTeXhGUVVGRkxFbEJRVWtzUTBGQlF5eERRVUZETzFsQlEyeEVMRXRCUVVzc1IwRkJSeXhOUVVGTkxFTkJRVU1zWTBGQll5eERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRPMU5CUTNSRE8xRkJRMFFzVDBGQlR5eEZRVUZGTEVOQlFVTTdTVUZEV2l4RFFVRkRMRU5CUVVNN1NVRkZSaXhOUVVGTkxFTkJRVU1zWjBKQlFXZENMRWRCUVVjc1ZVRkJVeXhQUVVGUE8xRkJRM2hETEVsQlFVa3NUMEZCVHl4TFFVRkxMRk5CUVZNc1JVRkJSVHRaUVVONlFpeE5RVUZOTEVsQlFVa3NTMEZCU3l4RFFVRkRMSGREUVVGM1F5eERRVUZETEVOQlFVTTdVMEZETTBRN1VVRkRSQ3hKUVVGSkxFdEJRVXNzUjBGQlJ5eE5RVUZOTEVOQlFVTXNiVUpCUVcxQ0xFTkJRVU1zVDBGQlR5eERRVUZETEVOQlFVTTdVVUZEYUVRc1NVRkJTU3hMUVVGTExFZEJRVWNzVFVGQlRTeERRVUZETEdOQlFXTXNRMEZCUXl4UFFVRlBMRU5CUVVNc1EwRkJRenRSUVVNelF5eFBRVUZQTEV0QlFVc3NTMEZCU3l4SlFVRkpMRVZCUVVVN1dVRkRja0lzUzBGQlN5eEhRVUZITEV0QlFVc3NRMEZCUXl4TlFVRk5MRU5CUVVNc1RVRkJUU3hEUVVGRExHMUNRVUZ0UWl4RFFVRkRMRXRCUVVzc1EwRkJReXhEUVVGRExFTkJRVU03V1VGRGVFUXNTMEZCU3l4SFFVRkhMRTFCUVUwc1EwRkJReXhqUVVGakxFTkJRVU1zUzBGQlN5eERRVUZETEVOQlFVTTdVMEZEZEVNN1VVRkRSQ3h2UkVGQmIwUTdVVUZEY0VRc1QwRkJUeXhMUVVGTExFTkJRVU03U1VGRFppeERRVUZETEVOQlFVTTdTVUZGUml4dlEwRkJiME03U1VGRGNFTXNVMEZCVXl4UlFVRlJMRU5CUVVNc1NVRkJTU3hGUVVGRkxFbEJRVWtzUlVGQlJTeFpRVUZ4UWl4TFFVRkxPMUZCUTNSRUxFbEJRVWtzVDBGQlR5eEZRVUZGTEVsQlFVa3NSVUZCUlN4UFFVRlBMRVZCUVVVc1UwRkJVeXhGUVVGRkxFMUJRVTBzUTBGQlF6dFJRVVU1UXl4TlFVRk5MRXRCUVVzc1IwRkJSenRaUVVOYUxFMUJRVTBzU1VGQlNTeEhRVUZITEVsQlFVa3NRMEZCUXl4SFFVRkhMRVZCUVVVc1IwRkJSeXhUUVVGVExFTkJRVU03V1VGRGNFTXNTVUZCU1N4SlFVRkpMRWRCUVVjc1NVRkJTU3hGUVVGRk8yZENRVU5tTEU5QlFVOHNSMEZCUnl4VlFVRlZMRU5CUVVNc1MwRkJTeXhGUVVGRkxFbEJRVWtzUjBGQlJ5eEpRVUZKTEVOQlFVTXNRMEZCUXp0aFFVTXhRenRwUWtGQlRUdG5Ra0ZEVEN4UFFVRlBMRWRCUVVjc1NVRkJTU3hEUVVGRE8yZENRVU5tTEVsQlFVa3NRMEZCUXl4VFFVRlRMRVZCUVVVN2IwSkJRMlFzVFVGQlRTeEhRVUZITEVsQlFVa3NRMEZCUXl4TFFVRkxMRU5CUVVNc1QwRkJUeXhGUVVGRkxFbEJRVWtzUTBGQlF5eERRVUZETzI5Q1FVTnVReXhQUVVGUExFZEJRVWNzU1VGQlNTeEhRVUZITEVsQlFVa3NRMEZCUXp0cFFrRkRka0k3WVVGRFJqdFJRVU5JTEVOQlFVTXNRMEZCUXp0UlFVVkdMRTlCUVU4N1dVRkRUQ3hQUVVGUExFZEJRVWNzU1VGQlNTeERRVUZETzFsQlEyWXNTVUZCU1N4SFFVRkhMRk5CUVZNc1EwRkJRenRaUVVOcVFpeFRRVUZUTEVkQlFVY3NTVUZCU1N4RFFVRkRMRWRCUVVjc1JVRkJSU3hEUVVGRE8xbEJRM1pDTEUxQlFVMHNUMEZCVHl4SFFVRkhMRk5CUVZNc1NVRkJTU3hEUVVGRExFOUJRVThzUTBGQlF6dFpRVU4wUXl4SlFVRkpMRU5CUVVNc1QwRkJUeXhGUVVGRk8yZENRVU5hTEU5QlFVOHNSMEZCUnl4VlFVRlZMRU5CUVVNc1MwRkJTeXhGUVVGRkxFbEJRVWtzUTBGQlF5eERRVUZETzJGQlEyNURPMWxCUTBRc1NVRkJTU3hQUVVGUExFVkJRVVU3WjBKQlExZ3NUVUZCVFN4SFFVRkhMRWxCUVVrc1EwRkJReXhMUVVGTExFTkJRVU1zVDBGQlR5eEZRVUZGTEVsQlFVa3NRMEZCUXl4RFFVRkRPMmRDUVVOdVF5eFBRVUZQTEVkQlFVY3NTVUZCU1N4SFFVRkhMRWxCUVVrc1EwRkJRenRoUVVOMlFqdFpRVVZFTEU5QlFVOHNUVUZCVFN4RFFVRkRPMUZCUTJoQ0xFTkJRVU1zUTBGQlF6dEpRVU5LTEVOQlFVTTdTVUZGUkN3NFEwRkJPRU03U1VGRE9VTXNVMEZCVXl4dFFrRkJiVUlzUTBGQlF5eFBRVUZaTEVWQlFVVXNhVUpCUVRCQ0xFdEJRVXM3VVVGRGVFVXNTVUZCU1N4UFFVRlBMRXRCUVVzc1VVRkJVU3hEUVVGRExFbEJRVWtzUlVGQlJUdFpRVU0zUWl4UFFVRlBMRTlCUVU4c1EwRkJReXhQUVVGUExFTkJRVU03VTBGRGVFSTdVVUZEUkN4SlFVRkpMRTlCUVU4c1EwRkJReXhWUVVGVkxFdEJRVXNzU1VGQlNTeEZRVUZGTzFsQlF5OUNMRTlCUVU4c1QwRkJUeXhIUVVGSExFOUJRVThzUTBGQlF5eFBRVUZQTEVOQlFVTTdVMEZEYkVNN1VVRkZSQ3hKUVVGSkxGbEJRVmtzUjBGQlJ5eERRVUZETEVOQlFVTTdVVUZEY2tJc1RVRkJUU3hSUVVGUkxFZEJRVWNzVDBGQlR5eERRVUZETEZWQlFWVXNRMEZCUXl4VlFVRlZMRU5CUVVNN1VVRkRMME1zUzBGQlN5eEpRVUZKTEVOQlFVTXNSMEZCUnl4RFFVRkRMRVZCUVVVc1EwRkJReXhIUVVGSExGRkJRVkVzUTBGQlF5eE5RVUZOTEVWQlFVVXNRMEZCUXl4RlFVRkZMRVZCUVVVN1dVRkRlRU1zVFVGQlRTeFBRVUZQTEVkQlFVY3NVVUZCVVN4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xbEJRelZDTEVsQlFVa3NUMEZCVHl4TFFVRkxMRTlCUVU4c1JVRkJSVHRuUWtGRGRrSXNTVUZCU1N4SlFVRkpMRWRCUVVjc2JVSkJRVzFDTEVOQlFVTXNUMEZCVHl4RFFVRkRMRlZCUVZVc1JVRkJSU3hqUVVGakxFTkJRVU1zUTBGQlF6dG5Ra0ZEYmtVc1NVRkJTU3hKUVVGSkxFZEJRVWNzUjBGQlJ5eFBRVUZQTEVOQlFVTXNUMEZCVHl4SFFVRkhMRWRCUVVjc1IwRkJSeXhaUVVGWkxFTkJRVU03WjBKQlEyNUVMRWxCUVVrc1NVRkJTU3hIUVVGSExFZEJRVWNzVDBGQlR5eERRVUZETEVWQlFVVXNRMEZCUXp0blFrRkRla0lzU1VGQlNTeEpRVUZKTEVkQlFVY3NSMEZCUnl4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRE8yZENRVU5vUXl4SlFVRkpMR05CUVdNc1JVRkJSVHR2UWtGRGJFSXNTVUZCU1N4SlFVRkpMRWRCUVVjc1IwRkJSeXhQUVVGUExFTkJRVU1zVFVGQlRTeERRVUZETzI5Q1FVTTNRaXhKUVVGSkxFbEJRVWtzUjBGQlJ5eEhRVUZITEU5QlFVOHNRMEZCUXl4TFFVRkxMRU5CUVVNc1QwRkJUeXhEUVVGRE8yOUNRVU53UXl4SlFVRkpMRWxCUVVrc1IwRkJSeXhIUVVGSExFOUJRVThzUTBGQlF5eExRVUZMTEVOQlFVTXNWVUZCVlN4RFFVRkRPMmxDUVVONFF6dG5Ra0ZEUkN4SlFVRkpMRTlCUVU4c1EwRkJReXhQUVVGUExFdEJRVXNzUjBGQlJ5eEZRVUZGTzI5Q1FVTXpRaXhKUVVGSkxFbEJRVWtzUjBGQlJ5eEhRVUZITEU5QlFVOHNRMEZCUXl4SlFVRkpMRU5CUVVNN2FVSkJRelZDTzJkQ1FVTkVMRWxCUVVrc1NVRkJTU3hIUVVGSExFTkJRVU03WjBKQlExb3NUMEZCVHl4SlFVRkpMRU5CUVVNN1lVRkRZanRaUVVORUxFbEJRVWtzVDBGQlR5eERRVUZETEZGQlFWRXNTMEZCU3l4RFFVRkRMRWxCUVVrc1QwRkJUeXhEUVVGRExFOUJRVThzUzBGQlN5eFBRVUZQTEVOQlFVTXNUMEZCVHl4RlFVRkZPMmRDUVVOcVJTeFpRVUZaTEVWQlFVVXNRMEZCUXp0aFFVTm9RanRUUVVOR08wbEJRMGdzUTBGQlF6dEpRVVZFTEdkRFFVRm5RenRKUVVOb1F5eFRRVUZUTEdWQlFXVXNRMEZEZEVJc1RVRkJUU3hGUVVOT0xIRkNRVUU0UWl4TFFVRkxPMUZCUlc1RExEUkNRVUUwUWp0UlFVTTFRaXhKUVVGSk8xbEJRMFlzU1VGQlNTeE5RVUZOTEV0QlFVc3NTVUZCU1N4RlFVRkZPMmRDUVVOdVFpeFBRVUZQTEUxQlFVMHNRMEZCUXp0aFFVTm1PMWxCUTBRc1NVRkJTU3hQUVVGUExFMUJRVTBzUzBGQlN5eFZRVUZWTEVWQlFVVTdaMEpCUTJoRExFbEJRVWtzYTBKQlFXdENMRVZCUVVVN2IwSkJRM1JDTEU5QlFVOHNUVUZCVFN4RFFVRkRMRkZCUVZFc1JVRkJSU3hEUVVGRE8ybENRVU14UWp0eFFrRkJUVHR2UWtGRFRDeFBRVUZQTEZWQlFWVXNRMEZCUXp0cFFrRkRia0k3WVVGRFJqdFpRVU5FTEVsQlFVa3NUMEZCVHl4TlFVRk5MRXRCUVVzc1VVRkJVU3hGUVVGRk8yZENRVU01UWl4UFFVRlBMRTFCUVUwc1EwRkJRenRoUVVObU8xbEJRMFFzVFVGQlRTeFhRVUZYTEVkQlFVY3NSVUZCUlN4RFFVRkRPMWxCUTNaQ0xFOUJRVThzU1VGQlNTeERRVUZETEZOQlFWTXNRMEZCUXl4TlFVRk5MRVZCUVVVc1ZVRkJVeXhIUVVGSExFVkJRVVVzUzBGQlN6dG5Ra0ZETDBNc1NVRkJTU3hMUVVGTExFdEJRVXNzU1VGQlNTeEZRVUZGTzI5Q1FVTnNRaXhQUVVGUExFMUJRVTBzUTBGQlF6dHBRa0ZEWmp0blFrRkRSQ3hKUVVGSkxFOUJRVThzUzBGQlN5eExRVUZMTEZWQlFWVXNSVUZCUlR0dlFrRkRMMElzU1VGQlNTeHJRa0ZCYTBJc1JVRkJSVHQzUWtGRGRFSXNUMEZCVHl4TFFVRkxMRU5CUVVNc1VVRkJVU3hGUVVGRkxFTkJRVU03Y1VKQlEzcENPM2xDUVVGTk8zZENRVU5NTEU5QlFVOHNWVUZCVlN4RFFVRkRPM0ZDUVVOdVFqdHBRa0ZEUmp0blFrRkRSQ3hKUVVGSkxFOUJRVThzUzBGQlN5eExRVUZMTEZGQlFWRXNSVUZCUlR0dlFrRkROMElzY1VOQlFYRkRPMjlDUVVOeVF5eEpRVUZKTEdsQ1FVRnBRaXhKUVVGSkxFdEJRVXNzUlVGQlJUdDNRa0ZET1VJc1MwRkJTeXhIUVVGSExFdEJRVXNzUTBGQlF5eGxRVUZsTEVOQlFVTTdjVUpCUXk5Q08yOUNRVVZFTEhsQ1FVRjVRanR2UWtGRGVrSXNTVUZCU1N4TFFVRkxMRmxCUVZrc1YwRkJWeXhGUVVGRk8zZENRVU5vUXl4UFFVRlBMRzFDUVVGdFFpeERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRPM0ZDUVVOdVF6dHZRa0ZGUkN3clFrRkJLMEk3YjBKQlF5OUNMRWxCUVVrc1IwRkJSeXhMUVVGTExFVkJRVVVzU1VGQlNTeFhRVUZYTEVOQlFVTXNUMEZCVHl4RFFVRkRMRXRCUVVzc1EwRkJReXhIUVVGSExFTkJRVU1zUlVGQlJUdDNRa0ZEYUVRc1YwRkJWeXhEUVVGRExFbEJRVWtzUTBGQlF5eExRVUZMTEVOQlFVTXNRMEZCUXp0M1FrRkRlRUlzVDBGQlR5eExRVUZMTEVOQlFVTTdjVUpCUTJRN2VVSkJRVTA3ZDBKQlEwd3NUMEZCVHl4UFFVRlBMRXRCUVVzc1EwRkJRenR4UWtGRGNrSTdhVUpCUTBZN1owSkJRMFFzVDBGQlR5eExRVUZMTEVOQlFVTTdXVUZEWml4RFFVRkRMRU5CUVVNc1EwRkJRenRUUVVOS08xRkJRVU1zVDBGQlR5eExRVUZMTEVWQlFVVTdXVUZEWkN4UFFVRlBMRU5CUVVNc1IwRkJSeXhEUVVGRExHZERRVUZuUXl4SFFVRkhMRXRCUVVzc1EwRkJReXhEUVVGRE8xbEJRM1JFTEU5QlFVOHNkVUpCUVhWQ0xFZEJRVWNzUzBGQlN5eERRVUZETzFOQlEzaERPMGxCUTBnc1EwRkJRenRKUVVWRUxGTkJRVk1zTWtKQlFUSkNMRU5CUVVNc1UwRkJVeXhGUVVGRkxFMUJRVTA3VVVGRGNFUXNUVUZCVFN4SFFVRkhMRWRCUVVjc1UwRkJVeXhIUVVGSExFZEJRVWNzUjBGQlJ5eE5RVUZOTEVOQlFVTTdVVUZEY2tNc1NVRkJTU3hIUVVGSExFbEJRVWtzVlVGQlZTeEpRVUZKTEZWQlFWVXNRMEZCUXl4SFFVRkhMRU5CUVVNc1NVRkJTU3hYUVVGWExFVkJRVVU3V1VGRGRrUXNUMEZCVHl4SlFVRkpMRU5CUVVNN1UwRkRZanRoUVVGTkxFbEJRVWtzUTBGQlF5eERRVUZETEVkQlFVY3NTVUZCU1N4VlFVRlZMRU5CUVVNc1JVRkJSVHRaUVVNdlFpeFZRVUZWTEVOQlFVTXNSMEZCUnl4RFFVRkRMRWRCUVVjc1EwRkJReXhEUVVGRE8xTkJRM0pDTzJGQlFVMDdXVUZEVEN4VlFVRlZMRU5CUVVNc1IwRkJSeXhEUVVGRExFbEJRVWtzUTBGQlF5eERRVUZETzFOQlEzUkNPMUZCUTBRc1QwRkJUeXhMUVVGTExFTkJRVU03U1VGRFppeERRVUZETzBsQlJVUXNlVU5CUVhsRE8wbEJRM3BETEZOQlFWTXNVVUZCVVN4RFFVTm1MSGRDUVVGblF5eEZRVU5vUXl4TFFVRlZMRVZCUTFZc1UwRkJhVUlzUlVGQlJTeHBRMEZCYVVNN1NVRkRjRVFzVjBGQlowSXNSVUZEYUVJc1YwRkJkMEk3VVVGRmVFSXNTVUZCU1N4TFFVRkxMRVZCUVVVN1dVRkRWQ3hQUVVGUE8xTkJRMUk3VVVGRFJDeExRVUZMTEVkQlFVY3NTVUZCU1N4RFFVRkRPMUZCUldJc1RVRkJUU3hUUVVGVExFZEJRVWNzTWtKQlFUSkNMRU5CUXpORExGZEJRVmNzUTBGQlF5eFRRVUZUTEVWQlEzSkNMSGRDUVVGM1FpeERRVU42UWl4RFFVRkRPMUZCUTBZc1NVRkJTU3hUUVVGVExFVkJRVVU3V1VGRFlpeExRVUZMTEVkQlFVY3NTMEZCU3l4RFFVRkRPMWxCUTJRc1QwRkJUenRUUVVOU08xRkJSVVFzVFVGQlRTeEhRVUZITEVkQlFVYzdXVUZEVml4VFFVRlRPMWxCUTFRc1RVRkJUU3hGUVVGRkxIZENRVUYzUWp0WlFVTm9ReXhMUVVGTExFVkJRVVVzWlVGQlpTeERRVUZETEV0QlFVc3NSVUZCUlN4WFFVRlhMRU5CUVVNc2NVSkJRWEZDTEVOQlFVTTdXVUZEYUVVc1UwRkJVeXhGUVVGRkxGZEJRVmNzUTBGQlF5eFRRVUZUTzFsQlEyaERMRlZCUVZVc1JVRkJSU3hYUVVGWExFTkJRVU1zVlVGQlZUdFpRVU5zUXl4VFFVRlRMRVZCUVVVc1YwRkJWeXhEUVVGRExGTkJRVk03V1VGRGFFTXNVVUZCVVN4RlFVRkZMRmRCUVZjc1EwRkJReXhSUVVGUk8xbEJRemxDTEdGQlFXRXNSVUZCUlN4WFFVRlhMRU5CUVVNc1lVRkJZVHRaUVVONFF5eFRRVUZUTEVWQlFVVXNWMEZCVnl4RFFVRkRMRk5CUVZNN1dVRkRhRU1zVDBGQlR5eEZRVUZGTEU5QlFVOHNSVUZCUlR0VFFVTnVRaXhEUVVGRE8xRkJSVVlzU1VGQlNUdFpRVU5HTEVsQlFVa3NRMEZCUXl4VlFVRlZMRVZCUVVVc1IwRkJSeXhEUVVGRExFTkJRVU03VTBGRGRrSTdVVUZCUXl4UFFVRlBMRXRCUVVzc1JVRkJSVHRaUVVOa0xFOUJRVThzUTBGQlF5eEhRVUZITEVOQlFVTXNhME5CUVd0RExFTkJRVU1zUTBGQlF6dFpRVU5vUkN4cFFrRkJhVUlzUTBGQlF5eExRVUZMTEVOQlFVTXNRMEZCUXp0VFFVTXhRanRSUVVWRUxFdEJRVXNzUjBGQlJ5eExRVUZMTEVOQlFVTTdTVUZEYUVJc1EwRkJRenRKUVVWRUxHZENRVUZuUWp0SlFVTm9RaXhUUVVGVExFOUJRVThzUTBGRFpDeDNRa0ZCWjBNc1JVRkRhRU1zU1VGQlowSXNSVUZEYUVJc1YwRkJaMElzUlVGRGFFSXNWMEZCZDBJN1VVRkZlRUlzU1VGQlNTeExRVUZMTEVWQlFVVTdXVUZEVkN4UFFVRlBPMU5CUTFJN1VVRkRSQ3hMUVVGTExFZEJRVWNzU1VGQlNTeERRVUZETzFGQlJXSXNUVUZCVFN4VFFVRlRMRWRCUVVjc01rSkJRVEpDTEVOQlF6TkRMRmRCUVZjc1EwRkJReXhUUVVGVExFVkJRM0pDTEhkQ1FVRjNRaXhEUVVONlFpeERRVUZETzFGQlEwWXNTVUZCU1N4VFFVRlRMRVZCUVVVN1dVRkRZaXhMUVVGTExFZEJRVWNzUzBGQlN5eERRVUZETzFsQlEyUXNUMEZCVHp0VFFVTlNPMUZCUlVRc1NVRkJTVHRaUVVOR0xIRkZRVUZ4UlR0WlFVTnlSU3hOUVVGTkxGVkJRVlVzUjBGQllTeEZRVUZGTEVOQlFVTTdXVUZEYUVNc1MwRkJTeXhOUVVGTkxFZEJRVWNzU1VGQlNTeEpRVUZKTEVWQlFVVTdaMEpCUTNSQ0xGVkJRVlVzUTBGQlF5eEpRVUZKTEVOQlEySXNaVUZCWlN4RFFVRkRMRWRCUVVjc1JVRkJSU3hYUVVGWExFTkJRVU1zY1VKQlFYRkNMRU5CUVVNc1EwRkRlRVFzUTBGQlF6dGhRVU5JTzFsQlEwUXNUVUZCVFN4SFFVRkhMRWRCUVVjN1owSkJRMVlzVTBGQlV5eEZRVUZGTEZkQlFWY3NRMEZCUXl4SlFVRkpPMmRDUVVNelFpeE5RVUZOTEVWQlFVVXNkMEpCUVhkQ08yZENRVU5vUXl4SlFVRkpMRVZCUVVVc1ZVRkJWVHRuUWtGRGFFSXNTMEZCU3l4RlFVRkZMRVZCUVVVN1owSkJRMVFzVTBGQlV5eEZRVUZGTEZkQlFWY3NRMEZCUXl4VFFVRlRPMmRDUVVOb1F5eFZRVUZWTEVWQlFVVXNWMEZCVnl4RFFVRkRMRlZCUVZVN1owSkJRMnhETEZOQlFWTXNSVUZCUlN4WFFVRlhMRU5CUVVNc1UwRkJVenRuUWtGRGFFTXNVVUZCVVN4RlFVRkZMRmRCUVZjc1EwRkJReXhSUVVGUk8yZENRVU01UWl4aFFVRmhMRVZCUVVVc1YwRkJWeXhEUVVGRExHRkJRV0U3WjBKQlEzaERMRk5CUVZNc1JVRkJSU3hYUVVGWExFTkJRVU1zVTBGQlV6dG5Ra0ZEYUVNc1QwRkJUeXhGUVVGRkxFOUJRVThzUlVGQlJUdGhRVU51UWl4RFFVRkRPMWxCUTBZc1NVRkJTU3hEUVVGRExGTkJRVk1zUlVGQlJTeEhRVUZITEVOQlFVTXNRMEZCUXp0VFFVTjBRanRSUVVGRExFOUJRVThzUzBGQlN5eEZRVUZGTzFsQlEyUXNUMEZCVHl4RFFVRkRMRWRCUVVjc1EwRkRWQ3hyUTBGQmEwTXNSMEZCUnl4M1FrRkJkMElzUTBGRE9VUXNRMEZCUXp0WlFVTkdMR2xDUVVGcFFpeERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRPMU5CUXpGQ08xRkJRMFFzUzBGQlN5eEhRVUZITEV0QlFVc3NRMEZCUXp0SlFVTm9RaXhEUVVGRE8wbEJSVVFzVTBGQlV5eHBRa0ZCYVVJc1EwRkJReXhMUVVGTExFVkJRVVVzVlVGQlpTeExRVUZMTzFGQlEzQkVMRTlCUVU4c1EwRkJReXhMUVVGTExFTkJRVU1zZFVKQlFYVkNMRWRCUVVjc1MwRkJTeXhEUVVGRExFbEJRVWtzUTBGQlF5eERRVUZETzFGQlEzQkVMRTlCUVU4c1EwRkJReXhMUVVGTExFTkJRVU1zTUVKQlFUQkNMRWRCUVVjc1MwRkJTeXhEUVVGRExFOUJRVThzUTBGQlF5eERRVUZETzFGQlF6RkVMRTlCUVU4c1EwRkJReXhMUVVGTExFTkJRVU1zTWtKQlFUSkNMRWRCUVVjc1MwRkJTeXhEUVVGRExGRkJRVkVzUTBGQlF5eERRVUZETzFGQlF6VkVMRTlCUVU4c1EwRkJReXhMUVVGTExFTkJRVU1zT0VKQlFUaENMRWRCUVVjc1MwRkJTeXhEUVVGRExGVkJRVlVzUTBGQlF5eERRVUZETzFGQlEycEZMRTlCUVU4c1EwRkJReXhMUVVGTExFTkJRVU1zZDBKQlFYZENMRWRCUVVjc1MwRkJTeXhEUVVGRExFdEJRVXNzUTBGQlF5eERRVUZETzFGQlEzUkVMRWxCUVVrc1QwRkJUeXhGUVVGRk8xbEJRMWdzVDBGQlR5eERRVUZETEV0QlFVc3NRMEZCUXl3d1FrRkJNRUlzUjBGQlJ5eEpRVUZKTEVOQlFVTXNVMEZCVXl4RFFVRkRMRTlCUVU4c1EwRkJReXhEUVVGRExFTkJRVU03VTBGRGNrVTdTVUZEU0N4RFFVRkRPMGxCUlVRc2QwTkJRWGRETzBsQlEzaERMRk5CUVZNc1lVRkJZVHRSUVVOd1FpeEpRVUZKTEV0QlFVc3NRMEZCUXp0UlFVVldMRWxCUVVrN1dVRkRSaXhOUVVGTkxFbEJRVWtzUzBGQlN5eEZRVUZGTEVOQlFVTTdVMEZEYmtJN1VVRkJReXhQUVVGUExFZEJRVWNzUlVGQlJUdFpRVU5hTEV0QlFVc3NSMEZCUnl4SFFVRkhMRU5CUVVNc1MwRkJTeXhEUVVGRE8xTkJRMjVDTzFGQlJVUXNUMEZCVHl4TFFVRkxMRU5CUVVNN1NVRkRaaXhEUVVGRE8wbEJSVVFzTUVOQlFUQkRPMGxCUXpGRExFMUJRVTBzVFVGQlRTeEhRVUZITEZWQlFWTXNUVUZCWXl4RlFVRkZMRWRCUVVjc1JVRkJSU3hSUVVGUk8xRkJRMjVFTEUxQlFVMHNTMEZCU3l4SFFVRkhMRTFCUVUwc1EwRkJReXhMUVVGTExFTkJRVU1zUjBGQlJ5eERRVUZETEVOQlFVTTdVVUZEYUVNc1QwRkJUeXhSUVVGUk8xbEJRMklzUTBGQlF5eERRVUZETEVOQlFVTXNTMEZCU3l4RFFVRkRMRXRCUVVzc1EwRkJReXhEUVVGRExFVkJRVVVzUTBGQlF5eFJRVUZSTEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1IwRkJSeXhEUVVGRExFTkJRVU1zUTBGQlF5eE5RVUZOTEVOQlFVTXNTMEZCU3l4RFFVRkRMRXRCUVVzc1EwRkJReXhEUVVGRExGRkJRVkVzUTBGQlF5eERRVUZETzFsQlEzUkZMRU5CUVVNc1EwRkJReXhMUVVGTExFTkJRVU03U1VGRFdpeERRVUZETEVOQlFVTTdTVUZGUml4VFFVRlRMREpDUVVFeVFpeERRVUZETEZsQlFWa3NSMEZCUnl4TFFVRkxPMUZCUTNaRUxFMUJRVTBzUzBGQlN5eEhRVUZITEdGQlFXRXNSVUZCUlR0aFFVTXhRaXhKUVVGSkxFVkJRVVU3WVVGRFRpeExRVUZMTEVOQlFVTXNTVUZCU1N4RFFVRkRMRU5CUVVNN1VVRkRaaXh2UkVGQmIwUTdVVUZEY0VRc1RVRkJUU3hoUVVGaExFZEJRVWM3V1VGRGNFSXNVMEZCVXl4RlFVRkZMRVZCUVVVN1dVRkRZaXhWUVVGVkxFVkJRVVVzUlVGQlJUdFpRVU5rTEZOQlFWTXNSVUZCUlN4RlFVRkZPMWxCUTJJc1VVRkJVU3hGUVVGRkxFVkJRVVU3V1VGRFdpeGhRVUZoTEVWQlFVVXNSVUZCUlR0WlFVTnFRaXhUUVVGVExFVkJRVVVzUlVGQlJUdFRRVU5rTEVOQlFVTTdVVUZEUml4SlFVRkpMRXRCUVVzc1EwRkJReXhOUVVGTkxFZEJRVWNzUTBGQlF5eEZRVUZGTzFsQlEzQkNMRTlCUVU4c1lVRkJZU3hEUVVGRE8xTkJRM1JDTzFGQlEwUXNNRVZCUVRCRk8xRkJRekZGTEUxQlFVMHNVVUZCVVN4SFFVRkhMRXRCUVVzc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dFJRVU14UWl4SlFVRkpMRU5CUVVNc1VVRkJVU3hGUVVGRk8xbEJRMklzVDBGQlR5eGhRVUZoTEVOQlFVTTdVMEZEZEVJN1VVRkRSRHM3T3pzN096czdWMEZSUnp0UlFVTklMRWxCUVVrN1dVRkRSaXhKUVVGSkxGTkJRVk1zUjBGQlJ5eEZRVUZGTEVOQlFVTTdXVUZEYmtJc1NVRkJTU3hoUVVGaExFZEJRVWNzUlVGQlJTeERRVUZETEVOQlFVTXNOa0pCUVRaQ08xbEJRM0pFTEUxQlFVMHNZVUZCWVN4SFFVRkhMRkZCUVZFc1EwRkJReXhMUVVGTExFTkJRVU1zUjBGQlJ5eERRVUZETEVOQlFVTTdXVUZETVVNc1RVRkJUU3hSUVVGUkxFZEJRVWNzWVVGQllTeERRVUZETEVOQlFVTXNRMEZCUXl4SlFVRkpMRVZCUVVVc1EwRkJRenRaUVVONFF5eE5RVUZOTEV0QlFVc3NSMEZCUnl4TlFVRk5MRU5CUVVNc1lVRkJZU3hEUVVGRExFTkJRVU1zUTBGQlF5eEZRVUZGTEVkQlFVY3NSVUZCUlN4RFFVRkRMRU5CUVVNc1EwRkJRenRaUVVNdlF5eE5RVUZOTEZGQlFWRXNSMEZCUnl4TFFVRkxMRU5CUVVNc1MwRkJTeXhEUVVGRExFMUJRVTBzUjBGQlJ5eERRVUZETEVOQlFVTXNRMEZCUXp0WlFVTjZReXhOUVVGTkxFMUJRVTBzUjBGQlJ5eExRVUZMTEVOQlFVTXNTMEZCU3l4RFFVRkRMRTFCUVUwc1IwRkJSeXhEUVVGRExFTkJRVU1zUTBGQlF6dFpRVU4yUXl4TlFVRk5MR05CUVdNc1IwRkJSeXhMUVVGTExFTkJRVU1zUzBGQlN5eERRVUZETEUxQlFVMHNSMEZCUnl4RFFVRkRMRU5CUVVNc1NVRkJTU3hGUVVGRkxFTkJRVU03V1VGRGNrUXNUVUZCVFN4VFFVRlRMRWRCUVVjc1kwRkJZeXhEUVVGRExFOUJRVThzUTBGQlF5eFJRVUZSTEVOQlFVTXNRMEZCUXl4RFFVRkRMSGxEUVVGNVF6dFpRVU0zUml4SlFVRkpMRk5CUVZNc1MwRkJTeXhEUVVGRExFTkJRVU1zUlVGQlJUdG5Ra0ZEY0VJc1UwRkJVeXhIUVVGSExHTkJRV01zUTBGQlF5eERRVUZETEc5RVFVRnZSRHRoUVVOcVJqdHBRa0ZCVFR0blFrRkRUQ3hUUVVGVExFZEJRVWNzWTBGQll5eERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRMRVZCUVVVc1UwRkJVeXhEUVVGRExFTkJRVU03WjBKQlF5OURMR0ZCUVdFc1IwRkJSeXhqUVVGakxFTkJRVU1zUzBGQlN5eERRVU5zUXl4VFFVRlRMRWRCUVVjc1EwRkJReXhGUVVOaUxHTkJRV01zUTBGQlF5eE5RVUZOTEVOQlEzUkNMRU5CUVVNN1lVRkRTRHRaUVVORUxFMUJRVTBzVjBGQlZ5eEhRVUZITzJkQ1FVTnNRaXhUUVVGVE8yZENRVU5VTEZWQlFWVXNSVUZCUlN4TlFVRk5PMmRDUVVOc1FpeFRRVUZUTEVWQlFVVXNVVUZCVVR0blFrRkRia0lzVVVGQlVUdG5Ra0ZEVWl4aFFVRmhPMmRDUVVOaUxGTkJRVk1zUlVGQlJTeFpRVUZaTzI5Q1FVTnlRaXhEUVVGRExFTkJRVU1zUzBGQlN6dDVRa0ZEUml4TFFVRkxMRU5CUVVNc1EwRkJReXhEUVVGRE8zbENRVU5TTEVsQlFVa3NRMEZCUXl4SlFVRkpMRU5CUVVNN2VVSkJRMVlzU1VGQlNTeEZRVUZGTzI5Q1FVTllMRU5CUVVNc1EwRkJReXhGUVVGRk8yRkJRMUFzUTBGQlF6dFpRVU5HTEU5QlFVOHNWMEZCVnl4RFFVRkRPMU5CUTNCQ08xRkJRVU1zVDBGQlR5eERRVUZETEVWQlFVVTdXVUZEVml4UFFVRlBMRU5CUVVNc1IwRkJSeXhEUVVOVUxESkRRVUV5UXl4RlFVTXpReXhEUVVGRExFTkJRVU1zVVVGQlVTeEZRVUZGTEVWQlExb3NVVUZCVVN4RFFVTlVMRU5CUVVNN1dVRkRSaXhQUVVGUExHRkJRV0VzUTBGQlF6dFRRVU4wUWp0SlFVTklMRU5CUVVNN1NVRkZSQ3hUUVVGVExGRkJRVkVzUTBGQlF5eE5RVUZOTEVWQlFVVXNXVUZCV1R0UlFVTndReXhKUVVGSkxGRkJRVkVzUTBGQlF6dFJRVU5pTEVsQlFVazdXVUZEUml4UlFVRlJMRWRCUVVjc1RVRkJUU3hEUVVGRExGbEJRVmtzUTBGQlF5eERRVUZETzFOQlEycERPMUZCUVVNc1QwRkJUeXhMUVVGTExFVkJRVVU3V1VGRFpDeFBRVUZQTEV0QlFVc3NRMEZCUXp0VFFVTmtPMUZCUTBRc1NVRkJTU3hSUVVGUkxFdEJRVXNzU1VGQlNTeEZRVUZGTzFsQlEzSkNMSGRDUVVGM1FqdFpRVU40UWl4UFFVRlBMRXRCUVVzc1EwRkJRenRUUVVOa08xRkJRMFFzVDBGQlR5eFBRVUZQTEZGQlFWRXNTMEZCU3l4UlFVRlJMRU5CUVVNN1NVRkRkRU1zUTBGQlF6dEpRVVZFTEdkRFFVRm5RenRKUVVOb1F5eDNSVUZCZDBVN1NVRkRlRVVzZVVWQlFYbEZPMGxCUTNwRkxIZEVRVUYzUkR0SlFVTjRSQ3hUUVVGVExHdENRVUZyUWl4RFFVTjZRaXhWUVVGclFpeEZRVU5zUWl4VlFVRnJRaXhGUVVOc1FpeEpRVUZUTEVWQlExUXNWMEZCZDBJN1VVRkZlRUlzVDBGQlR6dFpRVU5NTEUxQlFVMHNWMEZCVnl4SFFVRkhMREpDUVVFeVFpeERRVUZETEZkQlFWY3NRMEZCUXl4WlFVRlpMRU5CUVVNc1EwRkJRenRaUVVNeFJTeFBRVUZQTEVOQlEwd3NWVUZCVlN4SFFVRkhMRWRCUVVjc1IwRkJSeXhWUVVGVkxFVkJRemRDTEZOQlFWTXNSVUZEVkN4WFFVRlhMRVZCUTFnc1YwRkJWeXhEUVVOYUxFTkJRVU03V1VGRFJpeFBRVUZQTEVsQlFVa3NRMEZCUXl4TFFVRkxMRU5CUVVNc1NVRkJTU3hGUVVGRkxGTkJRVk1zUTBGQlF5eERRVUZETzFGQlEzSkRMRU5CUVVNc1EwRkJRenRKUVVOS0xFTkJRVU03U1VGRlJDd3lRMEZCTWtNN1NVRkRNME1zVTBGQlV5eDNRa0ZCZDBJc1EwRkRMMElzVFVGQlRTeEZRVU5PTEZWQlFXdENMRVZCUTJ4Q0xGbEJRVzlDTEVWQlEzQkNMRmRCUVhkQ08xRkJSWGhDTEVsQlEwVXNRMEZCUXl4TlFVRk5PMWxCUTFBc1EwRkJReXhWUVVGVk8xbEJRMWdzUTBGQlF5eFpRVUZaTzFsQlEySXNXVUZCV1N4TFFVRkxMRmRCUVZjc1JVRkROVUk3V1VGRFFTeE5RVUZOTEVsQlFVa3NTMEZCU3l4RFFVTmlPMnRDUVVOVkxFMUJRVTA3YzBKQlEwWXNWVUZCVlR0M1FrRkRVaXhaUVVGWk8xTkJRek5DTEVOQlEwWXNRMEZCUXp0VFFVTklPMUZCUlVRc2RVTkJRWFZETzFGQlEzWkRMRTFCUVUwc1VVRkJVU3hIUVVGSExFMUJRVTBzUTBGQlF5eHhRa0ZCY1VJc1EwRkJReXhOUVVGTkxFVkJRVVVzV1VGQldTeERRVUZETEVOQlFVTTdVVUZGY0VVc2IwWkJRVzlHTzFGQlEzQkdMRWxCUTBVc1EwRkJReXhSUVVGUk8xbEJRMVFzUTBGQlF5eFhRVUZYTEVOQlFVTXNhVU5CUVdsRExFTkJRVU1zVVVGQlVTeERRVUZETEZsQlFWa3NRMEZCUXl4RlFVTnlSVHRaUVVOQkxFOUJRVThzUTBGQlF5eExRVUZMTEVOQlExZ3NiVU5CUVcxRExFVkJRMjVETEZWQlFWVXNSVUZEVml4WlFVRlpMRVZCUTFvc1RVRkJUU3hEUVVOUUxFTkJRVU03V1VGRFJpeFBRVUZQTzFOQlExSTdVVUZGUkN3clEwRkJLME03VVVGREwwTXNTVUZCU1N4clFrRkJhMElzUTBGQlF6dFJRVU4yUWl4TlFVRk5MR2xDUVVGcFFpeEhRVUZITzFsQlEzaENMRWRCUVVjc1JVRkJSU3hIUVVGSExFVkJRVVU3WjBKQlExSXNUMEZCVHl4clFrRkJhMElzUTBGQlF6dFpRVU0xUWl4RFFVRkRPMWxCUTBRc1IwRkJSeXhGUVVGRkxFdEJRVXNzUTBGQlF5eEZRVUZGTzJkQ1FVTllMR3RDUVVGclFpeEhRVUZITEV0QlFVc3NRMEZCUXp0WlFVTTNRaXhEUVVGRE8xbEJRMFFzVlVGQlZTeEZRVUZGTEV0QlFVczdVMEZEYkVJc1EwRkJRenRSUVVWR0xHMUVRVUZ0UkR0UlFVTnVSQ3hOUVVGTkxHTkJRV01zUjBGQlJ5eFJRVUZSTEVOQlFVTXNRMEZCUXl4RFFVRkRMRkZCUVZFc1EwRkJReXhIUVVGSExFTkJRVU1zUTBGQlF5eERRVUZETEdsQ1FVRnBRaXhEUVVGRExFZEJRVWNzUTBGQlF6dFJRVU4yUlN4TlFVRk5MR05CUVdNc1IwRkJSeXhSUVVGUkxFTkJRVU1zUTBGQlF5eERRVUZETEZGQlFWRXNRMEZCUXl4SFFVRkhMRU5CUVVNc1EwRkJReXhEUVVGRExHbENRVUZwUWl4RFFVRkRMRWRCUVVjc1EwRkJRenRSUVVOMlJTeEpRVUZKTEdGQlFXRXNSMEZCUnl4UlFVRlJMRU5CUVVNc1EwRkJReXhEUVVGRExGRkJRVkVzUTBGQlF5eExRVUZMTEVOQlFVTXNRMEZCUXl4RFFVRkRMR3RDUVVGclFpeERRVUZETzFGQlJXNUZMRzlGUVVGdlJUdFJRVU53UlN4dlFrRkJiMEk3VVVGRGNFSXNUVUZCVFN4RFFVRkRMR05CUVdNc1EwRkJReXhOUVVGTkxFVkJRVVVzV1VGQldTeEZRVUZGTzFsQlF6RkRMRmxCUVZrc1JVRkJSU3hKUVVGSk8xbEJRMnhDTEVkQlFVY3NSVUZCUlN4RFFVRkRPMmRDUVVOS0xFOUJRVTg3YjBKQlEwd3NTVUZCU1N4WlFVRlpMRU5CUVVNN2IwSkJRMnBDTEUxQlFVMHNWMEZCVnl4SFFVRkhMREpDUVVFeVFpeERRVU0zUXl4WFFVRlhMRU5CUVVNc1dVRkJXU3hEUVVONlFpeERRVUZETzI5Q1FVTkdMRTFCUVUwc2QwSkJRWGRDTEVkQlFVY3NSMEZCUnl4VlFVRlZMRWxCUVVrc1dVRkJXU3hGUVVGRkxFTkJRVU03YjBKQlJXcEZMSEZDUVVGeFFqdHZRa0ZEY2tJc1NVRkJTU3hEUVVGRExGRkJRVkVzUlVGQlJUdDNRa0ZEWWl4M1FrRkJkMEk3ZDBKQlEzaENMRmxCUVZrc1IwRkJSeXhyUWtGQmEwSXNRMEZCUXp0eFFrRkRia003ZVVKQlFVMHNTVUZCU1N4alFVRmpMRVZCUVVVN2QwSkJRM3BDTEhWQ1FVRjFRanQzUWtGRGRrSXNXVUZCV1N4SFFVRkhMR05CUVdNc1EwRkJReXhKUVVGSkxFTkJRVU1zU1VGQlNTeERRVUZETEVOQlFVTTdjVUpCUXpGRE8zbENRVUZOTEVsQlFVa3NUMEZCVHl4SlFVRkpMRkZCUVZFc1JVRkJSVHQzUWtGRE9VSXNiVUpCUVcxQ08zZENRVU51UWl4WlFVRlpMRWRCUVVjc1lVRkJZU3hEUVVGRE8zRkNRVU01UWp0NVFrRkJUVHQzUWtGRFRDeFBRVUZQTEVOQlFVTXNTMEZCU3l4RFFVTllMREpDUVVFeVFpeDNRa0ZCZDBJc1owTkJRV2RETEVOQlEzQkdMRU5CUVVNN2QwSkJRMFlzVVVGQlVTeERRVU5PTEhkQ1FVRjNRaXhGUVVONFFpeEZRVUZGTEVWQlEwWXNWMEZCVnl4RFFVRkRMRlZCUVZVc1JVRkRkRUlzVjBGQlZ5eEZRVU5ZTEZkQlFWY3NRMEZEV2l4RFFVRkRPM2RDUVVOR0xFOUJRVTg3Y1VKQlExSTdiMEpCUlVRc0swUkJRU3RFTzI5Q1FVTXZSQ3d5UkVGQk1rUTdiMEpCUXpORUxITkVRVUZ6UkR0dlFrRkRkRVFzYTBWQlFXdEZPMjlDUVVOc1JTeEpRVUZKTEU5QlFVOHNXVUZCV1N4TFFVRkxMRlZCUVZVc1JVRkJSVHQzUWtGRGRFTXNTVUZCU1N4WFFVRlhMRU5CUVVNc1pVRkJaU3hGUVVGRk96UkNRVU12UWl4UlFVRlJMRU5CUTA0c2QwSkJRWGRDTEVWQlEzaENMRmxCUVZrc1JVRkRXaXhYUVVGWExFTkJRVU1zV1VGQldTeEZRVU40UWl4WFFVRlhMRVZCUTFnc1YwRkJWeXhEUVVOYUxFTkJRVU03ZVVKQlEwZzdkMEpCUTBRc1RVRkJUU3d5UWtGQk1rSXNSMEZCUnl4clFrRkJhMElzUTBGRGNFUXNWVUZCVlN4RlFVTldMRmxCUVZrc1JVRkRXaXhaUVVGWkxFVkJRMW9zVjBGQlZ5eERRVU5hTEVOQlFVTTdkMEpCUTBZc05FWkJRVFJHTzNkQ1FVTTFSaXd3UjBGQk1FYzdkMEpCUXpGSExFbEJRVWtzV1VGQldTeERRVUZETEZOQlFWTXNSVUZCUlRzMFFrRkRNVUlzTWtKQlFUSkNMRU5CUVVNc1UwRkJVeXhIUVVGSExGbEJRVmtzUTBGQlF5eFRRVUZUTEVOQlFVTTdORUpCUXk5RUxFbEJRVWtzV1VGQldTeERRVUZETEZOQlFWTXNRMEZCUXl4WFFVRlhMRVZCUVVVN1owTkJRM1JETERKQ1FVRXlRaXhEUVVGRExGTkJRVk1zUTBGQlF5eFhRVUZYTzI5RFFVTXZReXhaUVVGWkxFTkJRVU1zVTBGQlV5eERRVUZETEZkQlFWY3NRMEZCUXpzMlFrRkRkRU03ZVVKQlEwWTdkMEpCUTBRc1QwRkJUeXd5UWtGQk1rSXNRMEZCUXp0eFFrRkRjRU03ZVVKQlFVMHNTVUZEVEN4UFFVRlBMRmxCUVZrc1MwRkJTeXhSUVVGUk8zZENRVU5vUXl4WFFVRlhMRU5CUVVNc1UwRkJVenQzUWtGRGNrSXNWMEZCVnl4RFFVRkRMRXRCUVVzc1IwRkJSeXhEUVVGRExFVkJRM0pDTzNkQ1FVTkJMRTlCUVU4c1dVRkJXU3hEUVVGRE8zRkNRVU55UWp0NVFrRkJUVHQzUWtGRFRDeFJRVUZSTEVOQlEwNHNkMEpCUVhkQ0xFVkJRM2hDTEZsQlFWa3NSVUZEV2l4WFFVRlhMRU5CUVVNc1IwRkJSeXhGUVVObUxGZEJRVmNzUlVGRFdDeFhRVUZYTEVOQlExb3NRMEZCUXp0M1FrRkRSaXhQUVVGUExGbEJRVmtzUTBGQlF6dHhRa0ZEY2tJN1owSkJRMGdzUTBGQlF5eERRVUZETzFsQlEwb3NRMEZCUXl4RFFVRkRMRVZCUVVVN1dVRkRTaXhIUVVGSExFVkJRVVVzUTBGQlF6dG5Ra0ZEU2l4UFFVRlBMRlZCUVZNc1MwRkJTenR2UWtGRGJrSXNUVUZCVFN4WFFVRlhMRWRCUVVjc01rSkJRVEpDTEVOQlF6ZERMRmRCUVZjc1EwRkJReXhaUVVGWkxFTkJRM3BDTEVOQlFVTTdiMEpCUTBZc1RVRkJUU3gzUWtGQmQwSXNSMEZCUnl4SFFVRkhMRlZCUVZVc1NVRkJTU3haUVVGWkxFVkJRVVVzUTBGQlF6dHZRa0ZEYWtVc1NVRkJTU3hYUVVGWExFTkJRVU03YjBKQlJXaENMRzlFUVVGdlJEdHZRa0ZEY0VRc1NVRkRSU3hYUVVGWExFTkJRVU1zVjBGQlZ6dDNRa0ZEZGtJc1EwRkJReXhQUVVGUExHRkJRV0VzUzBGQlN5eFZRVUZWT3pSQ1FVTnNReXhQUVVGUExHRkJRV0VzUzBGQlN5eFJRVUZSTEVOQlFVTXNSVUZEY0VNN2QwSkJRMEVzVVVGQlVTeERRVU5PTEhkQ1FVRjNRaXhGUVVONFFpeExRVUZMTEVWQlEwd3NWMEZCVnl4RFFVRkRMR0ZCUVdFc1JVRkRla0lzVjBGQlZ5eEZRVU5ZTEZkQlFWY3NRMEZEV2l4RFFVRkRPM2RDUVVOR0xFOUJRVThzUzBGQlN5eERRVUZETzNGQ1FVTmtPMjlDUVVWRUxEUkRRVUUwUXp0dlFrRkROVU1zU1VGQlNTeGpRVUZqTEVWQlFVVTdkMEpCUTJ4Q0xIVkNRVUYxUWp0M1FrRkRka0lzVjBGQlZ5eEhRVUZITEdOQlFXTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1NVRkJTU3hGUVVGRkxFdEJRVXNzUTBGQlF5eERRVUZETzNGQ1FVTm9SRHQ1UWtGQlRTeEpRVUZKTEU5QlFVOHNTVUZCU1N4UlFVRlJMRVZCUVVVN2QwSkJRemxDTEV0QlFVc3NSMEZCUnl4SlFVRkpMRU5CUVVNN2QwSkJRMklzU1VGQlNTeE5RVUZOTEVOQlFVTXNZVUZCWVN4RFFVRkRMRWxCUVVrc1EwRkJReXhGUVVGRk96UkNRVU01UWl4TlFVRk5MRU5CUVVNc1kwRkJZeXhEUVVGRExFbEJRVWtzUlVGQlJTeFpRVUZaTEVWQlFVVTdaME5CUTNoRExFdEJRVXM3TmtKQlEwNHNRMEZCUXl4RFFVRkRPM2xDUVVOS096WkNRVUZOT3pSQ1FVTk1MR0ZCUVdFc1IwRkJSeXhMUVVGTExFTkJRVU03ZVVKQlEzWkNPM2RDUVVORUxGZEJRVmNzUjBGQlJ5eExRVUZMTEVOQlFVTTdkMEpCUTNCQ0xFdEJRVXNzUjBGQlJ5eExRVUZMTEVOQlFVTTdjVUpCUTJZN2VVSkJRVTA3ZDBKQlEwd3NUMEZCVHl4RFFVRkRMRXRCUVVzc1EwRkRXQ3d5UWtGQk1rSXNkMEpCUVhkQ0xHZERRVUZuUXl4RFFVTndSaXhEUVVGRE8zZENRVU5HTEZGQlFWRXNRMEZEVGl4M1FrRkJkMElzUlVGRGVFSXNTMEZCU3l4RlFVTk1MRmRCUVZjc1EwRkJReXhWUVVGVkxFVkJRM1JDTEZkQlFWY3NSVUZEV0N4WFFVRlhMRU5CUTFvc1EwRkJRenQzUWtGRFJpeFBRVUZQTEV0QlFVc3NRMEZCUXp0eFFrRkRaRHR2UWtGRFJDeFJRVUZSTEVOQlEwNHNkMEpCUVhkQ0xFVkJRM2hDTEV0QlFVc3NSVUZEVEN4WFFVRlhMRU5CUVVNc1IwRkJSeXhGUVVObUxGZEJRVmNzUlVGRFdDeFhRVUZYTEVOQlExb3NRMEZCUXp0dlFrRkRSaXhQUVVGUExGZEJRVmNzUTBGQlF6dG5Ra0ZEY2tJc1EwRkJReXhEUVVGRE8xbEJRMG9zUTBGQlF5eERRVUZETEVWQlFVVTdVMEZEVEN4RFFVRkRMRU5CUVVNN1NVRkRUQ3hEUVVGRE8wbEJSVVFzVTBGQlV5eG5Ra0ZCWjBJc1EwRkRka0lzVFVGQlZ5eEZRVU5ZTEdkQ1FVRjNRaXhGUVVONFFpeFhRVUYzUWp0UlFVVjRRaXhuUmtGQlowWTdVVUZEYUVZc2QwTkJRWGRETzFGQlEzaERMRWxCUVVrc2MwSkJRV2RETEVOQlFVTTdVVUZEY2tNc1NVRkJTU3hYUVVGWExFTkJRVU1zYzBKQlFYTkNMRXRCUVVzc1NVRkJTU3hGUVVGRk8xbEJReTlETEhOQ1FVRnpRaXhIUVVGSExFVkJRVVVzUTBGQlF6dFRRVU0zUWp0aFFVRk5MRWxCUVVrc1YwRkJWeXhEUVVGRExITkNRVUZ6UWl4RFFVRkRMRTFCUVUwc1MwRkJTeXhEUVVGRExFVkJRVVU3V1VGRE1VUXNjMEpCUVhOQ0xFZEJRVWNzVFVGQlRTeERRVUZETEdkQ1FVRm5RaXhEUVVGRExFMUJRVTBzUTBGQlF5eERRVUZETzFOQlF6RkVPMkZCUVUwN1dVRkRUQ3h6UWtGQmMwSXNSMEZCUnl4WFFVRlhMRU5CUVVNc2MwSkJRWE5DTEVOQlFVTTdVMEZETjBRN1VVRkRSQ3hMUVVGTExFMUJRVTBzV1VGQldTeEpRVUZKTEhOQ1FVRnpRaXhGUVVGRk8xbEJRMnBFTEVsQlFVa3NWMEZCVnl4RFFVRkRMR3RDUVVGclFpeERRVUZETEZGQlFWRXNRMEZCUXl4WlFVRlpMRU5CUVVNc1JVRkJSVHRuUWtGRGVrUXNVMEZCVXp0aFFVTldPMWxCUTBRc1owVkJRV2RGTzFsQlEyaEZMSE5FUVVGelJEdFpRVU4wUkN4SlFVTkZMRmRCUVZjc1EwRkJReXhUUVVGVE8yZENRVU55UWl4WFFVRlhMRU5CUVVNc1MwRkJTeXhIUVVGSExFTkJRVU03WjBKQlEzSkNMRkZCUVZFc1EwRkJReXhOUVVGTkxFVkJRVVVzV1VGQldTeERRVUZETzJkQ1FVTTVRaXhaUVVGWkxFdEJRVXNzVjBGQlZ5eEZRVU0xUWp0blFrRkRRU3hOUVVGTkxHMUNRVUZ0UWl4SFFVRkhMRWRCUVVjc1owSkJRV2RDTEVsQlFVa3NXVUZCV1N4RlFVRkZMRU5CUVVNN1owSkJRMnhGTEUxQlFVMHNZMEZCWXl4SFFVRkhMRVZCUVVVc1IwRkJSeXhYUVVGWExFVkJRVVVzUTBGQlF6dG5Ra0ZETVVNc1kwRkJZeXhEUVVGRExFdEJRVXNzUjBGQlJ5eFhRVUZYTEVOQlFVTXNTMEZCU3l4SFFVRkhMRU5CUVVNc1EwRkJRenRuUWtGRE4wTXNZMEZCWXl4RFFVRkRMSE5DUVVGelFpeEhRVUZITEVWQlFVVXNRMEZCUXp0blFrRkRNME1zWjBKQlFXZENMRU5CUTJRc1RVRkJUU3hEUVVGRExGbEJRVmtzUTBGQlF5eEZRVU53UWl4dFFrRkJiVUlzUlVGRGJrSXNZMEZCWXl4RFFVTm1MRU5CUVVNN1lVRkRTRHRaUVVORUxFbEJRVWs3WjBKQlEwWXNkMEpCUVhkQ0xFTkJRM1JDTEUxQlFVMHNSVUZEVGl4blFrRkJaMElzUlVGRGFFSXNXVUZCV1N4RlFVTmFMRmRCUVZjc1EwRkRXaXhEUVVGRE8yRkJRMGc3V1VGQlF5eFBRVUZQTEV0QlFVc3NSVUZCUlR0blFrRkRaQ3hKUVVORkxFdEJRVXNzV1VGQldTeFRRVUZUTzI5Q1FVTXhRaXhMUVVGTExFTkJRVU1zVDBGQlR5eERRVUZETEZGQlFWRXNRMEZCUXl3d1EwRkJNRU1zUTBGQlF5eEZRVU5zUlR0dlFrRkRRU3hQUVVGUExFTkJRVU1zU1VGQlNTeERRVU5XTEdkRVFVRm5SQ3huUWtGQlowSXNTVUZCU1N4WlFVRlpMRVZCUVVVc1EwRkRia1lzUTBGQlF6dHBRa0ZEU0R0eFFrRkJUVHR2UWtGRFRDeHBRa0ZCYVVJc1EwRkJReXhMUVVGTExFVkJRVVVzUlVGQlJTeG5Ra0ZCWjBJc1JVRkJSU3haUVVGWkxFVkJRVVVzUTBGQlF5eERRVUZETzJsQ1FVTTVSRHRoUVVOR08xTkJRMFk3VVVGRFJDeExRVUZMTEUxQlFVMHNXVUZCV1N4SlFVRkpMRmRCUVZjc1EwRkJReXhwUTBGQmFVTXNSVUZCUlR0WlFVTjRSU3hKUVVGSkxGZEJRVmNzUTBGQlF5eHJRa0ZCYTBJc1EwRkJReXhSUVVGUkxFTkJRVU1zV1VGQldTeERRVUZETEVWQlFVVTdaMEpCUTNwRUxGTkJRVk03WVVGRFZqdFpRVU5FTEVsQlFVazdaMEpCUTBZc2QwSkJRWGRDTEVOQlEzUkNMRTFCUVUwc1JVRkRUaXhuUWtGQlowSXNSVUZEYUVJc1dVRkJXU3hGUVVOYUxGZEJRVmNzUTBGRFdpeERRVUZETzJGQlEwZzdXVUZCUXl4UFFVRlBMRXRCUVVzc1JVRkJSVHRuUWtGRFpDeHBRa0ZCYVVJc1EwRkJReXhMUVVGTExFVkJRVVVzUlVGQlJTeG5Ra0ZCWjBJc1JVRkJSU3haUVVGWkxFVkJRVVVzUTBGQlF5eERRVUZETzJGQlF6bEVPMU5CUTBZN1NVRkRTQ3hEUVVGRE8wbEJSVVFzVFVGQlRTeFhRVUZYTEVkQlFVY3NWVUZCVXl4UFFVRlBMRVZCUVVVc2NVSkJRWEZDTzFGQlEzcEVMRWxCUVVrc1VVRkJVU3hIUVVGSExFVkJRVVVzUTBGQlF6dFJRVU5zUWl4dFEwRkJiVU03VVVGRGJrTXNUVUZCVFN4TFFVRkxMRWRCUVVjc1VVRkJVU3hEUVVGRE8xbEJRM0pDTEhGQ1FVRnhRaXhEUVVGRExFOUJRVThzUlVGQlJTeFJRVUZSTEVOQlFVTXNRMEZCUXp0WlFVVjZReXhyUWtGQmEwSTdXVUZEYkVJc1VVRkJVU3hIUVVGSExFVkJRVVVzUTBGQlF6dFJRVU5vUWl4RFFVRkRMRVZCUVVVc1IwRkJSeXhEUVVGRExFTkJRVU03VVVGRlVpeFBRVUZQTEZWQlFWTXNUMEZCVHl4RlFVRkZMRWRCUVVjN1dVRkRNVUlzYjBKQlFXOUNPMWxCUTNCQ0xGRkJRVkVzUTBGQlF5eEpRVUZKTEVOQlFVTXNSVUZCUlN4SlFVRkpMRVZCUVVVc1QwRkJUeXhGUVVGRkxFOUJRVThzUlVGQlJTeEhRVUZITEVWQlFVVXNRMEZCUXl4RFFVRkRPMWxCUXk5RExFdEJRVXNzUlVGQlJTeERRVUZETzFGQlExWXNRMEZCUXl4RFFVRkRPMGxCUTBvc1EwRkJReXhEUVVGRE8wbEJSVVlzVFVGQlRTeEpRVUZKTEVkQlFVY3NWMEZCVnl4RFFVRkRMRTlCUVU4c1JVRkJSU3h2UWtGQmIwSXNRMEZCUXl4RFFVRkRPMGxCUlhoRUxGTkJRVk1zV1VGQldTeERRVUZETEc5Q1FVRXlRenRSUVVNdlJDeHBSVUZCYVVVN1VVRkRha1VzT0VOQlFUaERPMUZCUlRsRExIbEVRVUY1UkR0UlFVTjZSQ3hwUkVGQmFVUTdVVUZEYWtRc2IwSkJRVzlDTEVOQlFVTXNUMEZCVHl4RFFVRkRMRlZCUVZNc1NVRkJTVHRaUVVONFF5eG5Ra0ZCWjBJc1EwRkJReXhKUVVGSkxFTkJRVU1zU1VGQlNTeERRVUZETEUxQlFVMHNRMEZCUXl4RlFVRkZMRWxCUVVrc1EwRkJReXhuUWtGQlowSXNSVUZCUlN4SlFVRkpMRU5CUVVNc1YwRkJWeXhEUVVGRExFTkJRVU03VVVGREwwVXNRMEZCUXl4RFFVRkRMRU5CUVVNN1NVRkRUQ3hEUVVGRE8wbEJSVVFzWjBaQlFXZEdPMGxCUTJoR0xFOUJRVThzV1VGQldTeERRVUZETzBGQlEzUkNMRU5CUVVNaWZRPT0iLCIvKipcbiAqIFRpZXMgdG9nZXRoZXIgdGhlIHR3byBzZXBhcmF0ZSBuYXZpZ2F0aW9uIGV2ZW50cyB0aGF0IHRvZ2V0aGVyIGhvbGRzIGluZm9ybWF0aW9uIGFib3V0IGJvdGggcGFyZW50IGZyYW1lIGlkIGFuZCB0cmFuc2l0aW9uLXJlbGF0ZWQgYXR0cmlidXRlc1xuICovXG5leHBvcnQgY2xhc3MgUGVuZGluZ05hdmlnYXRpb24ge1xuICAgIG9uQmVmb3JlTmF2aWdhdGVFdmVudE5hdmlnYXRpb247XG4gICAgb25Db21taXR0ZWRFdmVudE5hdmlnYXRpb247XG4gICAgcmVzb2x2ZU9uQmVmb3JlTmF2aWdhdGVFdmVudE5hdmlnYXRpb247XG4gICAgcmVzb2x2ZU9uQ29tbWl0dGVkRXZlbnROYXZpZ2F0aW9uO1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLm9uQmVmb3JlTmF2aWdhdGVFdmVudE5hdmlnYXRpb24gPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZU9uQmVmb3JlTmF2aWdhdGVFdmVudE5hdmlnYXRpb24gPSByZXNvbHZlO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5vbkNvbW1pdHRlZEV2ZW50TmF2aWdhdGlvbiA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlT25Db21taXR0ZWRFdmVudE5hdmlnYXRpb24gPSByZXNvbHZlO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmVzb2x2ZWQoKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICB0aGlzLm9uQmVmb3JlTmF2aWdhdGVFdmVudE5hdmlnYXRpb24sXG4gICAgICAgICAgICB0aGlzLm9uQ29tbWl0dGVkRXZlbnROYXZpZ2F0aW9uLFxuICAgICAgICBdKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRWl0aGVyIHJldHVybnMgb3IgdGltZXMgb3V0IGFuZCByZXR1cm5zIHVuZGVmaW5lZCBvclxuICAgICAqIHJldHVybnMgdGhlIHJlc3VsdHMgZnJvbSByZXNvbHZlZCgpIGFib3ZlXG4gICAgICogQHBhcmFtIG1zXG4gICAgICovXG4gICAgYXN5bmMgcmVzb2x2ZWRXaXRoaW5UaW1lb3V0KG1zKSB7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZWQoKSxcbiAgICAgICAgICAgIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpLFxuICAgICAgICBdKTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmVkO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWNHVnVaR2x1WnkxdVlYWnBaMkYwYVc5dUxtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTWlPbHNpTGk0dkxpNHZMaTR2YzNKakwyeHBZaTl3Wlc1a2FXNW5MVzVoZG1sbllYUnBiMjR1ZEhNaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWtGQlJVRTdPMGRCUlVjN1FVRkRTQ3hOUVVGTkxFOUJRVThzYVVKQlFXbENPMGxCUTFvc0swSkJRU3RDTEVOQlFYTkNPMGxCUTNKRUxEQkNRVUV3UWl4RFFVRnpRanRKUVVONlJDeHpRMEZCYzBNc1EwRkJaME03U1VGRGRFVXNhVU5CUVdsRExFTkJRV2RETzBsQlEzaEZPMUZCUTBVc1NVRkJTU3hEUVVGRExDdENRVUVyUWl4SFFVRkhMRWxCUVVrc1QwRkJUeXhEUVVGRExFOUJRVThzUTBGQlF5eEZRVUZGTzFsQlF6TkVMRWxCUVVrc1EwRkJReXh6UTBGQmMwTXNSMEZCUnl4UFFVRlBMRU5CUVVNN1VVRkRlRVFzUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEU0N4SlFVRkpMRU5CUVVNc01FSkJRVEJDTEVkQlFVY3NTVUZCU1N4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExFVkJRVVU3V1VGRGRFUXNTVUZCU1N4RFFVRkRMR2xEUVVGcFF5eEhRVUZITEU5QlFVOHNRMEZCUXp0UlFVTnVSQ3hEUVVGRExFTkJRVU1zUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZEVFN4UlFVRlJPMUZCUTJJc1QwRkJUeXhQUVVGUExFTkJRVU1zUjBGQlJ5eERRVUZETzFsQlEycENMRWxCUVVrc1EwRkJReXdyUWtGQkswSTdXVUZEY0VNc1NVRkJTU3hEUVVGRExEQkNRVUV3UWp0VFFVTm9ReXhEUVVGRExFTkJRVU03U1VGRFRDeERRVUZETzBsQlJVUTdPenM3VDBGSlJ6dEpRVU5KTEV0QlFVc3NRMEZCUXl4eFFrRkJjVUlzUTBGQlF5eEZRVUZGTzFGQlEyNURMRTFCUVUwc1VVRkJVU3hIUVVGSExFMUJRVTBzVDBGQlR5eERRVUZETEVsQlFVa3NRMEZCUXp0WlFVTnNReXhKUVVGSkxFTkJRVU1zVVVGQlVTeEZRVUZGTzFsQlEyWXNTVUZCU1N4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExFVkJRVVVzUTBGQlF5eFZRVUZWTEVOQlFVTXNUMEZCVHl4RlFVRkZMRVZCUVVVc1EwRkJReXhEUVVGRE8xTkJRMmhFTEVOQlFVTXNRMEZCUXp0UlFVTklMRTlCUVU4c1VVRkJVU3hEUVVGRE8wbEJRMnhDTEVOQlFVTTdRMEZEUmlKOSIsIi8qKlxuICogVGllcyB0b2dldGhlciB0aGUgdHdvIHNlcGFyYXRlIGV2ZW50cyB0aGF0IHRvZ2V0aGVyIGhvbGRzIGluZm9ybWF0aW9uIGFib3V0IGJvdGggcmVxdWVzdCBoZWFkZXJzIGFuZCBib2R5XG4gKi9cbmV4cG9ydCBjbGFzcyBQZW5kaW5nUmVxdWVzdCB7XG4gICAgb25CZWZvcmVSZXF1ZXN0RXZlbnREZXRhaWxzO1xuICAgIG9uQmVmb3JlU2VuZEhlYWRlcnNFdmVudERldGFpbHM7XG4gICAgcmVzb2x2ZU9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscztcbiAgICByZXNvbHZlT25CZWZvcmVTZW5kSGVhZGVyc0V2ZW50RGV0YWlscztcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5vbkJlZm9yZVJlcXVlc3RFdmVudERldGFpbHMgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZU9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscyA9IHJlc29sdmU7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uQmVmb3JlU2VuZEhlYWRlcnNFdmVudERldGFpbHMgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZU9uQmVmb3JlU2VuZEhlYWRlcnNFdmVudERldGFpbHMgPSByZXNvbHZlO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmVzb2x2ZWQoKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICB0aGlzLm9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscyxcbiAgICAgICAgICAgIHRoaXMub25CZWZvcmVTZW5kSGVhZGVyc0V2ZW50RGV0YWlscyxcbiAgICAgICAgXSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEVpdGhlciByZXR1cm5zIG9yIHRpbWVzIG91dCBhbmQgcmV0dXJucyB1bmRlZmluZWQgb3JcbiAgICAgKiByZXR1cm5zIHRoZSByZXN1bHRzIGZyb20gcmVzb2x2ZWQoKSBhYm92ZVxuICAgICAqIEBwYXJhbSBtc1xuICAgICAqL1xuICAgIGFzeW5jIHJlc29sdmVkV2l0aGluVGltZW91dChtcykge1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IFByb21pc2UucmFjZShbXG4gICAgICAgICAgICB0aGlzLnJlc29sdmVkKCksXG4gICAgICAgICAgICBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKSxcbiAgICAgICAgXSk7XG4gICAgICAgIHJldHVybiByZXNvbHZlZDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2ljR1Z1WkdsdVp5MXlaWEYxWlhOMExtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTWlPbHNpTGk0dkxpNHZMaTR2YzNKakwyeHBZaTl3Wlc1a2FXNW5MWEpsY1hWbGMzUXVkSE1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJa0ZCUzBFN08wZEJSVWM3UVVGRFNDeE5RVUZOTEU5QlFVOHNZMEZCWXp0SlFVTlVMREpDUVVFeVFpeERRVVY2UXp0SlFVTmpMQ3RDUVVFclFpeERRVVUzUXp0SlFVTkxMR3REUVVGclF5eERRVVV2UWp0SlFVTklMSE5EUVVGelF5eERRVVZ1UXp0SlFVTldPMUZCUTBVc1NVRkJTU3hEUVVGRExESkNRVUV5UWl4SFFVRkhMRWxCUVVrc1QwRkJUeXhEUVVGRExFOUJRVThzUTBGQlF5eEZRVUZGTzFsQlEzWkVMRWxCUVVrc1EwRkJReXhyUTBGQmEwTXNSMEZCUnl4UFFVRlBMRU5CUVVNN1VVRkRjRVFzUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEU0N4SlFVRkpMRU5CUVVNc0swSkJRU3RDTEVkQlFVY3NTVUZCU1N4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExFVkJRVVU3V1VGRE0wUXNTVUZCU1N4RFFVRkRMSE5EUVVGelF5eEhRVUZITEU5QlFVOHNRMEZCUXp0UlFVTjRSQ3hEUVVGRExFTkJRVU1zUTBGQlF6dEpRVU5NTEVOQlFVTTdTVUZEVFN4UlFVRlJPMUZCUTJJc1QwRkJUeXhQUVVGUExFTkJRVU1zUjBGQlJ5eERRVUZETzFsQlEycENMRWxCUVVrc1EwRkJReXd5UWtGQk1rSTdXVUZEYUVNc1NVRkJTU3hEUVVGRExDdENRVUVyUWp0VFFVTnlReXhEUVVGRExFTkJRVU03U1VGRFRDeERRVUZETzBsQlJVUTdPenM3VDBGSlJ6dEpRVU5KTEV0QlFVc3NRMEZCUXl4eFFrRkJjVUlzUTBGQlF5eEZRVUZGTzFGQlEyNURMRTFCUVUwc1VVRkJVU3hIUVVGSExFMUJRVTBzVDBGQlR5eERRVUZETEVsQlFVa3NRMEZCUXp0WlFVTnNReXhKUVVGSkxFTkJRVU1zVVVGQlVTeEZRVUZGTzFsQlEyWXNTVUZCU1N4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExFVkJRVVVzUTBGQlF5eFZRVUZWTEVOQlFVTXNUMEZCVHl4RlFVRkZMRVZCUVVVc1EwRkJReXhEUVVGRE8xTkJRMmhFTEVOQlFVTXNRMEZCUXp0UlFVTklMRTlCUVU4c1VVRkJVU3hEUVVGRE8wbEJRMnhDTEVOQlFVTTdRMEZEUmlKOSIsImltcG9ydCB7IFJlc3BvbnNlQm9keUxpc3RlbmVyIH0gZnJvbSBcIi4vcmVzcG9uc2UtYm9keS1saXN0ZW5lclwiO1xuLyoqXG4gKiBUaWVzIHRvZ2V0aGVyIHRoZSB0d28gc2VwYXJhdGUgZXZlbnRzIHRoYXQgdG9nZXRoZXIgaG9sZHMgaW5mb3JtYXRpb24gYWJvdXQgYm90aCByZXNwb25zZSBoZWFkZXJzIGFuZCBib2R5XG4gKi9cbmV4cG9ydCBjbGFzcyBQZW5kaW5nUmVzcG9uc2Uge1xuICAgIG9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscztcbiAgICBvbkNvbXBsZXRlZEV2ZW50RGV0YWlscztcbiAgICByZXNwb25zZUJvZHlMaXN0ZW5lcjtcbiAgICByZXNvbHZlT25CZWZvcmVSZXF1ZXN0RXZlbnREZXRhaWxzO1xuICAgIHJlc29sdmVPbkNvbXBsZXRlZEV2ZW50RGV0YWlscztcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5vbkJlZm9yZVJlcXVlc3RFdmVudERldGFpbHMgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZU9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscyA9IHJlc29sdmU7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLm9uQ29tcGxldGVkRXZlbnREZXRhaWxzID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVPbkNvbXBsZXRlZEV2ZW50RGV0YWlscyA9IHJlc29sdmU7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhZGRSZXNwb25zZVJlc3BvbnNlQm9keUxpc3RlbmVyKGRldGFpbHMpIHtcbiAgICAgICAgdGhpcy5yZXNwb25zZUJvZHlMaXN0ZW5lciA9IG5ldyBSZXNwb25zZUJvZHlMaXN0ZW5lcihkZXRhaWxzKTtcbiAgICB9XG4gICAgcmVzb2x2ZWQoKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICB0aGlzLm9uQmVmb3JlUmVxdWVzdEV2ZW50RGV0YWlscyxcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZWRFdmVudERldGFpbHMsXG4gICAgICAgIF0pO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBFaXRoZXIgcmV0dXJucyBvciB0aW1lcyBvdXQgYW5kIHJldHVybnMgdW5kZWZpbmVkIG9yXG4gICAgICogcmV0dXJucyB0aGUgcmVzdWx0cyBmcm9tIHJlc29sdmVkKCkgYWJvdmVcbiAgICAgKiBAcGFyYW0gbXNcbiAgICAgKi9cbiAgICBhc3luYyByZXNvbHZlZFdpdGhpblRpbWVvdXQobXMpIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlZCgpLFxuICAgICAgICAgICAgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSksXG4gICAgICAgIF0pO1xuICAgICAgICByZXR1cm4gcmVzb2x2ZWQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pY0dWdVpHbHVaeTF5WlhOd2IyNXpaUzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6SWpwYklpNHVMeTR1THk0dUwzTnlZeTlzYVdJdmNHVnVaR2x1WnkxeVpYTndiMjV6WlM1MGN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkpRU3hQUVVGUExFVkJRVU1zYjBKQlFXOUNMRVZCUVVNc1RVRkJUU3d3UWtGQk1FSXNRMEZCUXp0QlFVVTVSRHM3UjBGRlJ6dEJRVU5JTEUxQlFVMHNUMEZCVHl4bFFVRmxPMGxCUTFZc01rSkJRVEpDTEVOQlJYcERPMGxCUTJNc2RVSkJRWFZDTEVOQlJYSkRPMGxCUTBzc2IwSkJRVzlDTEVOQlFYVkNPMGxCUXpORExHdERRVUZyUXl4RFFVVXZRanRKUVVOSUxEaENRVUU0UWl4RFFVVXpRanRKUVVOV08xRkJRMFVzU1VGQlNTeERRVUZETERKQ1FVRXlRaXhIUVVGSExFbEJRVWtzVDBGQlR5eERRVUZETEU5QlFVOHNRMEZCUXl4RlFVRkZPMWxCUTNaRUxFbEJRVWtzUTBGQlF5eHJRMEZCYTBNc1IwRkJSeXhQUVVGUExFTkJRVU03VVVGRGNFUXNRMEZCUXl4RFFVRkRMRU5CUVVNN1VVRkRTQ3hKUVVGSkxFTkJRVU1zZFVKQlFYVkNMRWRCUVVjc1NVRkJTU3hQUVVGUExFTkJRVU1zVDBGQlR5eERRVUZETEVWQlFVVTdXVUZEYmtRc1NVRkJTU3hEUVVGRExEaENRVUU0UWl4SFFVRkhMRTlCUVU4c1EwRkJRenRSUVVOb1JDeERRVUZETEVOQlFVTXNRMEZCUXp0SlFVTk1MRU5CUVVNN1NVRkRUU3dyUWtGQkswSXNRMEZEY0VNc1QwRkJPRU03VVVGRk9VTXNTVUZCU1N4RFFVRkRMRzlDUVVGdlFpeEhRVUZITEVsQlFVa3NiMEpCUVc5Q0xFTkJRVU1zVDBGQlR5eERRVUZETEVOQlFVTTdTVUZEYUVVc1EwRkJRenRKUVVOTkxGRkJRVkU3VVVGRFlpeFBRVUZQTEU5QlFVOHNRMEZCUXl4SFFVRkhMRU5CUVVNN1dVRkRha0lzU1VGQlNTeERRVUZETERKQ1FVRXlRanRaUVVOb1F5eEpRVUZKTEVOQlFVTXNkVUpCUVhWQ08xTkJRemRDTEVOQlFVTXNRMEZCUXp0SlFVTk1MRU5CUVVNN1NVRkZSRHM3T3p0UFFVbEhPMGxCUTBrc1MwRkJTeXhEUVVGRExIRkNRVUZ4UWl4RFFVRkRMRVZCUVVVN1VVRkRia01zVFVGQlRTeFJRVUZSTEVkQlFVY3NUVUZCVFN4UFFVRlBMRU5CUVVNc1NVRkJTU3hEUVVGRE8xbEJRMnhETEVsQlFVa3NRMEZCUXl4UlFVRlJMRVZCUVVVN1dVRkRaaXhKUVVGSkxFOUJRVThzUTBGQlF5eFBRVUZQTEVOQlFVTXNSVUZCUlN4RFFVRkRMRlZCUVZVc1EwRkJReXhQUVVGUExFVkJRVVVzUlVGQlJTeERRVUZETEVOQlFVTTdVMEZEYUVRc1EwRkJReXhEUVVGRE8xRkJRMGdzVDBGQlR5eFJRVUZSTEVOQlFVTTdTVUZEYkVJc1EwRkJRenREUVVOR0luMD0iLCJpbXBvcnQgeyBkaWdlc3RNZXNzYWdlIH0gZnJvbSBcIi4vc2hhMjU2XCI7XG5leHBvcnQgY2xhc3MgUmVzcG9uc2VCb2R5TGlzdGVuZXIge1xuICAgIHJlc3BvbnNlQm9keTtcbiAgICBjb250ZW50SGFzaDtcbiAgICByZXNvbHZlUmVzcG9uc2VCb2R5O1xuICAgIHJlc29sdmVDb250ZW50SGFzaDtcbiAgICBjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG4gICAgICAgIHRoaXMucmVzcG9uc2VCb2R5ID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVSZXNwb25zZUJvZHkgPSByZXNvbHZlO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb250ZW50SGFzaCA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlQ29udGVudEhhc2ggPSByZXNvbHZlO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gVXNlZCB0byBwYXJzZSBSZXNwb25zZSBzdHJlYW1cbiAgICAgICAgY29uc3QgZmlsdGVyID0gYnJvd3Nlci53ZWJSZXF1ZXN0LmZpbHRlclJlc3BvbnNlRGF0YShkZXRhaWxzLnJlcXVlc3RJZC50b1N0cmluZygpKTtcbiAgICAgICAgbGV0IHJlc3BvbnNlQm9keSA9IG5ldyBVaW50OEFycmF5KCk7XG4gICAgICAgIGZpbHRlci5vbmRhdGEgPSBldmVudCA9PiB7XG4gICAgICAgICAgICBkaWdlc3RNZXNzYWdlKGV2ZW50LmRhdGEpLnRoZW4oZGlnZXN0ID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlc29sdmVDb250ZW50SGFzaChkaWdlc3QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBpbmNvbWluZyA9IG5ldyBVaW50OEFycmF5KGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgY29uc3QgdG1wID0gbmV3IFVpbnQ4QXJyYXkocmVzcG9uc2VCb2R5Lmxlbmd0aCArIGluY29taW5nLmxlbmd0aCk7XG4gICAgICAgICAgICB0bXAuc2V0KHJlc3BvbnNlQm9keSk7XG4gICAgICAgICAgICB0bXAuc2V0KGluY29taW5nLCByZXNwb25zZUJvZHkubGVuZ3RoKTtcbiAgICAgICAgICAgIHJlc3BvbnNlQm9keSA9IHRtcDtcbiAgICAgICAgICAgIGZpbHRlci53cml0ZShldmVudC5kYXRhKTtcbiAgICAgICAgfTtcbiAgICAgICAgZmlsdGVyLm9uc3RvcCA9IF9ldmVudCA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVSZXNwb25zZUJvZHkocmVzcG9uc2VCb2R5KTtcbiAgICAgICAgICAgIGZpbHRlci5kaXNjb25uZWN0KCk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGFzeW5jIGdldFJlc3BvbnNlQm9keSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVzcG9uc2VCb2R5O1xuICAgIH1cbiAgICBhc3luYyBnZXRDb250ZW50SGFzaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGVudEhhc2g7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pY21WemNHOXVjMlV0WW05a2VTMXNhWE4wWlc1bGNpNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpJanBiSWk0dUx5NHVMeTR1TDNOeVl5OXNhV0l2Y21WemNHOXVjMlV0WW05a2VTMXNhWE4wWlc1bGNpNTBjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lRVUZEUVN4UFFVRlBMRVZCUVVNc1lVRkJZU3hGUVVGRExFMUJRVTBzVlVGQlZTeERRVUZETzBGQlJYWkRMRTFCUVUwc1QwRkJUeXh2UWtGQmIwSTdTVUZEWkN4WlFVRlpMRU5CUVhOQ08wbEJRMnhETEZkQlFWY3NRMEZCYTBJN1NVRkRkRU1zYlVKQlFXMUNMRU5CUVhGRE8wbEJRM2hFTEd0Q1FVRnJRaXhEUVVGblF6dEpRVVV4UkN4WlFVRlpMRTlCUVRoRE8xRkJRM2hFTEVsQlFVa3NRMEZCUXl4WlFVRlpMRWRCUVVjc1NVRkJTU3hQUVVGUExFTkJRVU1zVDBGQlR5eERRVUZETEVWQlFVVTdXVUZEZUVNc1NVRkJTU3hEUVVGRExHMUNRVUZ0UWl4SFFVRkhMRTlCUVU4c1EwRkJRenRSUVVOeVF5eERRVUZETEVOQlFVTXNRMEZCUXp0UlFVTklMRWxCUVVrc1EwRkJReXhYUVVGWExFZEJRVWNzU1VGQlNTeFBRVUZQTEVOQlFVTXNUMEZCVHl4RFFVRkRMRVZCUVVVN1dVRkRka01zU1VGQlNTeERRVUZETEd0Q1FVRnJRaXhIUVVGSExFOUJRVThzUTBGQlF6dFJRVU53UXl4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVWSUxHZERRVUZuUXp0UlFVTm9ReXhOUVVGTkxFMUJRVTBzUjBGQlVTeFBRVUZQTEVOQlFVTXNWVUZCVlN4RFFVRkRMR3RDUVVGclFpeERRVU4yUkN4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRExGRkJRVkVzUlVGQlJTeERRVU4wUWl4RFFVRkRPMUZCUlZRc1NVRkJTU3haUVVGWkxFZEJRVWNzU1VGQlNTeFZRVUZWTEVWQlFVVXNRMEZCUXp0UlFVTndReXhOUVVGTkxFTkJRVU1zVFVGQlRTeEhRVUZITEV0QlFVc3NRMEZCUXl4RlFVRkZPMWxCUTNSQ0xHRkJRV0VzUTBGQlF5eExRVUZMTEVOQlFVTXNTVUZCU1N4RFFVRkRMRU5CUVVNc1NVRkJTU3hEUVVGRExFMUJRVTBzUTBGQlF5eEZRVUZGTzJkQ1FVTjBReXhKUVVGSkxFTkJRVU1zYTBKQlFXdENMRU5CUVVNc1RVRkJUU3hEUVVGRExFTkJRVU03V1VGRGJFTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1dVRkRTQ3hOUVVGTkxGRkJRVkVzUjBGQlJ5eEpRVUZKTEZWQlFWVXNRMEZCUXl4TFFVRkxMRU5CUVVNc1NVRkJTU3hEUVVGRExFTkJRVU03V1VGRE5VTXNUVUZCVFN4SFFVRkhMRWRCUVVjc1NVRkJTU3hWUVVGVkxFTkJRVU1zV1VGQldTeERRVUZETEUxQlFVMHNSMEZCUnl4UlFVRlJMRU5CUVVNc1RVRkJUU3hEUVVGRExFTkJRVU03V1VGRGJFVXNSMEZCUnl4RFFVRkRMRWRCUVVjc1EwRkJReXhaUVVGWkxFTkJRVU1zUTBGQlF6dFpRVU4wUWl4SFFVRkhMRU5CUVVNc1IwRkJSeXhEUVVGRExGRkJRVkVzUlVGQlJTeFpRVUZaTEVOQlFVTXNUVUZCVFN4RFFVRkRMRU5CUVVNN1dVRkRka01zV1VGQldTeEhRVUZITEVkQlFVY3NRMEZCUXp0WlFVTnVRaXhOUVVGTkxFTkJRVU1zUzBGQlN5eERRVUZETEV0QlFVc3NRMEZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRSUVVNelFpeERRVUZETEVOQlFVTTdVVUZGUml4TlFVRk5MRU5CUVVNc1RVRkJUU3hIUVVGSExFMUJRVTBzUTBGQlF5eEZRVUZGTzFsQlEzWkNMRWxCUVVrc1EwRkJReXh0UWtGQmJVSXNRMEZCUXl4WlFVRlpMRU5CUVVNc1EwRkJRenRaUVVOMlF5eE5RVUZOTEVOQlFVTXNWVUZCVlN4RlFVRkZMRU5CUVVNN1VVRkRkRUlzUTBGQlF5eERRVUZETzBsQlEwb3NRMEZCUXp0SlFVVk5MRXRCUVVzc1EwRkJReXhsUVVGbE8xRkJRekZDTEU5QlFVOHNTVUZCU1N4RFFVRkRMRmxCUVZrc1EwRkJRenRKUVVNelFpeERRVUZETzBsQlJVMHNTMEZCU3l4RFFVRkRMR05CUVdNN1VVRkRla0lzVDBGQlR5eEpRVUZKTEVOQlFVTXNWMEZCVnl4RFFVRkRPMGxCUXpGQ0xFTkJRVU03UTBGRFJpSjkiLCIvKipcbiAqIENvZGUgZnJvbSB0aGUgZXhhbXBsZSBhdFxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1N1YnRsZUNyeXB0by9kaWdlc3RcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRpZ2VzdE1lc3NhZ2UobXNnVWludDgpIHtcbiAgICBjb25zdCBoYXNoQnVmZmVyID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5kaWdlc3QoXCJTSEEtMjU2XCIsIG1zZ1VpbnQ4KTsgLy8gaGFzaCB0aGUgbWVzc2FnZVxuICAgIGNvbnN0IGhhc2hBcnJheSA9IEFycmF5LmZyb20obmV3IFVpbnQ4QXJyYXkoaGFzaEJ1ZmZlcikpOyAvLyBjb252ZXJ0IGJ1ZmZlciB0byBieXRlIGFycmF5XG4gICAgY29uc3QgaGFzaEhleCA9IGhhc2hBcnJheS5tYXAoYiA9PiBiLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCBcIjBcIikpLmpvaW4oXCJcIik7IC8vIGNvbnZlcnQgYnl0ZXMgdG8gaGV4IHN0cmluZ1xuICAgIHJldHVybiBoYXNoSGV4O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pYzJoaE1qVTJMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE1pT2xzaUxpNHZMaTR2TGk0dmMzSmpMMnhwWWk5emFHRXlOVFl1ZEhNaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWtGQlFVRTdPenRIUVVkSE8wRkJSVWdzVFVGQlRTeERRVUZETEV0QlFVc3NWVUZCVlN4aFFVRmhMRU5CUVVNc1VVRkJiMEk3U1VGRGRFUXNUVUZCVFN4VlFVRlZMRWRCUVVjc1RVRkJUU3hOUVVGTkxFTkJRVU1zVFVGQlRTeERRVUZETEUxQlFVMHNRMEZCUXl4VFFVRlRMRVZCUVVVc1VVRkJVU3hEUVVGRExFTkJRVU1zUTBGQlF5eHRRa0ZCYlVJN1NVRkRka1lzVFVGQlRTeFRRVUZUTEVkQlFVY3NTMEZCU3l4RFFVRkRMRWxCUVVrc1EwRkJReXhKUVVGSkxGVkJRVlVzUTBGQlF5eFZRVUZWTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc0swSkJRU3RDTzBsQlEzcEdMRTFCUVUwc1QwRkJUeXhIUVVGSExGTkJRVk1zUTBGQlF5eEhRVUZITEVOQlFVTXNRMEZCUXl4RFFVRkRMRVZCUVVVc1EwRkJReXhEUVVGRExFTkJRVU1zVVVGQlVTeERRVUZETEVWQlFVVXNRMEZCUXl4RFFVRkRMRkZCUVZFc1EwRkJReXhEUVVGRExFVkJRVVVzUjBGQlJ5eERRVUZETEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1JVRkJSU3hEUVVGRExFTkJRVU1zUTBGQlF5dzRRa0ZCT0VJN1NVRkROVWNzVDBGQlR5eFBRVUZQTEVOQlFVTTdRVUZEYWtJc1EwRkJReUo5IiwiZXhwb3J0IGZ1bmN0aW9uIGVuY29kZV91dGY4KHMpIHtcbiAgICByZXR1cm4gdW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHMpKTtcbn1cbmV4cG9ydCBjb25zdCBlc2NhcGVTdHJpbmcgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgLy8gQ29udmVydCB0byBzdHJpbmcgaWYgbmVjZXNzYXJ5XG4gICAgaWYgKHR5cGVvZiBzdHIgIT0gXCJzdHJpbmdcIikge1xuICAgICAgICBzdHIgPSBTdHJpbmcoc3RyKTtcbiAgICB9XG4gICAgcmV0dXJuIGVuY29kZV91dGY4KHN0cik7XG59O1xuZXhwb3J0IGNvbnN0IGVzY2FwZVVybCA9IGZ1bmN0aW9uICh1cmwsIHN0cmlwRGF0YVVybERhdGEgPSB0cnVlKSB7XG4gICAgdXJsID0gZXNjYXBlU3RyaW5nKHVybCk7XG4gICAgLy8gZGF0YTpbPG1lZGlhdHlwZT5dWztiYXNlNjRdLDxkYXRhPlxuICAgIGlmICh1cmwuc3Vic3RyKDAsIDUpID09PSBcImRhdGE6XCIgJiZcbiAgICAgICAgc3RyaXBEYXRhVXJsRGF0YSAmJlxuICAgICAgICB1cmwuaW5kZXhPZihcIixcIikgPiAtMSkge1xuICAgICAgICB1cmwgPSB1cmwuc3Vic3RyKDAsIHVybC5pbmRleE9mKFwiLFwiKSArIDEpICsgXCI8ZGF0YS1zdHJpcHBlZD5cIjtcbiAgICB9XG4gICAgcmV0dXJuIHVybDtcbn07XG4vLyBCYXNlNjQgZW5jb2RpbmcsIGZvdW5kIG9uOlxuLy8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTI3MTAwMDEvaG93LXRvLWNvbnZlcnQtdWludDgtYXJyYXktdG8tYmFzZTY0LWVuY29kZWQtc3RyaW5nLzI1NjQ0NDA5IzI1NjQ0NDA5XG5leHBvcnQgY29uc3QgVWludDhUb0Jhc2U2NCA9IGZ1bmN0aW9uICh1OEFycikge1xuICAgIGNvbnN0IENIVU5LX1NJWkUgPSAweDgwMDA7IC8vIGFyYml0cmFyeSBudW1iZXJcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IGxlbmd0aCA9IHU4QXJyLmxlbmd0aDtcbiAgICBsZXQgcmVzdWx0ID0gXCJcIjtcbiAgICBsZXQgc2xpY2U7XG4gICAgd2hpbGUgKGluZGV4IDwgbGVuZ3RoKSB7XG4gICAgICAgIHNsaWNlID0gdThBcnIuc3ViYXJyYXkoaW5kZXgsIE1hdGgubWluKGluZGV4ICsgQ0hVTktfU0laRSwgbGVuZ3RoKSk7XG4gICAgICAgIHJlc3VsdCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIHNsaWNlKTtcbiAgICAgICAgaW5kZXggKz0gQ0hVTktfU0laRTtcbiAgICB9XG4gICAgcmV0dXJuIGJ0b2EocmVzdWx0KTtcbn07XG5leHBvcnQgY29uc3QgYm9vbFRvSW50ID0gZnVuY3Rpb24gKGJvb2wpIHtcbiAgICByZXR1cm4gYm9vbCA/IDEgOiAwO1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWMzUnlhVzVuTFhWMGFXeHpMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE1pT2xzaUxpNHZMaTR2TGk0dmMzSmpMMnhwWWk5emRISnBibWN0ZFhScGJITXVkSE1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJa0ZCUVVFc1RVRkJUU3hWUVVGVkxGZEJRVmNzUTBGQlF5eERRVUZETzBsQlF6TkNMRTlCUVU4c1VVRkJVU3hEUVVGRExHdENRVUZyUWl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU03UVVGRGVrTXNRMEZCUXp0QlFVVkVMRTFCUVUwc1EwRkJReXhOUVVGTkxGbEJRVmtzUjBGQlJ5eFZRVUZUTEVkQlFWRTdTVUZETTBNc2FVTkJRV2xETzBsQlEycERMRWxCUVVrc1QwRkJUeXhIUVVGSExFbEJRVWtzVVVGQlVTeEZRVUZGTzFGQlF6RkNMRWRCUVVjc1IwRkJSeXhOUVVGTkxFTkJRVU1zUjBGQlJ5eERRVUZETEVOQlFVTTdTMEZEYmtJN1NVRkZSQ3hQUVVGUExGZEJRVmNzUTBGQlF5eEhRVUZITEVOQlFVTXNRMEZCUXp0QlFVTXhRaXhEUVVGRExFTkJRVU03UVVGRlJpeE5RVUZOTEVOQlFVTXNUVUZCVFN4VFFVRlRMRWRCUVVjc1ZVRkRka0lzUjBGQlZ5eEZRVU5ZTEcxQ1FVRTBRaXhKUVVGSk8wbEJSV2hETEVkQlFVY3NSMEZCUnl4WlFVRlpMRU5CUVVNc1IwRkJSeXhEUVVGRExFTkJRVU03U1VGRGVFSXNjVU5CUVhGRE8wbEJRM0pETEVsQlEwVXNSMEZCUnl4RFFVRkRMRTFCUVUwc1EwRkJReXhEUVVGRExFVkJRVVVzUTBGQlF5eERRVUZETEV0QlFVc3NUMEZCVHp0UlFVTTFRaXhuUWtGQlowSTdVVUZEYUVJc1IwRkJSeXhEUVVGRExFOUJRVThzUTBGQlF5eEhRVUZITEVOQlFVTXNSMEZCUnl4RFFVRkRMRU5CUVVNc1JVRkRja0k3VVVGRFFTeEhRVUZITEVkQlFVY3NSMEZCUnl4RFFVRkRMRTFCUVUwc1EwRkJReXhEUVVGRExFVkJRVVVzUjBGQlJ5eERRVUZETEU5QlFVOHNRMEZCUXl4SFFVRkhMRU5CUVVNc1IwRkJSeXhEUVVGRExFTkJRVU1zUjBGQlJ5eHBRa0ZCYVVJc1EwRkJRenRMUVVNdlJEdEpRVU5FTEU5QlFVOHNSMEZCUnl4RFFVRkRPMEZCUTJJc1EwRkJReXhEUVVGRE8wRkJSVVlzTmtKQlFUWkNPMEZCUXpkQ0xIRklRVUZ4U0R0QlFVTnlTQ3hOUVVGTkxFTkJRVU1zVFVGQlRTeGhRVUZoTEVkQlFVY3NWVUZCVXl4TFFVRnBRanRKUVVOeVJDeE5RVUZOTEZWQlFWVXNSMEZCUnl4TlFVRk5MRU5CUVVNc1EwRkJReXh0UWtGQmJVSTdTVUZET1VNc1NVRkJTU3hMUVVGTExFZEJRVWNzUTBGQlF5eERRVUZETzBsQlEyUXNUVUZCVFN4TlFVRk5MRWRCUVVjc1MwRkJTeXhEUVVGRExFMUJRVTBzUTBGQlF6dEpRVU0xUWl4SlFVRkpMRTFCUVUwc1IwRkJSeXhGUVVGRkxFTkJRVU03U1VGRGFFSXNTVUZCU1N4TFFVRnBRaXhEUVVGRE8wbEJRM1JDTEU5QlFVOHNTMEZCU3l4SFFVRkhMRTFCUVUwc1JVRkJSVHRSUVVOeVFpeExRVUZMTEVkQlFVY3NTMEZCU3l4RFFVRkRMRkZCUVZFc1EwRkJReXhMUVVGTExFVkJRVVVzU1VGQlNTeERRVUZETEVkQlFVY3NRMEZCUXl4TFFVRkxMRWRCUVVjc1ZVRkJWU3hGUVVGRkxFMUJRVTBzUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEY0VVc1RVRkJUU3hKUVVGSkxFMUJRVTBzUTBGQlF5eFpRVUZaTEVOQlFVTXNTMEZCU3l4RFFVRkRMRWxCUVVrc1JVRkJSU3hMUVVGTExFTkJRVU1zUTBGQlF6dFJRVU5xUkN4TFFVRkxMRWxCUVVrc1ZVRkJWU3hEUVVGRE8wdEJRM0pDTzBsQlEwUXNUMEZCVHl4SlFVRkpMRU5CUVVNc1RVRkJUU3hEUVVGRExFTkJRVU03UVVGRGRFSXNRMEZCUXl4RFFVRkRPMEZCUlVZc1RVRkJUU3hEUVVGRExFMUJRVTBzVTBGQlV5eEhRVUZITEZWQlFWTXNTVUZCWVR0SlFVTTNReXhQUVVGUExFbEJRVWtzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU03UVVGRGRFSXNRMEZCUXl4RFFVRkRJbjA9IiwiLyogdHNsaW50OmRpc2FibGU6bm8tYml0d2lzZSAqL1xuLy8gZnJvbSBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9qZWQvOTgyODgzI2dpc3Rjb21tZW50LTI0MDMzNjlcbmNvbnN0IGhleCA9IFtdO1xuZm9yIChsZXQgaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICAgIGhleFtpXSA9IChpIDwgMTYgPyBcIjBcIiA6IFwiXCIpICsgaS50b1N0cmluZygxNik7XG59XG5leHBvcnQgY29uc3QgbWFrZVVVSUQgPSAoKSA9PiB7XG4gICAgY29uc3QgciA9IGNyeXB0by5nZXRSYW5kb21WYWx1ZXMobmV3IFVpbnQ4QXJyYXkoMTYpKTtcbiAgICByWzZdID0gKHJbNl0gJiAweDBmKSB8IDB4NDA7XG4gICAgcls4XSA9IChyWzhdICYgMHgzZikgfCAweDgwO1xuICAgIHJldHVybiAoaGV4W3JbMF1dICtcbiAgICAgICAgaGV4W3JbMV1dICtcbiAgICAgICAgaGV4W3JbMl1dICtcbiAgICAgICAgaGV4W3JbM11dICtcbiAgICAgICAgXCItXCIgK1xuICAgICAgICBoZXhbcls0XV0gK1xuICAgICAgICBoZXhbcls1XV0gK1xuICAgICAgICBcIi1cIiArXG4gICAgICAgIGhleFtyWzZdXSArXG4gICAgICAgIGhleFtyWzddXSArXG4gICAgICAgIFwiLVwiICtcbiAgICAgICAgaGV4W3JbOF1dICtcbiAgICAgICAgaGV4W3JbOV1dICtcbiAgICAgICAgXCItXCIgK1xuICAgICAgICBoZXhbclsxMF1dICtcbiAgICAgICAgaGV4W3JbMTFdXSArXG4gICAgICAgIGhleFtyWzEyXV0gK1xuICAgICAgICBoZXhbclsxM11dICtcbiAgICAgICAgaGV4W3JbMTRdXSArXG4gICAgICAgIGhleFtyWzE1XV0pO1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWRYVnBaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6SWpwYklpNHVMeTR1THk0dUwzTnlZeTlzYVdJdmRYVnBaQzUwY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTd3JRa0ZCSzBJN1FVRkZMMElzT0VSQlFUaEVPMEZCUXpsRUxFMUJRVTBzUjBGQlJ5eEhRVUZITEVWQlFVVXNRMEZCUXp0QlFVVm1MRXRCUVVzc1NVRkJTU3hEUVVGRExFZEJRVWNzUTBGQlF5eEZRVUZGTEVOQlFVTXNSMEZCUnl4SFFVRkhMRVZCUVVVc1EwRkJReXhGUVVGRkxFVkJRVVU3U1VGRE5VSXNSMEZCUnl4RFFVRkRMRU5CUVVNc1EwRkJReXhIUVVGSExFTkJRVU1zUTBGQlF5eEhRVUZITEVWQlFVVXNRMEZCUXl4RFFVRkRMRU5CUVVNc1IwRkJSeXhEUVVGRExFTkJRVU1zUTBGQlF5eEZRVUZGTEVOQlFVTXNSMEZCUnl4RFFVRkRMRU5CUVVNc1VVRkJVU3hEUVVGRExFVkJRVVVzUTBGQlF5eERRVUZETzBOQlF5OURPMEZCUlVRc1RVRkJUU3hEUVVGRExFMUJRVTBzVVVGQlVTeEhRVUZITEVkQlFVY3NSVUZCUlR0SlFVTXpRaXhOUVVGTkxFTkJRVU1zUjBGQlJ5eE5RVUZOTEVOQlFVTXNaVUZCWlN4RFFVRkRMRWxCUVVrc1ZVRkJWU3hEUVVGRExFVkJRVVVzUTBGQlF5eERRVUZETEVOQlFVTTdTVUZGY2tRc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF5eEhRVUZITEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhIUVVGSExFbEJRVWtzUTBGQlF5eEhRVUZITEVsQlFVa3NRMEZCUXp0SlFVTTFRaXhEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETEVkQlFVY3NRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRExFZEJRVWNzU1VGQlNTeERRVUZETEVkQlFVY3NTVUZCU1N4RFFVRkRPMGxCUlRWQ0xFOUJRVThzUTBGRFRDeEhRVUZITEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRMVFzUjBGQlJ5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJRenRSUVVOVUxFZEJRVWNzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1VVRkRWQ3hIUVVGSExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMUZCUTFRc1IwRkJSenRSUVVOSUxFZEJRVWNzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1VVRkRWQ3hIUVVGSExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMUZCUTFRc1IwRkJSenRSUVVOSUxFZEJRVWNzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1VVRkRWQ3hIUVVGSExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMUZCUTFRc1IwRkJSenRSUVVOSUxFZEJRVWNzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1VVRkRWQ3hIUVVGSExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMUZCUTFRc1IwRkJSenRSUVVOSUxFZEJRVWNzUTBGQlF5eERRVUZETEVOQlFVTXNSVUZCUlN4RFFVRkRMRU5CUVVNN1VVRkRWaXhIUVVGSExFTkJRVU1zUTBGQlF5eERRVUZETEVWQlFVVXNRMEZCUXl4RFFVRkRPMUZCUTFZc1IwRkJSeXhEUVVGRExFTkJRVU1zUTBGQlF5eEZRVUZGTEVOQlFVTXNRMEZCUXp0UlFVTldMRWRCUVVjc1EwRkJReXhEUVVGRExFTkJRVU1zUlVGQlJTeERRVUZETEVOQlFVTTdVVUZEVml4SFFVRkhMRU5CUVVNc1EwRkJReXhEUVVGRExFVkJRVVVzUTBGQlF5eERRVUZETzFGQlExWXNSMEZCUnl4RFFVRkRMRU5CUVVNc1EwRkJReXhGUVVGRkxFTkJRVU1zUTBGQlF5eERRVU5ZTEVOQlFVTTdRVUZEU2l4RFFVRkRMRU5CUVVNaWZRPT0iLCIvLyBodHRwczovL3d3dy51bmljb2RlLm9yZy9yZXBvcnRzL3RyMzUvdHIzNS1kYXRlcy5odG1sI0RhdGVfRmllbGRfU3ltYm9sX1RhYmxlXG5leHBvcnQgY29uc3QgZGF0ZVRpbWVVbmljb2RlRm9ybWF0U3RyaW5nID0gXCJ5eXl5LU1NLWRkJ1QnSEg6bW06c3MuU1NTWFhcIjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaWMyTm9aVzFoTG1weklpd2ljMjkxY21ObFVtOXZkQ0k2SWlJc0luTnZkWEpqWlhNaU9sc2lMaTR2TGk0dmMzSmpMM05qYUdWdFlTNTBjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lRVUZKUVN3clJVRkJLMFU3UVVGREwwVXNUVUZCVFN4RFFVRkRMRTFCUVUwc01rSkJRVEpDTEVkQlFVY3NOa0pCUVRaQ0xFTkJRVU1pZlE9PSIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IHtcbiAgICBDb29raWVJbnN0cnVtZW50LFxuICAgIERuc0luc3RydW1lbnQsXG4gICAgSHR0cEluc3RydW1lbnQsXG4gICAgSmF2YXNjcmlwdEluc3RydW1lbnQsXG4gICAgTmF2aWdhdGlvbkluc3RydW1lbnRcbn0gZnJvbSBcIm9wZW53cG0td2ViZXh0LWluc3RydW1lbnRhdGlvblwiO1xuXG5pbXBvcnQgKiBhcyBsb2dnaW5nREIgZnJvbSBcIi4vbG9nZ2luZ2RiLmpzXCI7XG5pbXBvcnQge0NhbGxzdGFja0luc3RydW1lbnR9IGZyb20gXCIuL2NhbGxzdGFjay1pbnN0cnVtZW50LmpzXCI7XG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSB7XG4gIC8vIFJlYWQgdGhlIGJyb3dzZXIgY29uZmlndXJhdGlvbiBmcm9tIGZpbGVcbiAgbGV0IGZpbGVuYW1lID0gXCJicm93c2VyX3BhcmFtcy5qc29uXCI7XG4gIGxldCBjb25maWcgPSBhd2FpdCBicm93c2VyLnByb2ZpbGVEaXJJTy5yZWFkRmlsZShmaWxlbmFtZSk7XG4gIGlmIChjb25maWcpIHtcbiAgICBjb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZyk7XG4gICAgY29uc29sZS5sb2coXCJCcm93c2VyIENvbmZpZzpcIiwgY29uZmlnKTtcbiAgfSBlbHNlIHtcbiAgICBjb25maWcgPSB7XG4gICAgICBuYXZpZ2F0aW9uX2luc3RydW1lbnQ6dHJ1ZSxcbiAgICAgIGNvb2tpZV9pbnN0cnVtZW50OnRydWUsXG4gICAgICBqc19pbnN0cnVtZW50OnRydWUsXG4gICAgICBjbGVhbmVkX2pzX2luc3RydW1lbnRfc2V0dGluZ3M6XG4gICAgICBbXG4gICAgICAgIHtcbiAgICAgICAgICBvYmplY3Q6IGB3aW5kb3cuQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELnByb3RvdHlwZWAsXG4gICAgICAgICAgaW5zdHJ1bWVudGVkTmFtZTogXCJDYW52YXNSZW5kZXJpbmdDb250ZXh0MkRcIixcbiAgICAgICAgICBsb2dTZXR0aW5nczoge1xuICAgICAgICAgICAgcHJvcGVydGllc1RvSW5zdHJ1bWVudDogW10sXG4gICAgICAgICAgICBub25FeGlzdGluZ1Byb3BlcnRpZXNUb0luc3RydW1lbnQ6IFtdLFxuICAgICAgICAgICAgZXhjbHVkZWRQcm9wZXJ0aWVzOiBbXSxcbiAgICAgICAgICAgIGxvZ0NhbGxTdGFjazogZmFsc2UsXG4gICAgICAgICAgICBsb2dGdW5jdGlvbnNBc1N0cmluZ3M6IGZhbHNlLFxuICAgICAgICAgICAgbG9nRnVuY3Rpb25HZXRzOiBmYWxzZSxcbiAgICAgICAgICAgIHByZXZlbnRTZXRzOiBmYWxzZSxcbiAgICAgICAgICAgIHJlY3Vyc2l2ZTogZmFsc2UsXG4gICAgICAgICAgICBkZXB0aDogNSxcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgaHR0cF9pbnN0cnVtZW50OnRydWUsXG4gICAgICBjYWxsc3RhY2tfaW5zdHJ1bWVudDp0cnVlLFxuICAgICAgc2F2ZV9jb250ZW50OmZhbHNlLFxuICAgICAgdGVzdGluZzp0cnVlLFxuICAgICAgYnJvd3Nlcl9pZDowLFxuICAgICAgY3VzdG9tX3BhcmFtczoge31cbiAgICB9O1xuICAgIGNvbnNvbGUubG9nKFwiV0FSTklORzogY29uZmlnIG5vdCBmb3VuZC4gQXNzdW1pbmcgdGhpcyBpcyBhIHRlc3QgcnVuIG9mXCIsXG4gICAgICAgICAgICAgICAgXCJ0aGUgZXh0ZW5zaW9uLiBPdXRwdXR0aW5nIGFsbCBxdWVyaWVzIHRvIGNvbnNvbGUuXCIsIHtjb25maWd9KTtcbiAgfVxuXG4gIGF3YWl0IGxvZ2dpbmdEQi5vcGVuKGNvbmZpZ1snc3RvcmFnZV9jb250cm9sbGVyX2FkZHJlc3MnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnWydsb2dnZXJfYWRkcmVzcyddLFxuICAgICAgICAgICAgICAgICAgICAgICBjb25maWdbJ2Jyb3dzZXJfaWQnXSk7XG5cbiAgaWYgKGNvbmZpZ1tcImN1c3RvbV9wYXJhbXNcIl1bXCJwcmVfaW5zdHJ1bWVudGF0aW9uX2NvZGVcIl0pIHtcbiAgICBldmFsKGNvbmZpZ1tcImN1c3RvbV9wYXJhbXNcIl1bXCJwcmVfaW5zdHJ1bWVudGF0aW9uX2NvZGVcIl0pXG4gIH1cbiAgaWYgKGNvbmZpZ1tcIm5hdmlnYXRpb25faW5zdHJ1bWVudFwiXSkge1xuICAgIGxvZ2dpbmdEQi5sb2dEZWJ1ZyhcIk5hdmlnYXRpb24gaW5zdHJ1bWVudGF0aW9uIGVuYWJsZWRcIik7XG4gICAgbGV0IG5hdmlnYXRpb25JbnN0cnVtZW50ID0gbmV3IE5hdmlnYXRpb25JbnN0cnVtZW50KGxvZ2dpbmdEQik7XG4gICAgbmF2aWdhdGlvbkluc3RydW1lbnQucnVuKGNvbmZpZ1tcImJyb3dzZXJfaWRcIl0pO1xuICB9XG5cbiAgaWYgKGNvbmZpZ1snY29va2llX2luc3RydW1lbnQnXSkge1xuICAgIGxvZ2dpbmdEQi5sb2dEZWJ1ZyhcIkNvb2tpZSBpbnN0cnVtZW50YXRpb24gZW5hYmxlZFwiKTtcbiAgICBsZXQgY29va2llSW5zdHJ1bWVudCA9IG5ldyBDb29raWVJbnN0cnVtZW50KGxvZ2dpbmdEQik7XG4gICAgY29va2llSW5zdHJ1bWVudC5ydW4oY29uZmlnWydicm93c2VyX2lkJ10pO1xuICB9XG5cbiAgaWYgKGNvbmZpZ1snanNfaW5zdHJ1bWVudCddKSB7XG4gICAgbG9nZ2luZ0RCLmxvZ0RlYnVnKFwiSmF2YXNjcmlwdCBpbnN0cnVtZW50YXRpb24gZW5hYmxlZFwiKTtcbiAgICBsZXQganNJbnN0cnVtZW50ID0gbmV3IEphdmFzY3JpcHRJbnN0cnVtZW50KGxvZ2dpbmdEQik7XG4gICAganNJbnN0cnVtZW50LnJ1bihjb25maWdbJ2Jyb3dzZXJfaWQnXSk7XG4gICAgYXdhaXQganNJbnN0cnVtZW50LnJlZ2lzdGVyQ29udGVudFNjcmlwdChjb25maWdbJ3Rlc3RpbmcnXSwgY29uZmlnWydjbGVhbmVkX2pzX2luc3RydW1lbnRfc2V0dGluZ3MnXSk7XG4gIH1cblxuICBpZiAoY29uZmlnWydodHRwX2luc3RydW1lbnQnXSkge1xuICAgIGxvZ2dpbmdEQi5sb2dEZWJ1ZyhcIkhUVFAgSW5zdHJ1bWVudGF0aW9uIGVuYWJsZWRcIik7XG4gICAgbGV0IGh0dHBJbnN0cnVtZW50ID0gbmV3IEh0dHBJbnN0cnVtZW50KGxvZ2dpbmdEQik7XG4gICAgaHR0cEluc3RydW1lbnQucnVuKGNvbmZpZ1snYnJvd3Nlcl9pZCddLFxuICAgICAgICAgICAgICAgICAgICAgICBjb25maWdbJ3NhdmVfY29udGVudCddKTtcbiAgfVxuXG4gIGlmIChjb25maWdbJ2NhbGxzdGFja19pbnN0cnVtZW50J10pIHtcbiAgICBsb2dnaW5nREIubG9nRGVidWcoXCJDYWxsc3RhY2sgSW5zdHJ1bWVudGF0aW9uIGVuYWJsZWRcIik7XG4gICAgbGV0IGNhbGxzdGFja0luc3RydW1lbnQgPSBuZXcgQ2FsbHN0YWNrSW5zdHJ1bWVudChsb2dnaW5nREIpO1xuICAgIGNhbGxzdGFja0luc3RydW1lbnQucnVuKGNvbmZpZ1snYnJvd3Nlcl9pZCddKTtcbiAgfVxuICBcbiAgaWYgKGNvbmZpZ1snZG5zX2luc3RydW1lbnQnXSkge1xuICAgIGxvZ2dpbmdEQi5sb2dEZWJ1ZyhcIkROUyBpbnN0cnVtZW50YXRpb24gZW5hYmxlZFwiKTtcbiAgICBsZXQgZG5zSW5zdHJ1bWVudCA9IG5ldyBEbnNJbnN0cnVtZW50KGxvZ2dpbmdEQik7XG4gICAgZG5zSW5zdHJ1bWVudC5ydW4oY29uZmlnWydicm93c2VyX2lkJ10pO1xuICB9XG5cbiAgYXdhaXQgYnJvd3Nlci5wcm9maWxlRGlySU8ud3JpdGVGaWxlKFwiT1BFTldQTV9TVEFSVFVQX1NVQ0NFU1MudHh0XCIsIFwiXCIpO1xufVxuXG5tYWluKCk7XG5cbiJdLCJzb3VyY2VSb290IjoiIn0=