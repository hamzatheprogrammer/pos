const usersTableBody = document.getElementById('usersTableBody');
const addUserButton = document.getElementById('addUserButton');
const userModal = document.getElementById('userModal');
const userModalBackdrop = document.getElementById('userModalBackdrop');
const closeUserModal = document.getElementById('closeUserModal');
const cancelUserForm = document.getElementById('cancelUserForm');
const userForm = document.getElementById('userForm');
const userFormMode = document.getElementById('userFormMode');
const userModalTitle = document.getElementById('userModalTitle');
const passwordInput = document.getElementById('password');
const formMessage = document.getElementById('formMessage');
const userSearch = document.getElementById('userSearch');

let users = [];

function openUserModal(user = null) {
    userForm.reset();
    formMessage.textContent = '';
    document.getElementById('userId').value = user?._id || '';
    document.getElementById('username').value = user?.username || '';
    document.getElementById('email').value = user?.email || '';
    document.getElementById('role').value = user?.role || 'user';

    const isEditing = Boolean(user);
    userFormMode.textContent = isEditing ? 'Edit account' : 'New account';
    userModalTitle.textContent = isEditing ? 'Edit User' : 'Add User';
    passwordInput.required = !isEditing;

    userModal.classList.add('is-open');
    userModalBackdrop.classList.add('is-open');
    userModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
    userModal.classList.remove('is-open');
    userModalBackdrop.classList.remove('is-open');
    userModal.setAttribute('aria-hidden', 'true');
}

function renderUsers(list = users) {
    if (!list.length) {
        usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found.</td></tr>';
        return;
    }

    usersTableBody.innerHTML = list.map((user, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${user.username}</td>
            <td>${user.email || '-'}</td>
            <td><span class="role-pill">${user.role || 'user'}</span></td>
            <td>
                <div class="table-actions">
                    <button class="table-btn edit-btn" type="button" data-id="${user._id}">Edit</button>
                    <button class="table-btn delete-btn" type="button" data-id="${user._id}">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadUsers() {
    usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Loading users...</td></tr>';

    try {
        const response = await fetch('/api/users');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to load users');
        }

        users = data;
        renderUsers();
    } catch (error) {
        usersTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">${error.message}</td></tr>`;
    }
}

async function saveUser(event) {
    event.preventDefault();
    formMessage.textContent = '';

    const id = document.getElementById('userId').value;
    const payload = {
        username: document.getElementById('username').value.trim(),
        email: document.getElementById('email').value.trim(),
        role: document.getElementById('role').value,
        password: passwordInput.value
    };

    if (id && !payload.password) {
        delete payload.password;
    }

    try {
        const response = await fetch(id ? `/api/users/${id}` : '/api/users', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to save user');
        }

        closeModal();
        await loadUsers();
    } catch (error) {
        formMessage.textContent = error.message;
    }
}

async function deleteUser(id) {
    const user = users.find((item) => item._id === id);
    const userName = user?.username || 'this user';

    if (!confirm(`Delete ${userName}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || 'Unable to delete user');
        }

        await loadUsers();
    } catch (error) {
        alert(error.message);
    }
}

addUserButton.addEventListener('click', () => openUserModal());
closeUserModal.addEventListener('click', closeModal);
cancelUserForm.addEventListener('click', closeModal);
userModalBackdrop.addEventListener('click', closeModal);
userForm.addEventListener('submit', saveUser);

usersTableBody.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-btn');
    const deleteButton = event.target.closest('.delete-btn');

    if (editButton) {
        const user = users.find((item) => item._id === editButton.dataset.id);
        openUserModal(user);
    }

    if (deleteButton) {
        deleteUser(deleteButton.dataset.id);
    }
});

userSearch.addEventListener('input', () => {
    const query = userSearch.value.trim().toLowerCase();
    const filteredUsers = users.filter((user) => {
        return [user.username, user.email, user.role].some((value) => {
            return String(value || '').toLowerCase().includes(query);
        });
    });

    renderUsers(filteredUsers);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
});

loadUsers();
