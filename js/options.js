let priceedgeDomain = document.querySelector('#priceedgeDomain');
let setPEDomain = document.querySelector('#setPEDomain');
let setDomainBox = document.querySelector('#setDomainBox');
let loginBox = document.querySelector('#loginBox');
let extensionReadyBox = document.querySelector('#extensionReadyBox');
let errorOnLogin = document.querySelector('#errorLabel');
let showPassword = document.querySelector('#showPassword');
let noDomainsError = document.querySelector('#noDomainsError');
let popupContent = document.querySelector('#popupContent');

setPEDomain.addEventListener("click", handleSetDomainButtonClick);

chrome.storage.local.get(['domain', 'trackedSites'], function(result){
    priceedgeDomain.value = result['domain'] || ''
})

function handleSetDomainButtonClick() {
    if (priceedgeDomain.value.length){
        chrome.storage.local.set({'domain': priceedgeDomain.value}, function(){
            setDomainBox.classList.add('hide')
            loginBox.classList.remove('hide');
            updateSlider('1');
        });
    }
}

setSuccessBox = () => {
    chrome.storage.local.get(['trackedDomains'], function(result){
        let successMessage = document.querySelector('#successMessage');
        updateSettingsUrlButtonsLinks();

        if(result['trackedDomains'].length){
            successMessage.innerHTML = ' You are currently tracking:'
            loginBox.classList.add('hide');
            extensionReadyBox.classList.remove('hide');
            
            result['trackedDomains'].forEach(i=>{
                const node = document.createElement("div");
                node.classList.add( 'tracked-domain');
                var a = document.createElement('a');
                var linkText = document.createTextNode(`${i}`);
                a.appendChild(linkText);
                a.title = `${i}`;
                a.href = `https://${i}`;
                node.appendChild(a);
                successMessage.appendChild(node);
                updateSlider('success')
            });
        }
    })
}

// Listen messages

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log('Options received message: ', request);
        document.querySelector('#waitImageLogin').classList.add('hide');
        
        if(request.action === 'loggedIn'){
            chrome.storage.local.get(['loginActionSource'], (result)=>{
                if(result['loginActionSource'] === 'options');
                    setSuccessBox();
                    chrome.storage.local.set({'loginActionSource': null});
            })
        }

        if( request.action === 'errorOnLogin'){
            errorOnLogin.classList.remove('hide')
            errorMessage = request.errorMessage || 'There was an error in the login process. Please try again, and if it keeps happening, contact support!'
            loginBtnRow.classList.remove('hide')
            loginBtn.classList.remove('hide')
            loginBtn.classList.add('disabled')
            errorOnLogin.innerHTML = DOMPurify.sanitize(`<span class="error-color bold-500 " >Something went wrong</span><span class="error-color font-14">${errorMessage}</span>`);
        } 

        if( request.action === 'areColumnSettingsSet'){
            chrome.storage.local.get(['trackedDomains'], (result)=>{
                if(typeof(result['trackedDomains']) !== 'undefined')
                    updateSlider('success')
            });
        }

        if(request.action === 'noDomainsSet'){
            updateSettingsUrlButtonsLinks();
            updateSlider('noDomainsSet')
        }
    }
);

let updateSettingsUrlButtonsLinks = () => {
    chrome.storage.local.get(['domain'], (result)=>{
        if(result.domain){
            let settingsURL = `https://${result['domain']}.priceedge.eu/v2/settings/browser-extension`;
            document.querySelector('#settingsURL').setAttribute('href', settingsURL)
            document.querySelector('#setColumnsLink').setAttribute('href', settingsURL);
            
            document.querySelector('#settingsDomainsURL').setAttribute('href', settingsURL + '?currentTab-columnsSettings=tab-selectorsSettings');
        }
     
    })
}
updateSettingsUrlButtonsLinks();

// Slider

let dots = document.querySelectorAll('div.slider-item .slider-dot');

dots.forEach(el => el.addEventListener('click', e => {
    let step = e.target.getAttribute('data-step');
    updateSlider(step) ;
}));

let progressSlider = document.querySelectorAll('#progressSlider > div .slider-item');
let updateSlider = (step) => {
    if(step === '0'){
        setDomainBox.classList.remove('hide');
        loginBox.classList.add('hide');
        loginBtnRow.classList.add('hide')
        extensionReadyBox.classList.add('hide');
    }else if(step === 'success'){
        step = 1;
        setDomainBox.classList.add('hide');
        loginBox.classList.add('hide');
        loginBtnRow.classList.add('hide')
        extensionReadyBox.classList.remove('hide');
    }else if(step === 'noDomainsSet'){
        step = 1;
        document.querySelectorAll('.popup-item').forEach((el) => {
            el.classList.add('hide');
        });
        
        noDomainsError.classList.remove('hide')

    }else{
        setDomainBox.classList.add('hide');
        loginBox.classList.remove('hide');
        loginBtnRow.classList.remove('hide')
        extensionReadyBox.classList.add('hide');
    }

    chrome.storage.local.get(['domain', 'siteSelectors', 'areColumnSettingsSet'], (result)=>{
        let sliderSteps = {
            0: Boolean(result['domain']), 1: Boolean(result['siteSelectors']), 2: result['areColumnSettingsSet'] || false, 
        }
        for (var s = 0; s < progressSlider.length; s++){
            progressSlider[s].classList.remove('checked', 'current');
            if(sliderSteps[s])
                progressSlider[s].classList.add('checked' )
        }
        progressSlider[step].classList.add('current');

    })
}

updateSlider('0');