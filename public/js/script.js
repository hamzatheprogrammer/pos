const alertBox = document.getElementById('timedAlert');
const alertTitle = document.getElementById('alertTitle');
const alertMessage = document.getElementById('alertMessage');
const progressBar = document.getElementById('alertProgressBar');
const closeAlertButton = document.getElementById('closeAlert');

let alertTimer;
let removeShowTimer;

function hideAlert() {
    clearTimeout(alertTimer);
    clearTimeout(removeShowTimer);

    alertBox.classList.remove('show');

    removeShowTimer = setTimeout(() => {
        alertBox.classList.add('d-none');
    }, 300);
}

function showTimedAlert(title, message, type = 'primary') {
    clearTimeout(alertTimer);
    clearTimeout(removeShowTimer);

    alertTitle.textContent = title;
    alertMessage.textContent = message;

    alertBox.className = `alert alert-${type} alert-dismissible fade p-0 overflow-hidden`;
    progressBar.style.transition = 'none';
    progressBar.style.width = '100%';

    requestAnimationFrame(() => {
        alertBox.classList.add('show');
        progressBar.style.transition = 'width 5s linear';
        progressBar.style.width = '0%';
    });

    alertTimer = setTimeout(hideAlert, 5000);
}

closeAlertButton.addEventListener('click', hideAlert);

document.getElementById("login-form").addEventListener("submit", function (event) {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    fetch('/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
        .then(async (response) => {
            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                showTimedAlert('Success!', data.message || 'Logged in successfully.', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
                return;
                
            }

            showTimedAlert('Login failed', data.message || 'Invalid username or password.', 'danger');
        })
        .catch((error) => {
            console.error('Error:', error);
            showTimedAlert('Error', 'Unable to connect to the server.', 'danger');
        });
});
