const sidebar = document.getElementById('dashboardSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle('is-open', isOpen);
    sidebarBackdrop.classList.toggle('is-open', isOpen);
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    sidebarToggle.setAttribute('aria-label', isOpen ? 'Close sidebar' : 'Open sidebar');
}

sidebarToggle.addEventListener('click', () => {
    setSidebarOpen(!sidebar.classList.contains('is-open'));
});

sidebarClose.addEventListener('click', () => {
    setSidebarOpen(false);
});

sidebarBackdrop.addEventListener('click', () => {
    setSidebarOpen(false);
});

sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
        setSidebarOpen(false);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        setSidebarOpen(false);
    }
});

async function DisplayuserRole() {

        try {
            const response = await fetch('/api/role');
            const data  = await response.json();

            document.getElementById('RoleDisplay').textContent = `${data.role} `



        } catch (error) {
            console.error('Error fetching user role:', error);
        }


};

DisplayuserRole();

async function hideLinksBasedOnRole() {
    try{
        const response = await fetch('/api/role');
        const data  = await response.json();

        DisplayuserRole().data

        if (data.role !== 'admin' && data.role !== 'manager') {
            document.getElementById('userLink').style.display = 'none';
            document.getElementById('InventoryLink').style.display = 'none';
            document.getElementById('AddItemLink').style.display = 'none';
            document.getElementById('ReportsLink').style.display = 'none';
            
        }


    }
    catch(error){
        console.error('Error fetching user role:', error);
    }
    
}

hideLinksBasedOnRole();

async function newsaleButton() {
    const newSaleButton = document.getElementById('newSaleButton');

    if (!newSaleButton) {
        return;
    }

    newSaleButton.addEventListener('click',() => {
        window.location.href = '/sale';
    })
}

newsaleButton();
