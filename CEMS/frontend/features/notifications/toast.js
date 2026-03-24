// Simple Toast Notification Library
const uiStyles = document.createElement('style');
uiStyles.innerHTML = `
    #toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .toast-message {
        min-width: 250px;
        background-color: #333;
        color: #fff;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: inherit;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .toast-message.show {
        opacity: 1;
        transform: translateY(0);
    }
    .toast-success { background-color: #10B981; }
    .toast-error { background-color: #EF4444; }
    .toast-warning { background-color: #F59E0B; }
    .toast-info { background-color: #3B82F6; }
`;
document.head.appendChild(uiStyles);

const container = document.createElement('div');
container.id = 'toast-container';
document.body.appendChild(container);

window.showToast = (message, type = 'info', duration = 4000) => {
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button style="background:transparent;border:none;color:white;cursor:pointer;font-size:16px;" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    
    // trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
};
