
// ############## Login 

let popupState = {
    userName: '',
    userPassword: ''
}

let loginBtn = document.querySelector('#loginBtn');
let loginBtnRow = document.querySelector('#loginBtnRow');
let waitImageLogin = document.querySelector('#waitImageLogin')
let userName = document.querySelector('#user_name')
userName.addEventListener('input', onNameChanged)
let userPassword = document.querySelector('#user_password')
userPassword.addEventListener('input', onPswChanged)


function onNameChanged() {
    popupState.userName = this.value;
    validateForm();
}
function onPswChanged() {
    popupState.userPassword = this.value;
    validateForm();
}

let validateForm = () => {
    if (popupState.userName && popupState.userPassword) {
        loginBtn.classList.remove('disabled')
    } else {
        loginBtn.classList.add('disabled')
    }
}

loginBtn.addEventListener('click', (e) => {
    loginBtnRow.classList.add('hide');
    waitImageLogin.classList.remove('hide');
    let loginActionSource = e.target.getAttribute("data-action-source");
    chrome.storage.local.set({'loginActionSource': loginActionSource}, ()=>{
        chrome.runtime.sendMessage({ action: "doLogin", credentials: { userName: popupState.userName, password: popupState.userPassword } });
    })
})


showPassword.addEventListener('click', (e)=>{
    if(e.target.innerHTML === 'Show Password'){
        userPassword.setAttribute("type", "text");
        e.target.innerHTML = 'Hide Password'
    }else{
        userPassword.setAttribute("type", "password");
        e.target.innerHTML = 'Show Password'
    };
});


