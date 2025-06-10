import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface AuthUser {
  userId: string
  userDetails: string
  identityProvider: string
  userRoles?: string[]
}

const AuthStatus: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class={`auth-status ${displayClass ?? ""}`} id="authStatus">
      <div id="userInfo" class="user-info">
        <p>Loading authentication status...</p>
      </div>
      <div id="authButtons" class="auth-buttons">
        <button id="loginBtn" class="auth-button login-btn" style="display: none;">
          Login with Azure AD
        </button>
        <button id="logoutBtn" class="auth-button logout-btn" style="display: none;">
          Logout
        </button>
      </div>
    </div>
  )
}

AuthStatus.css = `
.auth-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--gray);
  background: var(--light);
  margin: 1rem 0;
}

.auth-status.loading {
  border-color: var(--secondary);
  background: var(--lightgray);
}

.auth-status.authenticated {
  border-color: var(--green);
  background: color-mix(in srgb, var(--green) 10%, var(--light));
}

.auth-status.unauthenticated {
  border-color: var(--orange);
  background: color-mix(in srgb, var(--orange) 10%, var(--light));
}

.user-info {
  text-align: center;
}

.user-info p {
  margin: 0.25rem 0;
}

.auth-buttons {
  display: flex;
  gap: 0.5rem;
}

.auth-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--gray);
  border-radius: 4px;
  background: var(--light);
  color: var(--dark);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.auth-button:hover {
  background: var(--lightgray);
  transform: translateY(-1px);
}

.login-btn {
  border-color: var(--secondary);
  background: var(--secondary);
  color: var(--light);
}

.login-btn:hover {
  background: color-mix(in srgb, var(--secondary) 80%, var(--dark));
}

.logout-btn {
  border-color: var(--red);
  color: var(--red);
}

.logout-btn:hover {
  background: var(--red);
  color: var(--light);
}

.user-details {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--lightgray);
  border-radius: 4px;
  font-size: 0.9rem;
}

.user-details h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.user-details p {
  margin: 0.25rem 0;
}

@media (max-width: 600px) {
  .auth-status {
    padding: 0.75rem;
  }
  
  .auth-buttons {
    flex-direction: column;
    width: 100%;
  }
  
  .auth-button {
    width: 100%;
  }
}
`

AuthStatus.afterDOMLoaded = `
// Authentication management for Azure Static Web Apps
let currentUser = null;
let isAuthenticated = false;

// UI Elements
const userInfo = document.getElementById('userInfo');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authStatus = document.getElementById('authStatus');

// Check authentication status
async function checkAuthStatus() {
  try {
    if (authStatus) {
      authStatus.className = 'auth-status loading';
    }
    if (userInfo) {
      userInfo.innerHTML = '<p>Checking authentication status...</p>';
    }
    
    const response = await fetch('/.auth/me');
    const payload = await response.json();
    const { clientPrincipal } = payload;
    
    if (clientPrincipal) {
      currentUser = clientPrincipal;
      isAuthenticated = true;
      displayAuthenticatedState();
    } else {
      isAuthenticated = false;
      displayUnauthenticatedState();
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    displayUnauthenticatedState();
  }
}

function displayAuthenticatedState() {
  if (authStatus) {
    authStatus.className = 'auth-status authenticated';
  }
  
  if (userInfo) {
    userInfo.innerHTML = \`
      <p><strong>✅ Authenticated</strong></p>
      <p>Welcome, \${currentUser.userDetails || 'User'}!</p>
      <p>Provider: \${currentUser.identityProvider}</p>
    \`;
  }
  
  if (loginBtn) {
    loginBtn.style.display = 'none';
  }
  if (logoutBtn) {
    logoutBtn.style.display = 'inline-block';
  }
}

function displayUnauthenticatedState() {
  if (authStatus) {
    authStatus.className = 'auth-status unauthenticated';
  }
  
  if (userInfo) {
    userInfo.innerHTML = \`
      <p><strong>❌ Not Authenticated</strong></p>
      <p>Please log in to access all features.</p>
    \`;
  }
  
  if (loginBtn) {
    loginBtn.style.display = 'inline-block';
  }
  if (logoutBtn) {
    logoutBtn.style.display = 'none';
  }
}

// Event listeners
if (loginBtn) {
  loginBtn.addEventListener('click', function() {
    window.location.href = '/.auth/login/aad';
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', function() {
    window.location.href = '/.auth/logout';
  });
}

// Initialize authentication check
checkAuthStatus();
`

export default (() => AuthStatus) satisfies QuartzComponentConstructor