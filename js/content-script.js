var inRangeColor  = '#ffa500';
var bellowRangeColor = '#12d018';
var upToRangeColor = '#e7556a';
var minDev = -2;
var maxDev = 2;  

try{

    var triggerGetData = false;
    var consumedIds = new Set();
    var newIdsList = new Set();
    var isDynamicPage = true;
    
    let collectProductsIds = () => {
        chrome.storage.local.get(['siteSelectors', 'trackedDomains'], (result) => {
            if(result?.trackedDomains?.includes( window.location.hostname)){
                let productsListPagesSelectors = result['siteSelectors'].filter(i=>window.location.hostname === i.Domain).filter(u=>u.SitePagesType === "productsListPages");

                if(productsListPagesSelectors){
                    for (var i=0; i < productsListPagesSelectors.length; i++){
                        let {sel, Id, AddText, attr, replace, splitChar, splitKey, IsPageDynamic} = productsListPagesSelectors[i];
                        
                        if(IsPageDynamic !== true){
                            isDynamicPage = false;
                        }
                        
                        if(document.querySelectorAll(sel).length){
                            document.querySelectorAll(sel).forEach((el) => {
                                let productId = el.getAttributeNode(attr)?.value;
    
                                //Remove text
                                if(replace){
                                    productId = productId.replace(replace, '')
                                }
            
                                // Split text
                                if(splitChar){
                                    productId = splitKey === '-1'? productId.split(splitChar).pop(): productId.split(splitChar)[splitKey];
                                }
    
                                //Add text
                                if (AddText){
                                    productId = AddText + productId;
                                }
    
                                if(!(newIdsList.has(productId))){
                                    newIdsList.add(productId);
                                    triggerGetData = true;
                                }
            
                                // Add element classes or data attribute
            
                                el.setAttribute('data-extension-id', productId);
                                el.classList.add('pe-box');
                            });
    
                        };
    
                        if(triggerGetData){
                            let newIdsListArr = Array.from(newIdsList);
                            newIdsListArr = newIdsListArr.filter(i=>!(consumedIds.has(i)));
                            let productIdsList = (newIdsListArr).join(',') + ',';
                            let payloads = {selectorId: Id, productIdsList };
                            chrome.storage.local.get(["dataPricelist"], function (result) {
                                payloads['pricelist'] = result?.dataPricelist
                                chrome.runtime.sendMessage({action: "getProductListPageData", payloads });
                            })

                            triggerGetData = false;
                            newIdsListArr.forEach(u=>consumedIds.add(u));
                        }  
                    }
                };
            }else{
                if(getProductsIdsInterval){
                    clearInterval(getProductsIdsInterval);            
                }
                isDynamicPage = false;
            }
        })
    }
    
    collectProductsIds();
    
    let getProductsIdsInterval = setInterval(()=>{
        if(isDynamicPage === false){
            clearInterval(getProductsIdsInterval);            
        }
        collectProductsIds();
    }, 3000);
    
    
    chrome.runtime.onMessage.addListener(
        function (request, sender, sendResponse) {
            if(request.action === 'getPopupSelector'){
                chrome.storage.local.get('siteSelectors', function(result){
                    let selectors = result['siteSelectors'].filter(i=>window.location.hostname.replace('www.', '') === i.Domain.replace('www.', '')).filter(u=>u.SitePagesType !== "productsListPages");
                    let selectorType = ''
                    var competitorsSelector = selectors.filter(s=>s.cd_Competitor);
                    
                    if(selectors.length){
                        let productId = ''
                        for (let s of selectors){
                            let idElement = document.querySelector(s.sel)
                            if(idElement || idElement != null){
                                if(s.attr === 'text'){
                                    if(idElement.innerText)
                                        productId = idElement.innerText
                                }else{
                                    if(idElement.getAttribute(s.attr)){
                                        productId = idElement.getAttribute(s.attr)
                                    }
                                }

                                // Replace
                                productId = productId.replace(s.replace, '');
                                if(s.splitChar !== '' && s.splitChar != null){
                                    productId = productId.split(s.splitChar)[parseInt(s.splitKey)]
                                }

                                if (productId !== ''){
                                    selectorType = s.SelectorType;
                                    // break
                                }
                            }
                            if(productId !== ''){
                                console.log('ProductId: ', productId);
                                // Set default  pricelist
                                chrome.storage.local.get(["dataPricelist"], function (result) {
                                    let dataPricelist = result?.dataPricelist
                                    if(! dataPricelist){
                                        chrome.storage.local.set({ dataPricelist: s.cd_Pricelist }, () => {});
                                    }
                                    // Get data
                                    let payloads = {
                                        productId: productId.toString().trim(),
                                        type: selectorType.toString(),
                                        domain: s.Domain.toString(),
                                        pricelist: dataPricelist
                                    }
                                    chrome.runtime.sendMessage({action: "getPopupData", payloads});
                                })
                            }else{
                                chrome.runtime.sendMessage({action: "noIdFound"});
                            }
                            break
                        }
                    }else{
                        chrome.runtime.sendMessage({action: "noSelectors"});
                    }

                    // Match popup will be shown only if the site exists in matchingDomains
                    // match icon will be add if matchingDomains exists and if competitorsSelector has value
                    //                                                     (if the page is a competitor page)

                    chrome.storage.local.get('matchingDomains', function(result){
                        let matchingDomains = result?.matchingDomains?.filter(m=>{
                            return (m.Domain === window.location.hostname || (('www.' + m.Domain) === window.location.hostname));
                        })
                        if(matchingDomains.length){
                            if(competitorsSelector.length){
                                chrome.runtime.sendMessage({action: "setMatchPopupIcon", matchingDomains});
                            }else{
                                chrome.runtime.sendMessage({action: "showMatchPopup"});
                            }
                        };
                    })
                })
            }
    
            if(request.action === 'getDeviationDataResponse'){
                let data = request.data?.Data || [];
                console.log(data);
                if(data.length){
                    chrome.storage.local.get(['deviationSettings', 'siteSelectors'], (result)=>{
                        let selectorId = data[0].selectorId;
                        let HighlightElementSelector = result['siteSelectors'].filter(i=>i.Id === selectorId)[0].HighlightElementSelector
                        let deviationSettings = result.deviationSettings;
  
                        if(typeof(deviationSettings) !== 'undefined'){
                            inRangeColor = deviationSettings.filter(i=>i.fieldName==='inRangeColor').length? deviationSettings.filter(i=>i.fieldName==='inRangeColor')[0].value: '#ffa500';
                            upToRangeColor = deviationSettings.filter(i=>i.fieldName==='upToRangeColor').length? deviationSettings.filter(i=>i.fieldName==='upToRangeColor')[0].value: '#12d018';
                            bellowRangeColor = deviationSettings.filter(i=>i.fieldName==='bellowRangeColor').length? deviationSettings.filter(i=>i.fieldName==='bellowRangeColor')[0].value: '#e7556a';
                            minDev = deviationSettings.filter(i=>i.fieldName==='minDeviation').length? deviationSettings.filter(i=>i.fieldName==='minDeviation')[0].value: '-2';
                            maxDev = deviationSettings.filter(i=>i.fieldName==='maxDeviation').length? deviationSettings.filter(i=>i.fieldName==='maxDeviation')[0].value: '2';    
                        }
                        
                        data.forEach(el => {
                            if(el.Deviation !== null){
                                let deviation  = el.Deviation *100;
                                let peBox = document.querySelector(".pe-box[data-extension-id='"+ el.siteProductNumber +"']");
                                if(HighlightElementSelector){
                                    peBox = peBox.closest(HighlightElementSelector)
                                }
                                let peColor = '';
                                if(deviation < minDev){
                                    peColor = bellowRangeColor;
                                }else if (deviation >= minDev && deviation <= maxDev){
                                    peColor = inRangeColor;
                                }else if(deviation > maxDev){
                                    peColor = upToRangeColor;
                                }
                                peBox.style.border = '2px solid '+ peColor;
                                peBox.style.boxShadow = peColor + ' 0px 0px 5px'
                                peBox.style.position = 'relative'
                                let deviationString = (deviation).toFixed(2) + '%'
                                var deviationBox = document.createElement("div");
                                peBox.appendChild(deviationBox);
                                deviationBox.classList.add('pe-item-deviation-box',)
                                var deviationBoxContent = document.createElement("span");
                                deviationBoxContent.classList.add('pe-dev-tag');
                                var text = document.createTextNode(deviationString);
                                deviationBoxContent.appendChild(text);
                                
                                deviationBoxContent.style.border = '2px solid '+ peColor;
                                deviationBoxContent.style.boxShadow = peColor + ' 0px 0px 5px'
                                deviationBox.appendChild(deviationBoxContent);
                            }
                        });
                    })
                }
                
            }

            if (request.action === "getPageUrl"){
                sendResponse({pageUrl: window.location.origin, location: window.location});
            }
        }
    );
       
}
catch(e){}