// Content script for 42-subject-dashboard Chrome Extension
console.log("42-subject-dashboard injector script initialized.");

let dashboardIframe = null;

function injectDashboardModal() {
  if (dashboardIframe) return; // Already injected

  // Create iframe
  dashboardIframe = document.createElement('iframe');
  dashboardIframe.src = chrome.runtime.getURL('src/content/modal.html');
  dashboardIframe.id = '42gs-dashboard-iframe';
  
  // Style the iframe to cover the entire screen opaquely
  Object.assign(dashboardIframe.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    border: 'none',
    zIndex: '9999',
    display: 'none',
    backgroundColor: 'transparent'
  });

  document.body.appendChild(dashboardIframe);

  // Listen for messages from the iframe (e.g., to close the modal)
  window.addEventListener('message', (event) => {
    // Basic security check: ensure message is from our extension
    if (event.origin !== `chrome-extension://${chrome.runtime.id}`) return;

    if (event.data && event.data.type === 'CLOSE_DASHBOARD') {
      closeDashboard();
    }
  });
}

function openDashboard() {
  if (!dashboardIframe) injectDashboardModal();
  dashboardIframe.style.display = 'block';
  // Prevent scrolling on the original Intra page
  document.body.style.overflow = 'hidden';
}

function closeDashboard() {
  if (dashboardIframe) {
    dashboardIframe.style.display = 'none';
    // Restore scrolling
    document.body.style.overflow = '';
  }
}

// Create a floating trigger button for easy testing
function injectTriggerButton() {
  const btn = document.createElement('button');
  btn.innerText = '📊 42GS Dashboard';
  
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '9998',
    padding: '12px 20px',
    backgroundColor: '#4f8ef7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'background-color 0.2s'
  });

  btn.onmouseover = () => btn.style.backgroundColor = '#6a9cf8';
  btn.onmouseout = () => btn.style.backgroundColor = '#4f8ef7';
  
  btn.addEventListener('click', openDashboard);
  document.body.appendChild(btn);
}

// Initialize
injectDashboardModal();
injectTriggerButton();
