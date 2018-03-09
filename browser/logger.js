
var _DEFAULTS = {   
                    'url': '/api/log', 
                    'flushInterval': 1000, 
                    isInSampling: true, 
                    samplingRate: 100,
                    collectMetrics: true
                };

function Logger() {   
    this.buffer = []; 
    this.plugins = {};

    this.url = _DEFAULTS.url;
    this.flushInterval = _DEFAULTS.flushInterval;
    this.collectMetrics = _DEFAULTS.collectMetrics;    
}

Logger.prototype.init = function(options) {
    var thisObj = this;
    options = options || _DEFAULTS;    
    this.url = options.url || this.url;
    this.flushInterval = options.flushInterval || this.flushInterval; //In ms

    this.collectMetrics = options.collectMetrics !== undefined ? options.collectMetrics : this.collectMetrics;

    //Use Sampling Flag provide in init() or calculate Sampling factor based on Sampling Rate
    var isInSampling = options.isInSampling !== undefined ? options.isInSampling : sample(options.samplingRate);
    console.log('Is in Sample: ', isInSampling);
    
    //Setup timer & flush ONLY if this is in Sampling
    if(isInSampling) {
        var loglevels = ['log', 'info', 'warn','debug','error'];

        loglevels.forEach(function(level) {
            var _fn = console[level];
            console[level] = function(args) {
                logger[level](args);
                _fn(args);
            }
        });

        setInterval(function() {
            if(thisObj.buffer.length > 0) {
                thisObj.flush();
            }                
        }, options.flushInterval);
    }
}

Logger.prototype.registerPlugin = function(property, customFunction) {
    this.plugins[property] = customFunction;
}

Logger.prototype.metrics = function() {
    if(!(window && window.performance)) {
        return;
    }

    var perf = window.performance;
    var perfData = perf.timing;
    var navData = perf.navigation;
    var metrics = {
        'navType': navData.type, // 0=Navigate, 1=Reload, 2=History
        'rc': navData.redirectCount,
        'lt': perfData.loadEventEnd - perfData.navigationStart, //PageLoadTime
        'ct': perfData.responseEnd - perfData.requestStart, //connectTime
        'rt': perfData.domComplete - perfData.domLoading //renderTime
    };
    return metrics;
}

Logger.prototype.log = function(message) {
    this.buffer.push({level: 'LOG',msg: message});
}

Logger.prototype.info = function(message) {
    this.buffer.push({level: 'INFO',msg: message});
}

Logger.prototype.debug = function(message) {
    this.buffer.push({level: 'DEBUG',msg: message});
}

Logger.prototype.warn = function(message) {
    this.buffer.push({level: 'WARN',msg: message});
}

Logger.prototype.error = function(message) {
    this.buffer.push({level: 'ERROR',msg: message});
}

Logger.prototype.clearBuffer = function(clearFromIndex) {
    this.buffer = this.buffer.slice(clearFromIndex);
}

Logger.prototype.flush = function() {
    var _this = this;

    if(_this.buffer.length < 1) {
        return;
    } 
    var bufSize = _this.buffer.length;
    var payload = {
        'metrics': _this.metrics(),
        'logs': _this.buffer        
        
    };

    Object.keys(_this.plugins).forEach(function(property) {
        payload[property] = _this.plugins[property]();
    });

    if(navigator && navigator.sendBeacon) {
        var status = navigator.sendBeacon(_this.url, JSON.stringify(payload));
        if(status) {
            _this.clearBuffer(bufSize);
        }        
    } else {        
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.url, true); // third parameter indicates sync xhr
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {//Call a function when the state changes.
            if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
                // Request finished. Do processing here.
                _this.clearBuffer(bufSize);
            }
        }
        xhr.send(payload);
    }
}

function sample(samplingRate) {
    if(Math.random() * 100 < samplingRate) {
        return true;
    } else {
        return false;
    }    
}

function intialize() {    
    var logger = new Logger();
    if(window) {
        window.$logger = logger;        
    }    
}

intialize();