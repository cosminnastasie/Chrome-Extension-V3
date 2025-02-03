const client_id = 'chromeplugin';
const client_secret = 'raspberry';
const refreshTokenDelta = 60 * 60 * 1000
const plPayload = {
    bypassTotalCount: true,
    page: 1,
    nrOfRecords: 50000,
    filters: [],
    fields: [
        "Name",
        "Code"
    ]
};
const plEndpoint = '/api/PriceObjects/pricelists';
const plOptions = {
    'contentType': 'application/json',
    "body": JSON.stringify(plPayload)
}
const PAPIURL = ''


// On installed 
// - set default rules 
// - open options page

let defaultConditions = [
    new chrome.declarativeContent.PageStateMatcher({
        pageUrl: { hostSuffix: '.priceedge.eu' },
    })
]    
   
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.storage.local.remove(["access_token", "tokenExpiration", 'domain', 'trackedDomains', 'areColumnSettingsSet', 'infoExpirationTime', 'refresh_token', 'isLogin', 'siteSelectors', 'deviationSettings', 'dataPricelist']);
        updateRules(() => {
            chrome.runtime.openOptionsPage();
        });
    }
});

chrome.runtime.onUpdateAvailable.addListener(()=>{
    chrome.runtime.reload();
})

updateRules = (callback) => {
    // Set default conditions where popup action is enabled
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        // Page actions are disabled by default and enabled on select tabs
        chrome.action.disable();
        chrome.declarativeContent.onPageChanged.addRules([
            {
                conditions: defaultConditions,
                actions: [new chrome.declarativeContent.ShowAction()]
            }
        ]);
        if (typeof (callback) === 'function')
            callback();
    });
}

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log('Background received message: ', request.action);

        if (request.action === 'checkLogin') {
            chrome.storage.local.get(['access_token', 'tokenExpiration'], function (result) {
                let tokenExpiration = result['tokenExpiration'];
                
                if (typeof tokenExpiration === 'undefined') {
                    chrome.runtime.sendMessage({ action: "showLogin" });
                } else {
                    if (tokenExpiration < Date.now()) {
                        refreshToken();
                    } else {
                        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                            chrome.action.setBadgeText({ tabId: tabs[0].id, text: '' })
                        });
                        chrome.runtime.sendMessage({ action: "loggedIn" });
                    }
                }
            })
        }

        if (request.action === 'doLogin') {
            let userName = request.credentials.userName;
            let password = request.credentials.password;
            getToken(userName, password, getBrowserExtensionInfo);
        }

        if (request.action === 'logOut') {
            removeTokens(() => {
                chrome.runtime.sendMessage({ action: "loggedOut" });
            })
        }

        if (request.action === 'getPopupData') {
            getProductData(request);
        }

        if (request.action === 'checkSiteInfoExpiration') {
            chrome.storage.local.get(['infoExpirationTime'], function (result) {
                if (result.infoExpirationTime < new Date().getTime()) {
                    getBrowserExtensionInfo();
                }
            })
        }

        if (request.action === 'getProductListPageData') {
            getDeviationData(request);
        }

        if(request.action === 'refreshExtensionSettings'){
            getBrowserExtensionInfo();
        }

        if(request.action === 'searchItem'){
            searchItem(request);
        }
        
        if(request.action === 'getPricelists'){
            getPricelists();
        }   

        if(request.action === 'saveMatch'){
            let params = {code: request.params.cd_DataSource, itemNumber: request.params.itemNumber, comp_url: request.params.url}
            postRequest(
                '/api/data/collect/add_manual_match_url', 
                params, 
                (data) => {
                    console.log('POST REQUEST DATA', data);
                },
                ()=>searchItem(request),
                {
                    contentType: 'application/json',
                    body: JSON.stringify(params)
                }
            );
        }
    }
);

let searchItem = (request) => {
    var parameters = {"resource":"Item","searchValue": request.patern,"maxRows":100};
    postRequest(
        '/api/data/search', 
        parameters, 
        (data) => {
            if (data.message && data.message.includes('Authorization has been denied')) {
                refreshToken((data)=>{
                    searchItem(request)
                });
            }else{
                chrome.runtime.sendMessage({ action: "searchItemData", data: (data?.Data || [])});
            }
        },
        ()=>searchItem(request),
        {
            contentType: 'application/json',
            body: JSON.stringify(parameters)
        }
    );
}

getProductData = (request) => {
    postRequest('/api/plugin/product-data', request.payloads, (data) => {
        chrome.runtime.sendMessage({ action: "getPopupDataResponse", data: data });
    });
}

getDeviationData = (request) => {
    postRequest('/api/plugin/products-deviation-data', request.payloads, (data) => {
        if (data.message && data.message.includes('Authorization has been denied')) {
            refreshToken((data)=>{
                getDeviationData(request)
            });

        }else{
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.tabs.sendMessage(tabs[0]?.id, { action: "getDeviationDataResponse", data: data });
            });
        }
    });
}

refreshToken = (callback) => {
    chrome.storage.local.get(['domain', 'refresh_token'], function (result) {
        domain = result.domain;
        let papiUrl = result.domain === 'develop' ? PAPIURL : `https://${domain}.priceedge.eu/papi`;
        let refresh_token = result['refresh_token'];
        

        var formdata = new FormData();
        formdata.append("grant_type", "refresh_token");
        formdata.append("client_id", client_id);
        formdata.append("client_secret", client_secret);
        formdata.append("refresh_token", refresh_token);
        
        var requestOptions = {
          method: 'POST',
          body: formdata,
          redirect: 'follow'
        };    
       
        var refreshTokenUrl = papiUrl + '/token'
        fetch(refreshTokenUrl, requestOptions)
            .then(response => response.json())
            .then(data => {

                if(data.status === 401){
                    chrome.runtime.sendMessage({ action: "loggedOut" });
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        chrome.action.setBadgeText({ tabId: tabs[0].id, text: 'OFF' })
                    });
                    chrome.storage.local.remove( "tokenExpiration");
                }else if (data.access_token) {
                    let access_token = data.access_token;
                    let refresh_token = data.refresh_token;
                    let tokenExpiration = Date.now() + refreshTokenDelta;

                    setTokens(access_token, refresh_token, tokenExpiration, () => {
                        chrome.runtime.sendMessage({ action: "tokenRefreshed" });
                        if (typeof (callback) === 'function')
                            callback()
                    });
                }

                if (data.error) {
                    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                        chrome.action.setBadgeText({ tabId: tabs[0].id, text: 'OFF' })
                    });
                    chrome.storage.local.set({ 'isLogin': false }, () => {
                        chrome.runtime.sendMessage({ action: "loggedOut", errorMessage: data.error_description });
                    })
                }
            })
            .catch(error => {
                chrome.runtime.sendMessage({ action: "loggedOut" });
            })
    })
}

getToken = (userName, password, getTokenCallback) => {
    chrome.storage.local.get(['domain', 'trackedDomains'], function (result) {
        domain = result.domain;
        let papiUrl = result.domain === 'develop' ? PAPIURL : `https://${domain}.priceedge.eu/papi`;
        
        var formdata = new FormData();
        formdata.append("grant_type", "password");
        formdata.append("client_id", client_id);
        formdata.append("client_secret", client_secret);
        formdata.append("username", userName);
        formdata.append("password", password);
        var requestOptions = {
            method: 'POST',
            body: formdata,
            redirect: 'follow'
          };

        var urlToken = papiUrl + '/token'
        fetch(urlToken, requestOptions)
            .then(response => response.json())
            .then(data => {
                //Login succeed

                if (data.access_token) {
                    let access_token = data.access_token;
                    let refresh_token = data.refresh_token;
                    let tokenExpiration = Date.now() + refreshTokenDelta;

                    setTokens(access_token, refresh_token, tokenExpiration, () => {
                        if (typeof (getTokenCallback) === 'function')
                            getTokenCallback()
                    });

                }
                // Login failed
                if (data.error) {
                    chrome.runtime.sendMessage({ action: "errorOnLogin", errorMessage: data.error_description });
                }
            })
            .catch(error => {
                chrome.runtime.sendMessage({ action: "errorOnLogin" });
            })
    })
}

getBrowserExtensionInfo = () => {
    getBrowserSystemSetting();
    getRequest('/api/plugin/settings', setBrowserExtensionInfo);

    getRequest('/api/plugin/matching-domains', (data) => {
        let matchingDomains = data?.Data?.data;
        if(matchingDomains.length){
            matchingDomains.forEach(d => {
                defaultConditions.push((new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostSuffix: d.Domain.split('www.')[1] },
                })))
            });
            updateRules(() => {
                chrome.storage.local.set({ 'matchingDomains': matchingDomains}, () => {
                    chrome.runtime.sendMessage({ action: "matchingDomains" });
                })
            })
        }
    });

    
    getPricelists();
}

getPricelists = () => {
    // Get pticelist list
    postRequest(plEndpoint, null, (data)=>{
        let pricelists = data?.Data?.data;
        if(pricelists){
            chrome.storage.local.set({ pricelists: pricelists }, () => {});
        }
    }, null, plOptions)
}


getBrowserSystemSetting = () => {
    getRequest('/api/misc/SystemSettings/systemBrowserExtensionSettings', (data) => {
        if (data.Data && data.Data.length) {
            try {
                let priceColumns = JSON.parse(data.Data).priceColumns;
                chrome.storage.local.set({slotsColumnsInfo: priceColumns})
            } catch (e) {
                return false;
            }
            try {
                let deviationSettings = JSON.parse(data.Data).deviationSettings;
                chrome.storage.local.set({deviationSettings: deviationSettings})
            } catch (e) {
                return false;
            }
            chrome.storage.local.set({ 'areColumnSettingsSet': true }, () => {
                chrome.runtime.sendMessage({ action: "areColumnSettingsSet" });
            });
        }
    });
}

setInfoExpirationTime = () => {
    var nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    chrome.storage.local.set({ 'infoExpirationTime': nextMidnight.getTime() });
}

setBrowserExtensionInfo = (data) => {
    let info = data.Data;
    let trackedDomains = [... new Set(info.map(d => d.Domain))];

    if (trackedDomains.length) {
        chrome.storage.local.set({ 'siteSelectors': info, 'trackedDomains': trackedDomains }, () => {
            setInfoExpirationTime();

            trackedDomains.forEach(d => {
                defaultConditions.push((new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostSuffix: d },
                })))
            })
            updateRules(() => {
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    chrome.action.setBadgeText({ tabId: tabs[0].id, text: '' })
                });
                chrome.runtime.sendMessage({ action: "loggedIn", settingsStatus: 'refreshed' });
            })
        })
    } else if (!info.length) {
        chrome.runtime.sendMessage({ action: "noDomainsSet" });
    }
}

setTokens = (access_token, refresh_token, tokenExpiration, callback) => {
    chrome.storage.local.set({ 'access_token': access_token, 'refresh_token': refresh_token, 'tokenExpiration': tokenExpiration }, function () {
        if (typeof (callback) === 'function')
            callback();
    });
}

removeTokens = (callback) => {
    chrome.storage.local.remove(["access_token", "refresh_token", 'tokenExpiration'], function () {
        if (typeof (callback) === 'function')
            callback();
    })
}

function postRequest(endpoint, parameters, callback, errorBack, rOptions) {
    let token = '';
    chrome.storage.local.get(['access_token', 'domain'], function (result) {
        domain = result.domain;
        let papiUrl = result.domain === 'develop' ? PAPIURL : `https://${domain}.priceedge.eu/papi`;
        token = result['access_token'];
        var myHeaders = new Headers();
        myHeaders.append("Authorization", "Bearer " + token);
        var contentType = rOptions?.contentType ? rOptions.contentType: "application/x-www-form-urlencoded";
        myHeaders.append("Content-Type", contentType);

        var requestBody;
        if(rOptions?.body){
            requestBody = rOptions?.body;
        }else{
            var requestBody = new URLSearchParams();
            if (parameters) {
                Object.keys(parameters).forEach(k => {
                    requestBody.append(k, parameters[k]);
                })
            }
        }
       
        var requestOptions = {
            method: 'POST',
            headers: myHeaders,
            body: requestBody,
            redirect: 'follow'
        };


        let url = papiUrl + endpoint;
        fetch(url, requestOptions)
            .then(function(response) {
                if (!response.ok) {
                    if(response.status === 401){
                        refreshToken(errorBack);
                        throw new Error(response.statusText)
                    }
                }else{
                    return response.json();
                }
            })
            .then(result => {
                callback(result);
            })
            .catch(error => console.log(error));
    })
}

function getRequest(endpoint, callback) {
    let token = '';
    chrome.storage.local.get(['access_token', 'domain'], function (result) {
        domain = result.domain;
        let papiUrl = result.domain === 'develop' ? PAPIURL : `https://${domain}.priceedge.eu/papi`;

        token = result['access_token'];
        var myHeaders = new Headers();
        myHeaders.append("Authorization", "Bearer " + token);
        myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

        var requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        let url = papiUrl + endpoint;
        fetch(url, requestOptions)
            .then(response => response.json())
            .then(result => {
                if (typeof (callback) === 'function') {
                    callback(result);
                }
            })
            .catch(error => console.log('error', error));
    })
}


