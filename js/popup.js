let pePopupWraper = document.getElementById('pePopupWraper')
let pePopup = document.querySelector('#pePopup');
let loginForm = document.querySelector('#loginForm');
let waitImage = document.querySelector('#waitImage');
let extensionReadyBox = document.querySelector('#extensionReadyBox');
let gridDiv = document.querySelector('#popupGrid');
let noMatchBox = document.querySelector('#noMatchBox');
let noSettingsError = document.querySelector('#noSettingsError');
let popupError = document.querySelector('#popupError');
let logOut = document.querySelector('#logOut');
let UIErrors = document.querySelector('#UIErrors');
let buildupTableBox = document.querySelector('#buildupTableBox');
let matchUrl = document.querySelector('#matchUrl');
var buildupData = []

let checkLogin = () => {
    chrome.runtime.sendMessage({ action: "checkLogin" });
}
checkLogin();

// Listen messages

let showPopupErrorMessage = (error, button, imgLink) => {
    var imageSrc = imgLink || 'https://cdn.priceedge.eu/price/images/new/554_PE_new-icons_v3_14b.png';
    var rez = `<div class="center-block-error"><img src="${imageSrc}" style="max-width: 200px;" /><span>${error}</span>` + (button || '') + `</div>`;
    popupError.innerHTML = DOMPurify.sanitize(rez);  
}

let popupElements = document.querySelectorAll('.popup-element');
let hidePopupElements = () => {
    for (var s = 0; s < popupElements.length; s++){
        popupElements[s].classList.add('hide');
    }
}

let handlePopupError = (error, showButton, buttonLink, imgLink) => {
    if(showButton === true){
        chrome.storage.local.get(['domain'], function (result) {
            let href = `https://${result.domain}.priceedge.eu/v2/${buttonLink}`;
            var button = `<a href="${href}" style="margin-top: 40px" target="_blank" id="domainsSettingLink" class=" popup-element private-red-button">Set Domains</a>`;
            showPopupErrorMessage(error, button, imgLink);
            popupError.classList.remove('hide');
        })
    } else{
        showPopupErrorMessage(error, false, imgLink);
        popupError.classList.remove('hide');
    }   
}

chrome.runtime.onMessage.addListener(

    function (request, sender, sendResponse) {

        if (request.action === 'showLogin' || request.action === 'loggedOut') {
            if (request.action === 'loggedOut')
                errorLabel.innerHTML = ''
            
            hidePopupElements();
            
            waitImageLogin.classList.add('hide');
            loginBtnRow.classList.remove('hide');
            showLoginForm();
        }
        if (request.action === 'loggedIn' || request.action === 'tokenRefreshed') {
            if (request.action === 'loggedIn') {
                // Check site settings. They need to be updated once per day
                chrome.runtime.sendMessage({ action: "checkSiteInfoExpiration" });
            }

            loginForm.classList.add('hide');

            // Popup action starts here; Send to content_script; will get back popupData

            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                waitImage.classList.remove('hide');
                chrome.tabs.sendMessage(tabs[0].id, { action: "getPopupSelector" });
            });
        }

        if (request.action === 'errorOnLogin') {
            errorOnLogin.classList.remove('hide')

            waitImage.classList.add('hide');
            waitImageLogin.classList.add('hide')
            pePopup.classList.add('hide');
            errorMessage = request.errorMessage || 'There was an error in the login process. Please try again, and if it keeps happening, contact support!'
            loginBtn.classList.add('disabled');
            loginBtnRow.classList.remove('hide');
            var errorHtml = DOMPurify.sanitize(`<span class="error-color bold-500 " >Something went wrong</span><span class="error-color font-14">${errorMessage}</span>`);
            errorOnLogin.innerHTML = errorHtml;

        }

        if (request.action === 'noDomainsSet') {
            hidePopupElements();
            let error = 'There are no domains set on your backend!'
            let settingsLink = 'settings/browser-extension?currentTab-columnsSettings=tab-selectorsSettings'
            handlePopupError(error, true, settingsLink);
            
            chrome.storage.local.get('siteSelectors', function(result){
                let selectors = result['siteSelectors'].filter(i=>window.location.hostname === i.Domain).filter(u=>u.SitePagesType !== "productsListPages");
                let competitorsSelector = selectors.filter(s=>s.cd_Competitor);
                if(competitorsSelector.length){
                    showMatch();
                }else{
                    handlePopupError('There are no domains set on your backend!', true, settingsLink, 'https://cdn.priceedge.eu/price/images/new/pe-img_report_1.png');
                }
            })
        }

        if(request.action === 'showMatchPopup'){
            showMatch();
        }

        if (request.action === 'getPopupDataResponse') {
            waitImage.classList.add('hide')
            if (request.data && request.data.Errors && request.data.Errors.length) {
                popupError.classList.remove('hide')
                errorMessage = 'There was an issue on getting data. Please reopen the popup! If the error persists, you need to contact support.';
                showPopupErrorMessage(errorMessage);
            } else if (request.data.message && !request.data.Data) {
                popupError.classList.remove('hide')
                errorMessage = request.data.message;
                showPopupErrorMessage(errorMessage);
            } else {
                popupError.classList.add('hide')
                let data = request.data.Data?.[0];
                if ((! data.Data && data?.Errors?.length) || request?.data?.Data?.length === 0) {
                    popupError.classList.remove('hide');
                    errorMessage = data.Errors || 'No data was found for this product!';
                    showPopupErrorMessage(errorMessage);
                } else {
                    showPePopup(data);
                }
            }
        }

        if (request.action === 'noIdFound') {
            hidePopupElements();
            let error = '<div>Welcome to the PriceEdge Chrome Extension!</div><div> As you venture onto a product page, this interactive window will provide a comparative display of your pricing position vis-à-vis your competitors.</div>'
            let settingsLink = 'settings/browser-extension?currentTab-columnsSettings=tab-selectorsSettings'
            handlePopupError(error, false, false, 'https://cdn.priceedge.eu/price/images/new/pe-img_report_1.png');
        }

        if (request.action === 'noSelectors') {
            hidePopupElements();
            waitImage.classList.add('hide')
            popupError.classList.remove('hide')
            popupError.textContent = 'Selectors are not set for this domain! ';

            //Add match popup
            chrome.storage.local.get('siteSelectors', function(result){
                let selectors = result['siteSelectors'].filter(i=>window.location.hostname === i.Domain).filter(u=>u.SitePagesType !== "productsListPages");
                let competitorsSelector = selectors.filter(s=>s.cd_Competitor);
                if(competitorsSelector.length){
                    showMatch();
                }else{
                    let settingsLink = 'settings/browser-extension?currentTab-columnsSettings=tab-selectorsSettings'
                    handlePopupError('Selectors are not set for this domain!', true, settingsLink, 'https://cdn.priceedge.eu/price/images/new/pe-img_report_1.png');

                }
            })
        }
        
        if(request.action === 'searchItemData'){
            waitImageSearch.classList.add('hide')
            if(request.data){
                setItemsDropdown(request.data)
            }
        }

        if(request.settingsStatus === 'refreshed'){
            showInfoBox('Extension settings were successfully refreshed!');
        }

        if(request.action === 'setMatchPopupIcon'){
            setMatchPopupIcon(request.matchingDomains)
        }
    }
);

async function showMatch() {
    const tabs2 = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    showMatchPopup(tabs2);
}

let showInfoBox = (message) => {
    let infoBox = document.querySelector('#infoBox')
    infoBox.innerHTML = DOMPurify.sanitize(`<div>${message}</div>`);
    infoBox.classList.add('slide-up');
    infoBox.classList.remove('hide');
    setTimeout(()=>{
        infoBox.classList.add('hide');
    }, 3000)
}

let closeNoSettingAlert = document.querySelector('.close-icon');
closeNoSettingAlert.addEventListener('click', () => {
    closeNoSettingAlert.closest('.alert-box').classList.add('hide')
})

let showPriceBuildup = document.querySelector('#showPriceBuildup');
showPriceBuildup.addEventListener('click', () => {
    if (buildupData.length) {
        if(buildupTableBox.classList.contains('hide')){
            buildupTableCreate(buildupData);
        }else{
            buildupTableBox.classList.add('hide')
        }            
    }
    buildupTableBox.classList.add('show-popup')
})

let refreshExtensionSettings = document.querySelector('#refreshExtensionSettings');
refreshExtensionSettings.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "refreshExtensionSettings" });
})

let processSlotValue = (value) => {
    var a;
  
    if (typeof value === 'undefined') {
      a = false;
    } else if (typeof value === 'number') {
      a = String(value);
    } else if (typeof value === 'string') {
      a = value;
    }
  
    return a;
  }

let showPePopup = (data) => {
    console.log('Show popup..... data', data);

    // Retrieve data from local storage

    chrome.storage.local.get(['pricelists'], (result) => {
        if (result.pricelists) {
            console.log('Pricelists retrieved.......:', result.pricelists);
            createDropdown(result.pricelists)
        } else {
            console.log('No pricelists found......');
            chrome.runtime.sendMessage({ action: "getPricelists" });
        }
    });

    let itemPrice = data.Price;
    let itemTotalPrice = data.TotalPrice;
    if (!itemPrice || !itemTotalPrice) {
        noSettingsError.classList.remove('hide');

    }
    let InternalItemNumber = data.InternalItemNumber;
    let CompetitorsPrices = data.CompetitorsPrices !== '' ? JSON.parse(data.CompetitorsPrices) : [];

    let PriceListCode = data.PriceListCode;

    let Slot1 = processSlotValue(data.Slot1);
    let Slot2 = processSlotValue(data.Slot2);
    let Slot3 = processSlotValue(data.Slot3);

    CompetitorsPrices = CompetitorsPrices.map(c => {
        c.Diff = (itemPrice && c.Price) ? (itemPrice - c.Price) * 100 / c.Price : null;
        c.DiffTotal = (itemTotalPrice && c.Total) ? (itemTotalPrice - c.Total) * 100 / c.Total : null
        return c;
    })
    document.querySelector('#itemName').textContent = data.Item_Name;
    document.querySelector('#itemPrice').textContent = itemPrice ? parseFloat(itemPrice).toFixed(2) : ''
    document.querySelector('#totalPrice').textContent = itemTotalPrice ? parseFloat(itemTotalPrice).toFixed(2) : '';
    if (Slot1) {
        document.querySelector('#slot1box').classList.remove('hide');
        document.querySelector('#slot1boxTitle').textContent = data.Slot1_Label;
        document.querySelector('#slot1boxValue').textContent = Slot1;
    }
    if (Slot2) {
        // document.querySelector('#slot2box').classList.remove('hide');
        document.querySelector('#slot2boxTitle').textContent = data.Slot2_Label;
        document.querySelector('#slot2boxValue').textContent = Slot2;
    } else {
        document.querySelector('#slot2boxTitle').textContent = 'Internal Item Number';
        document.querySelector('#slot2boxValue').textContent = data.InternalItemNumber;
    }
    if (Slot3) {
        // document.querySelector('#slot1box').classList.remove('hide');
        document.querySelector('#slot3boxTitle').textContent = data.Slot3_Label;;
        document.querySelector('#slot3boxValue').textContent = Slot3;
    } else {
        document.querySelector('#slot1box').classList.remove('hide');
        document.querySelector('#slot3boxTitle').textContent = 'Pricelist';
        document.querySelector('#slot3boxValue').textContent = data.PriceListCode;
    }

    chrome.storage.local.get(['slotsColumnsInfo'], (result) => {
        let slotsColumnsInfo = result?.slotsColumnsInfo;
        if(slotsColumnsInfo){
            slotsColumnsInfo.filter(s=>s.labelValue).forEach(s => {
                let labelSelector = '';
                if(s.fieldName === "TotalPrice"){
                    labelSelector = document.querySelector('#totalPriceBox .h-1');               
                }else if(s.fieldName === "Price"){
                    labelSelector = document.querySelector('#priceBox .h-1');               
                }else if( s.fieldName === "Slot1"){
                    labelSelector = document.querySelector('#slot1box .h-1');               
                }else if( s.fieldName === "Slot2"){
                    labelSelector = document.querySelector('#slot2box .h-1');               
                }else if( s.fieldName === "Slot3"){
                    labelSelector = document.querySelector('#slot3box .h-1');               
                }
                labelSelector.textContent = s.labelValue;
            })
        }
    })

    chrome.storage.local.get(['domain'], function (result) {
        document.querySelector('#showGraph').setAttribute('href', `https://${result.domain}.priceedge.eu/v2/PriceObjects/items/${InternalItemNumber}`);
        document.querySelector('#noSettingsError a').setAttribute('href', `https://${result.domain}.priceedge.eu/v2/settings/browser-extension`)
    })

    if (data.CompetitorPrices !== '') {
        noMatchBox.classList.add('hide');
        tableCreate(CompetitorsPrices);
    } else {
        gridDiv.classList.add('hide')
        noMatchBox.classList.remove('hide');
    }

    if (data.BuildupData) {
        if (data.BuildupData !== null) {
            showPriceBuildup.classList.remove('hide');
            buildupData = JSON.parse(data.BuildupData);
        }
    }
    pePopup.classList.remove('hide');
}

let buildupTableCreate = (data) => {
    let pricelist = data[0].cd_PriceList;
    let itemNumber = data[0].cd_ItemNumber;
    let createdDate = data[0].CreatedDate;

    let revData = data.map(({ cd_PEPESystemModules: priceModule, OutputValue: outputValue, InputValue: inputValue, Details: details }) => {
        let module = priceModule
        let info = priceModule
        let percentageChange;

        if (inputValue && outputValue)
            percentageChange = (((outputValue - inputValue) / inputValue) * 100).toFixed(2).toString() + '%'

        if (priceModule === 'custom' && details !== null && typeof details !== 'object' && typeof details === 'string') {
            module = details
            info = 'Created by Custom Step'
        }

        if (details !== null && isJson(details)) {
            let jsonDetails = JSON.parse(details)[0]
            module = jsonDetails.ModuleName
            delete jsonDetails.ModuleName
            info = beautifyJsonString(JSON.stringify(jsonDetails))
        }

        return {
            cd_PEPESystemModules: module,
            OutputValue: { value: outputValue ? outputValue.toFixed(2) : null, tooltipContent: info },
            BackgroundColor: '#40cfbc',
            PercentageChange: percentageChange
        }
    })

    let maxOutput, minOutput;
    let outputArr = data.map(({ OutputValue }) => OutputValue);

    maxOutput = outputArr.reduce((a, b) => Math.max(a, b))
    minOutput = outputArr.reduce((a, b) => Math.min(a, b))

    data = revData;

    let gridCols = [
        {
            headerName: "Pricing Step",
            field: "cd_PEPESystemModules",
            maxWidth: 400,
            minWidth: 200,
            cellClass: 'full-width-content module-buildup',
            headerClass: 'module-buildup',
        },
        {
            headerName: "Price",
            field: "OutputValue",
            // width: 500,
            cellClass: 'full-width-content price-buildup',
            headerClass: 'price-buildup',
            cellRenderer: CellBarRendererclass, //renderer for buildup bar
            cellRendererParams: {
                maxValue: maxOutput,
                minValue: minOutput,
                getValue: (value) => value.value,
            },
            tooltipField: 'OutputValue',
        },
        {
            headerName: "Change",
            field: "PercentageChange",
            width: 100,
            minWidth: 100,
            maxWidth: 200,
            cellClass: 'full-width-content percentage-buildup',
            cellStyle: { 'text-align': "center" },
            headerClass: '',
            cellRenderer: CellArrowRenderer,
        }
    ]

    var gridOptions = {
        defaultColDef: {
            sortable: true,
            tooltipComponent: CustomTooltip,
        },
        tooltipShowDelay: 0,
        tooltipHideDelay: 20000,
        columnDefs: gridCols,
        rowData: data,
        domLayout: 'autoHeight',
        onFirstDataRendered: function (params) {
            params.api.sizeColumnsToFit();
        },

        headerHeight: 40,
        rowHeight: 32,
        animateRows: true
    };

    buildupTableBox.classList.remove('hide');
    buildupTableBox.querySelector('.header-box').innerHTML = DOMPurify.sanitize(`<div><span>ItemNumber:</span><span>${itemNumber}</span></div><div><span>Pricelist:</span><span>${pricelist}</span></div><div><span>Calculated at::</span><span>${formatDate(createdDate)}</span></div>`);


    let buildupTable = document.querySelector('#buildupTable');
    buildupTable.innerHTML = '';
    new agGrid.Grid(buildupTable, gridOptions);
    setTimeout(()=>{
        pePopupWraper.scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
    }, 100)
}

let errorOnLogin = document.querySelector('#errorLabel');

let showLoginForm = () => {
    waitImageLogin.classList.add('hide');
    waitImage.classList.add('hide');
    extensionReadyBox.classList.add('hide');
    loginBtn.classList.remove('hide');
    loginBtn.classList.add('disabled');
    loginBtnRow.classList.remove('hide');
    loginForm.classList.remove('hide');
}

let tableCreate = (competitorsData) => {

    var columnDefs = [
        {
            headerName: "COMPETITOR", field: "CompetitorName", resizable: true,
            cellRenderer: function (params) {
                if (typeof params.data.Url !== 'undefined') {
                    var value = params.value.charAt(0).toUpperCase() + params.value.substring(1);
                    var competitorName = value
                    var info = ''
                    if (competitorName.includes('(')) {
                        var competitorName = value.split('(')[0]
                        if (competitorName.includes('_')) {
                            competitorName = competitorName.replace('_', ' ')
                        }
                        var info = '(' + value.split('(')[1]
                    }
                    return '<span><a target="_blank" href="' + params.data.Url + '" tooltip="' + value + '"' + '>' + competitorName + '</a><span class="default-color">' + info + '</span></span>';
                } else {
                    return '<span class="default-color">' + params.value + '</span>';
                }
            },
            width: 180, suppressSizeToFit: true, headerTooltip: 'Competitor', tooltipValueGetter: (params) => params.value
        },
        {
            headerName: "PRICE", field: "Price", sortable: true,
            valueFormatter: function (params) {
                return params.value.toFixed(2);
            },
            headerTooltip: 'Price', width: 85, suppressSizeToFit: true, tooltipValueGetter: (params) => params.value
        },
        {
            headerName: "DIFF", field: "Diff", sortable: true,
            cellStyle: function (params) {
                if (params.value < 0) {
                    return { color: '#0091ae' };
                } else {
                    return { color: '#e7556a' };
                }
            },
            valueFormatter: function (params) {
                let sign = ' '
                if (params.value && params.value > 0) { sign = '+' };
                if (params.value || params.value === 0)
                    return sign + params.value.toFixed(2) + '%';
                else {
                    return ''
                }
            },
            headerTooltip: 'Diff', width: 78, suppressSizeToFit: true, tooltipValueGetter: (params) => { params.value ? params.value.toFixed(2) + '%' : '' }
        },
        {
            headerName: "Shipping Cost", field: "Shipping", sortable: true,
            valueFormatter: function (params) {
                return (typeof params.value !== 'undefined') ? params.value.toFixed(2) : null;

            },
            headerTooltip: 'Shipping Cost', width: 80, suppressSizeToFit: true, sortable: true, tooltipValueGetter: (params) => params.value
        },
        {
            headerName: "TOTAL", field: "Total", sortable: true,
            valueFormatter: function (params) {
                return params.value.toFixed(2);
            },
            headerTooltip: 'Total', width: 85, suppressSizeToFit: true, tooltipValueGetter: (params) => params.value
        },
        {
            headerName: "DIFF TOTAL", field: "DiffTotal", sortable: true,
            cellStyle: function (params) {
                if (params.value < 0) {
                    return { color: '#0091ae' };
                } else {
                    return { color: '#e7556a' };
                }
            },
            valueFormatter: function (params) {
                let sign = ''
                if (params.value > 0) { sign = '+' }
                if (params.value || params.value === 0)
                    return sign + params.value.toFixed(2) + '%';
                else {
                    return '';
                }
            },
            headerTooltip: 'Diff Total', width: 80, suppressSizeToFit: true, tooltipValueGetter: (params) => { params.value ? params.value.toFixed(2) + '%' : '' }
        },
        {
            headerName: "Availability", field: "Available",
            cellRenderer: function (params) {
                if (params.value == 1) {
                    return '<span class="icon-oks">&#10003;</span>'
                } else if (params.value == 0) {
                    return '<span class="icon-cross">&#xd7;</span>'
                } else {
                    return '<span></span>'
                }
            },
            headerTooltip: 'Availability', tooltipValueGetter: (params) => params.value
        }
    ];

    if (competitorsData.length < 1) {
        document.querySelector('#noMatchBox').classList.remove('hide');
    } else {
        const priceAvg = competitorsData.filter(c => c.Price).reduce((a, { Price }) => a + Price, 0) / competitorsData.length;
        const diffAvg = competitorsData.filter(c => c.Diff).reduce((a, { Diff }) => a + Diff, 0) / competitorsData.length;
        const shippingAvg = competitorsData.filter(i => typeof i.Shipping !== 'undefined').map(i => i.Shipping).reduce(function (avg, value, _, { length }) {
            return avg + value / length;
        }, 0);
        const totalAvg = competitorsData.filter(c => c.Total).reduce((a, { Total }) => a + Total, 0) / competitorsData.length;
        const diffTotalAvg = competitorsData.filter(c => c.DiffTotal).reduce((a, { DiffTotal }) => a + DiffTotal, 0) / competitorsData.length;

        //Load the table

        var gridOptions = {
            defaultColDef: {
                sortable: true,
            },
            columnDefs: columnDefs,
            rowData: competitorsData,
            domLayout: 'autoHeight',
            onFirstDataRendered: function (params) {
                params.api.sizeColumnsToFit();
            },
            pinnedBottomRowData: [
                {
                    CompetitorName: "Avg. Price",
                    Price: priceAvg,
                    Diff: diffAvg,
                    Shipping: shippingAvg,
                    Total: totalAvg,
                    DiffTotal: diffTotalAvg,
                    Available: 2,
                    Url: "",
                }
            ],
            headerHeight: 40,
            rowHeight: 32,
            animateRows: true
        };
        gridDiv.innerHTML = '';
        new agGrid.Grid(gridDiv, gridOptions);
    }
}

// Logout 
logOut.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "logOut" });
})


//Matching popup


async function showMatchPopup(tabs){
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getPageUrl" }, (response)=>{
            let href = response.location.href;
            matchUrl.textContent = href;
        })
    })
    
    pePopupWraper.style.width = '520px'
    hidePopupElements();
    document.getElementById('matchPopup').classList.remove('hide');
    hideTopIcons();
    popupError.classList.add('hide');
    popupError.classList.add('hidethis');
    validateMatchPopup();
}

function hideTopIcons  (){
    try {
        matchIcon.classList.add('hide-all');
    } catch (error) {};
    refreshExtensionSettings.classList.add('hide-all');
    logOut.classList.add('hide-all');  
}

//########################################################################
//##########################    Dropdown     #############################

let searchDropdown = document.getElementById('searchDropdown');
let searchItem = document.getElementById('searchItem');

let itemNumberBox = document.getElementById('itemNumberBox');
itemNumberBox.addEventListener('click', (e) => {
    searchDropdown.classList.remove('hide');
    searchItem.focus();
})

matchUrl.addEventListener('input', ()=>{
    validateMatchPopup();
})

let waitImageSearch = document.getElementById('waitImageSearch');
let timeout = null;

searchItem.addEventListener('input', (e) => {
    let val = e.target.value;
    if(val.length){
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            waitImageSearch.classList.remove('hide');
            chrome.runtime.sendMessage( {action: "searchItem", patern: val});   
        }, 400);
    }else{
        resetSearchDropdown();
    } 
})

let resetSearchDropdown = () => {
    searchDropdownContent.innerHTML = '';
    peNoResultsLi.classList.remove('hide')
}

var editItemNumber = document.getElementById('editItemNumber')
editItemNumber.addEventListener('click', (event)=>{
    itemNumberBox.focus();
});

itemNumberBox.addEventListener('input', ()=>{
    itemNumberBox.setAttribute("data-itemNumber", itemNumberBox.textContent);
    validateMatchPopup();
})

//Hide dropdown on click outside
document.addEventListener('click', function handleClickOutsideBox(event) {  
    if (!searchDropdown.contains(event.target) && !itemNumberBox.contains(event.target) && !searchDropdown.classList.contains('hide')) {
        searchDropdown.classList.add('hide');
    }
});

saveMatch.addEventListener('click', function saveManualMatch(event) {
    let url = matchUrl.textContent;
    let itemNumber = itemNumberBox.getAttribute("data-itemNumber")

    // For saving match its needed to know cd_DataSource and page url
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getPageUrl" }, (response)=>{
            pageUrl = response.pageUrl;

            chrome.storage.local.get(["matchingDomains"], function (result) {
                if(result.matchingDomains.filter(md => md.Domain === pageUrl.replace('https://', '').replace('www.', '')).length){
                    var cd_DataSource = result.matchingDomains.filter(md => md.Domain === pageUrl.replace('https://', '').replace('www.', ''))[0].cd_DataSource;
                    chrome.runtime.sendMessage({ action: "saveMatch", params: {
                        url,
                        itemNumber,
                        cd_DataSource
                    }});

                }
            })
        });
    })
}) 

let validateMatchPopup = () => {
    let validation = (itemNumberBox.getAttribute("data-itemNumber").length && matchUrl.textContent.length)? true: false;
    if(validation === false){
        saveMatch.classList.add('disabled')
    }else{
        saveMatch.classList.remove('disabled')
    }
}


let peNoResultsLi = document.getElementById('peNoResultsLi')
let searchDropdownContent = document.getElementById('searchDropdownContent');
let setItemsDropdown = (data) => {
    searchDropdownContent.innerHTML = '';
    if(data.length){
        peNoResultsLi.classList.add('hide')
        data.forEach(i=>{
            let el = document.createElement('div');
            el.classList.add('pe-dropdown-item');
            el.addEventListener('click', function handleClick(event) {
                itemNumberBox.textContent = i.Key;
                itemNumberBox.setAttribute("data-itemNumber", i.Key);
                searchDropdown.classList.add('hide');
                validateMatchPopup()
            });
            el.textContent = i.Key + ' - ' + i.Title;
            searchDropdownContent.appendChild(el);
        })
    }else{
        searchDropdownContent.innerHTML = '';
    }
}

//#########################################################################

async function setMatchPopupIcon (matchingDomains, tabs){
    if(matchingDomains?.length){
        var {Domain, cd_DataSource} = matchingDomains[0];
        const el = document.createElement('div');
        el.addEventListener('click', function handleClick(event) {
            showMatchPopup(tabs);
        });
        el.id = 'matchIcon'
        el.title = 'Match popup';
        el.classList.remove('hide-all')
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="rgb(66, 91, 118)" width="22px" height="22px" viewBox="0 -3 20 20"><path d="M7,14 C3.13400675,14 0,10.8659932 0,7 C0,3.13400675 3.13400675,0 7,0 C8.07359729,0 9.09074462,0.241691045 10,0.673631164 C10.9092554,0.241691046 11.9264027,0 13,0 C16.8659932,0 20,3.13400675 20,7 C20,10.8659932 16.8659932,14 13,14 C11.9264027,14 10.9092554,13.758309 10,13.3263688 C9.09074462,13.758309 8.07359729,14 7,14 Z M7,2 C4.23857625,2 2,4.23857625 2,7 C2,9.76142375 4.23857625,12 7,12 C7.34275439,12 7.6774536,11.9655117 8.0008167,11.899816 C6.76314869,10.6372065 6,8.90772473 6,7 C6,5.09227527 6.76314869,3.36279347 8.0008167,2.10018397 C7.6774536,2.0344883 7.34275439,2 7,2 Z M14.0008167,7 C14.0008167,8.90772473 13.237668,10.6372065 12,11.899816 C12.3233631,11.9655117 12.6580623,12 13.0008167,12 C15.7622404,12 18.0008167,9.76142375 18.0008167,7 C18.0008167,4.23857625 15.7622404,2 13.0008167,2 C12.6580623,2 12.3233631,2.0344883 12,2.10018397 C13.237668,3.36279347 14.0008167,5.09227527 14.0008167,7 Z"/></svg>`;
        pePopupWraper.appendChild(el);
    }
};

//Helpers

function formatDate(d) {
    date = new Date(d)
    var hours = date.getHours();
    var minutes = date.getMinutes();
    // var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutes + ' ';
    return date.getFullYear() + '.' + (date.getMonth() + 1) + "." + date.getDate() + " " + strTime;
}

function beautifyJsonString(str) {
    return str.replace('{', '').replace('}', '').replaceAll('"', '').replaceAll(',', ', ').replaceAll(':', ': ')
}

function isJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

class CellBarRendererclass {
    init(params) {
        let wMax = 1
        let wMin = 0.61;
        let k = (wMax - wMin) / (params.maxValue - params.minValue)
        let m = wMin - (k * params.minValue)
        const widthValue = (((k * this.getValueToDisplay(params)) + m) * 100).toFixed(2) + "%"
        this.eGui = document.createElement('div');
        this.eGui.classList.add('cell-bar-render');
        this.eGui.innerHTML = `
              <span class="cell-value"></span>
              <span class="proggress-bar" style='width: ${widthValue}'></span>
       `;
        this.eValue = this.eGui.querySelector('.cell-value');
        this.cellValue = this.getValueToDisplay(params);
        this.eValue.innerHTML = this.cellValue;

    }

    getGui() { return this.eGui; }

    getValueToDisplay(params) {
        return params.valueFormatted ? params.valueFormatted : params.value.value;
    }
}

class CellArrowRenderer {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.innerHTML = `<span class='percentage-value'>${this.getValueToDisplay(params)}</span>`;
        this.cellValue = this.getValueToDisplay(params);
    }

    getGui() { return this.eGui; }
    getValueToDisplay(params) {
        return params.valueFormatted ? params.valueFormatted : typeof (params.value) !== 'undefined' ? params.value : '';
    }
}

class CustomTooltip {
    init(params) {
        const eGui = (this.eGui = document.createElement('div'));
        const data = params.api.getDisplayedRowAtIndex(params.rowIndex).data;
        eGui.classList.add('grid-tooltip');
        eGui.innerHTML = `<span>${data.OutputValue.tooltipContent}</span>`;
    }

    getGui() {
        return this.eGui;
    }
}

function createDropdown(items) {
    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown';

    // Create dropdown button
    const dropdownButton = document.createElement('div');
    dropdownButton.className = 'dropdown-button';
    dropdownButton.textContent = 'Select a pricelist';

    dropdown.appendChild(dropdownButton);

    // Create dropdown menu
    const dropdownMenu = document.createElement('ul');
    dropdownMenu.className = 'dropdown-menu';

    // Add items to the dropdown menu
    items.forEach(item => {
        const menuItem = document.createElement('li');
        menuItem.className = 'dropdown-item';
        menuItem.textContent = item['Name'];
        
        // Add click event for menu items
        menuItem.addEventListener('click', () => {
            dropdownButton.textContent = 'PL: ' + item['Name']; 
            dropdownButton.setAttribute('data-pl-code', item['Code']); // Adding an attribute
            dropdownMenu.classList.remove('show'); // Close dropdown
            chrome.storage.local.set({ dataPricelist: item['Code'] }, () => {
                console.log('Pricelists saved to local storage. Refresh the data using pricelist selected.......');
            });
        });

        dropdownMenu.appendChild(menuItem);
    });

    dropdown.appendChild(dropdownMenu);

    // Toggle dropdown visibility on button click
    dropdownButton.addEventListener('click', () => {
        dropdownMenu.classList.toggle('show');
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', (event) => {
        if (!dropdown.contains(event.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // Append dropdown to body
    document.querySelector('#plDropdown').appendChild(dropdown);
}

