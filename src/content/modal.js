document.addEventListener('DOMContentLoaded', () => {
  console.log('[Dashboard Modal] Loaded');

  // ─── State ────────────────────────────────────────────────────────────────
  let activeTab = 'all';         // 'all' | 'starred'
  let searchQuery = '';          // live search query
  let sortKey = 'level';         // 'login' | 'level' | 'bh'
  let sortDir = -1;              // -1 = desc, 1 = asc
  let storageBackend = 'chrome'; // 'chrome' | 'local'

  // ─── Close Button ─────────────────────────────────────────────────────────
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      parent.postMessage({ type: "CLOSE_DASHBOARD" }, "*");
    });
  }

  // Column Hover Highlight Logic
  const table = document.querySelector('.dashboard-table');
  if (table) {
    // Add event listeners to all cells to highlight the entire column
    table.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('td, th');
      if (!cell) return;

      const colIndex = cell.getAttribute('data-col');
      if (colIndex === null || colIndex < 1) return; // Skip sticky Login column (0)

      // Highlight all cells in this column
      const cellsInCol = table.querySelectorAll(`[data-col="${colIndex}"]`);
      cellsInCol.forEach(c => c.classList.add('col-hover'));
    });

    table.addEventListener('mouseout', (e) => {
      const cell = e.target.closest('td, th');
      if (!cell) return;

      const colIndex = cell.getAttribute('data-col');
      if (colIndex === null || colIndex < 1) return;

      // Remove highlight from all cells in this column
      const cellsInCol = table.querySelectorAll(`[data-col="${colIndex}"]`);
      cellsInCol.forEach(c => c.classList.remove('col-hover'));
    });
  }

  // Profile Tooltip Hover Card Logic
  const tooltip = document.getElementById('profile-tooltip');
  const tooltipAvatar = document.getElementById('tooltip-avatar');
  const tooltipLogin = document.getElementById('tooltip-login');
  const tooltipCohort = document.getElementById('tooltip-cohort');
  const tooltipLevel = document.getElementById('tooltip-level');
  const tooltipBh = document.getElementById('tooltip-bh');

  // Project Info Tooltip element references
  const projTooltip = document.getElementById('project-tooltip');
  const projTooltipName = document.getElementById('project-tooltip-name');
  const projTooltipDate = document.getElementById('project-tooltip-date');
  const projTooltipAttempts = document.getElementById('project-tooltip-attempts');
  const projTooltipAttemptList = document.getElementById('project-tooltip-attempt-list');

  if (table) {
    table.addEventListener('mouseover', (e) => {
      // 1. Profile Tooltip delegation
      const loginCell = e.target.closest('.td-login');
      if (loginCell && !loginCell.contains(e.relatedTarget)) {
        const login = loginCell.getAttribute('data-login');
        const avatar = loginCell.getAttribute('data-avatar');
        const level = loginCell.getAttribute('data-level');
        const bh = loginCell.getAttribute('data-bh');
        const cohort = loginCell.getAttribute('data-cohort');

        if (tooltip) {
          tooltipAvatar.src = avatar;
          tooltipLogin.textContent = login;
          tooltipCohort.textContent = cohort;
          tooltipLevel.textContent = `Level: ${level}`;
          tooltipBh.textContent = `Blackhole: ${bh}`;
          tooltip.style.display = 'flex';

          const rect = loginCell.getBoundingClientRect();
          const topPosition = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
          const leftPosition = rect.right + 12;

          tooltip.style.top = `${topPosition}px`;
          tooltip.style.left = `${leftPosition}px`;

          setTimeout(() => {
            tooltip.classList.add('show');
          }, 10);
        }

        // Diagnostics
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([`user_data_${login}`, `error_${login}`], (res) => {
            console.log(`[Diagnostic] Hovered Cadet: ${login}`, {
              has_data: !!res[`user_data_${login}`],
              data_length: res[`user_data_${login}`] ? res[`user_data_${login}`].length : 0,
              error: res[`error_${login}`] || null
            });
          });
        }
      }

      // 2. Project Tooltip delegation
      const projCell = e.target.closest('[data-project-name]');
      if (projCell && !projCell.contains(e.relatedTarget)) {
        const name = projCell.getAttribute('data-project-name');
        const passDate = projCell.getAttribute('data-pass-date');
        const attemptsJson = projCell.getAttribute('data-attempts');

        if (projTooltip) {
          projTooltipName.textContent = name;
          if (passDate) {
            projTooltipDate.textContent = `통과일: ${passDate}`;
            projTooltipDate.style.display = 'block';
          } else {
            projTooltipDate.style.display = 'none';
          }

          projTooltipAttemptList.innerHTML = '';
          if (attemptsJson) {
            try {
              const attempts = JSON.parse(attemptsJson);
              if (attempts && attempts.length > 0) {
                attempts.forEach(att => {
                  const li = document.createElement('li');
                  const statusStr = att.status === 'pass' ? '통과' : '실패';
                  li.innerHTML = `
                    <span class="attempt-index">${att.date}:</span>
                    <span class="attempt-score">${att.score}점</span>
                    <span class="attempt-status status--${att.status}">(${statusStr})</span>
                  `;
                  projTooltipAttemptList.appendChild(li);
                });
                projTooltipAttempts.style.display = 'block';
              } else {
                projTooltipAttempts.style.display = 'none';
              }
            } catch (err) {
              projTooltipAttempts.style.display = 'none';
            }
          } else {
            projTooltipAttempts.style.display = 'none';
          }

          projTooltip.style.display = 'block';

          const rect = projCell.getBoundingClientRect();
          let topPosition = rect.top - projTooltip.offsetHeight - 8;
          if (topPosition < 0) {
            topPosition = rect.bottom + 8;
          }
          const leftPosition = rect.left + (rect.width / 2) - (projTooltip.offsetWidth / 2);

          projTooltip.style.top = `${topPosition + window.scrollY}px`;
          projTooltip.style.left = `${leftPosition + window.scrollX}px`;

          setTimeout(() => {
            projTooltip.classList.add('show');
          }, 10);
        }
      }
    });

    table.addEventListener('mouseout', (e) => {
      // 1. Profile Tooltip: hide when leaving login cell (including when mouse leaves window)
      const loginCell = e.target.closest('.td-login');
      if (loginCell && (!e.relatedTarget || !loginCell.contains(e.relatedTarget))) {
        if (tooltip) {
          tooltip.classList.remove('show');
          tooltip.style.display = 'none';
        }
      }

      // 2. Project Tooltip: hide when leaving project cell
      const projCell = e.target.closest('[data-project-name]');
      if (projCell && (!e.relatedTarget || !projCell.contains(e.relatedTarget))) {
        if (projTooltip) {
          projTooltip.classList.remove('show');
          projTooltip.style.display = 'none';
        }
      }
    });
  }

  // ─── Storage Backend Helpers ──────────────────────────────────────────────
  function loadStorageBackend() {
    // Read from chrome.storage meta if available, else use localStorage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['meta'], (result) => {
        if (result.meta && result.meta.storage_backend) {
          storageBackend = result.meta.storage_backend;
          // Sync radio
          const radio = document.getElementById(`storage-${storageBackend}`);
          if (radio) radio.checked = true;
        }
        loadFavorites();
      });
    } else {
      loadFavorites();
    }
  }

  function saveFavorites() {
    const data = JSON.stringify(favorites);
    if (storageBackend === 'local') {
      try { localStorage.setItem('starred_cadets', data); } catch (e) {}
    } else {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ starred_cadets: favorites });
      } else {
        try { localStorage.setItem('starred_cadets', data); } catch (e) {}
      }
    }
  }

  function loadFavorites() {
    if (storageBackend === 'local') {
      try {
        const stored = localStorage.getItem('starred_cadets');
        if (stored) favorites = JSON.parse(stored);
      } catch (e) {}
      updateStarUI();
    } else {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['starred_cadets'], (result) => {
          if (result.starred_cadets) favorites = result.starred_cadets;
          updateStarUI();
        });
      } else {
        try {
          const stored = localStorage.getItem('starred_cadets');
          if (stored) favorites = JSON.parse(stored);
        } catch (e) {}
        updateStarUI();
      }
    }
  }

  // ─── P1-3 & P2-1: Settings Panel & API Auth ───────────────────────────────
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', () => {
      const hidden = settingsPanel.style.display === 'none';
      settingsPanel.style.display = hidden ? 'flex' : 'none';

      if (hidden) {
        // Calculate chrome.storage size
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.getBytesInUse(null, (bytes) => {
            const usageChrome = document.getElementById('usage-chrome');
            if (usageChrome) usageChrome.textContent = bytes > 0 ? (bytes / 1024).toFixed(2) + ' KB' : '0 KB';
          });
        }
        // Calculate localStorage size
        let lsBytes = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            lsBytes += localStorage[key].length + key.length;
          }
        }
        const usageLocal = document.getElementById('usage-local');
        if (usageLocal) usageLocal.textContent = lsBytes > 0 ? (lsBytes / 1024).toFixed(2) + ' KB' : '0 KB';

        // Check for worker errors
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['last_worker_error'], (res) => {
            const errDiv = document.getElementById('worker-error-msg');
            if (errDiv) {
              if (res.last_worker_error) {
                const d = new Date(res.last_worker_error.timestamp).toLocaleTimeString();
                errDiv.textContent = `⚠️ 수집 에러 (${d}): ${res.last_worker_error.message} (Status: ${res.last_worker_error.status})`;
                errDiv.style.display = 'block';
              } else {
                errDiv.style.display = 'none';
              }
            }
          });
        }
      }
    });

    // Storage backend radio change
    document.querySelectorAll('input[name="storage-backend"]').forEach(radio => {
      radio.addEventListener('change', () => {
        storageBackend = radio.value;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['meta'], (result) => {
            const meta = result.meta || {};
            meta.storage_backend = storageBackend;
            chrome.storage.local.set({ meta });
          });
        }
        saveFavorites();
      });
    });

    // API Auth Logic (P2-1)
    const btnSaveAuth = document.getElementById('btn-save-auth');
    const inputUid = document.getElementById('api-uid');
    const inputSecret = document.getElementById('api-secret');
    const statusMsg = document.getElementById('auth-status-msg');

    // Load existing auth data
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['api_uid', 'api_secret', 'api_token'], (res) => {
        if (res.api_uid) inputUid.value = res.api_uid;
        if (res.api_secret) inputSecret.value = res.api_secret;
        if (res.api_token) {
          statusMsg.textContent = '✅ 연동 완료 (토큰 보유)';
          statusMsg.className = 'auth-status success';
        }
      });
    }

    if (btnSaveAuth) {
      btnSaveAuth.addEventListener('click', async () => {
        const uid = inputUid.value.trim();
        const secret = inputSecret.value.trim();
        if (!uid || !secret) {
          statusMsg.textContent = '❌ UID와 SECRET을 모두 입력해주세요.';
          statusMsg.className = 'auth-status error';
          return;
        }

        btnSaveAuth.disabled = true;
        statusMsg.textContent = '⏳ 토큰 발급 중...';
        statusMsg.className = 'auth-status';
        
        // Clear previous error
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove(['last_worker_error']);
        }
        const errDiv = document.getElementById('worker-error-msg');
        if (errDiv) errDiv.style.display = 'none';

        try {
          const response = await fetch('https://api.intra.42.fr/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: uid,
              client_secret: secret
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          if (data.access_token) {
            // Save to chrome.storage
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({
                api_uid: uid,
                api_secret: secret,
                api_token: data.access_token,
                api_token_expires: Date.now() + (data.expires_in * 1000)
              }, () => {
                statusMsg.textContent = '✅ 연동 완료 (토큰 보유)';
                statusMsg.className = 'auth-status success';
                
                // Reset index update time to force refetch, and trigger syncData
                chrome.storage.local.get(['meta'], (res) => {
                  const meta = res.meta || {};
                  meta.users_index_updated = 0;
                  chrome.storage.local.set({ meta }, () => {
                    if (typeof window.syncData === 'function') {
                      window.syncData();
                    }
                  });
                });
              });
            }
          } else {
            throw new Error('No access token in response');
          }
        } catch (error) {
          console.error('[API Auth] Token fetch failed:', error);
          statusMsg.textContent = `❌ 발급 실패: ${error.message}`;
          statusMsg.className = 'auth-status error';
        } finally {
          btnSaveAuth.disabled = false;
        }
      });
    }

    // ─── Parse Mode Persistence ──────────────────────────────────────────────
    const parseModeAll = document.getElementById('parse-mode-all');
    const parseModeActive = document.getElementById('parse-mode-active');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['parse_mode'], (res) => {
        const mode = res.parse_mode || 'all';
        if (mode === 'active' && parseModeActive) parseModeActive.checked = true;
        else if (parseModeAll) parseModeAll.checked = true;
      });
      if (parseModeAll) parseModeAll.addEventListener('change', () => { chrome.storage.local.set({ parse_mode: 'all' }); });
      if (parseModeActive) parseModeActive.addEventListener('change', () => { chrome.storage.local.set({ parse_mode: 'active' }); });
    }

    // ─── Resync Button (Header) ──────────────────────────────────────────────
    const btnResync = document.getElementById('btn-resync');
    if (btnResync) {
      btnResync.addEventListener('click', () => {
        if (!confirm('저장된 과제 데이터를 초기화하고 현재 파싱 옵션에 맞춰 재수집합니다. 계속하시겠습니까?')) return;
        
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' }, () => {
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(null, (all) => {
                const keysToRemove = Object.keys(all).filter(k => k.startsWith('user_data_') || k === 'users_index');
                // Also clear meta timestamps so index will be re-fetched
                keysToRemove.push('meta');
                chrome.storage.local.remove(keysToRemove, () => {
                  const authMsg = document.getElementById('auth-status-msg');
                  if (authMsg) authMsg.textContent = '🔄 재수집을 시작합니다...';
                  // Trigger syncData from data_sync.js
                  if (typeof window.syncData === 'function') window.syncData();
                });
              });
            }
          });
        }
      });
    }

    // Clear Stored Data Logic
    const btnClearData = document.getElementById('btn-clear-data');
    if (btnClearData) {
      btnClearData.addEventListener('click', () => {
        if (!confirm('저장된 모든 카뎃 및 과제 캐시 데이터를 삭제하시겠습니까? (API 연동 설정은 유지됩니다)')) {
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'CLEAR_QUEUE' }, () => {
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.get(null, (items) => {
                const keysToRemove = Object.keys(items).filter(key => {
                  return !['api_uid', 'api_secret', 'api_token', 'api_token_expires'].includes(key);
                });

                chrome.storage.local.remove(keysToRemove, () => {
                  alert('저장된 데이터가 초기화되었습니다. 페이지를 새로고침합니다.');
                  location.reload();
                });
              });
            }
          });
        }
      });
    }
  }


  // ─── Star Icon / Favorite Cadet Logic ────────────────────────────────────
  let favorites = [];

  function updateStarUI() {
    document.querySelectorAll('.td-login').forEach(cell => {
      const login = cell.getAttribute('data-login');
      const star = cell.querySelector('.star-icon');
      if (star && login) {
        const isFav = favorites.includes(login);
        star.classList.toggle('starred', isFav);
        star.innerHTML = isFav ? '★' : '☆';
      }
    });
    // Re-run filters when star state changes (for starred tab view)
    if (typeof updateFilters === 'function') updateFilters();
  }

  // Click Redirects and Star Logic via Event Delegation
  if (table) {
    table.addEventListener('click', (e) => {
      // 1. Star click
      const star = e.target.closest('.star-icon');
      if (star) {
        e.stopPropagation();
        const cell = star.closest('.td-login');
        const login = cell ? cell.getAttribute('data-login') : null;
        if (!login) return;

        const isStarred = star.classList.contains('starred');
        if (isStarred) {
          favorites = favorites.filter(id => id !== login);
          star.classList.remove('starred');
          star.innerHTML = '☆';
        } else {
          favorites.push(login);
          star.classList.add('starred');
          star.innerHTML = '★';
        }
        updateStarUI();
        saveFavorites();
        return;
      }

      // 2. Profile Login click
      const loginCell = e.target.closest('.td-login');
      if (loginCell) {
        const login = loginCell.getAttribute('data-login');
        if (login) {
          window.open(`https://profile.intra.42.fr/users/${login}`, '_blank');
        }
        return;
      }

      // 3. Evaluation Redirect (Score cell) click
      const scoreCell = e.target.closest('.cell:not(.cell--choice):not(.sticky-col), .choice-sub');
      if (scoreCell) {
        const row = scoreCell.closest('tr');
        const loginCell = row ? row.querySelector('.td-login') : null;
        const login = loginCell ? loginCell.getAttribute('data-login') : null;

        let slug = scoreCell.getAttribute('data-project-slug');
        if (!slug) {
          const name = scoreCell.getAttribute('data-project-name');
          if (name) {
            slug = getIntraSlug(name);
          }
        }

        if (slug) {
          const textVal = scoreCell.textContent.trim();
          const hasStarted = !scoreCell.classList.contains('cell--empty') && textVal !== '—' && textVal !== '';
          
          if (hasStarted && login) {
            window.open(`https://projects.intra.42.fr/users/${login}/projects/${slug}`, '_blank');
          } else {
            window.open(`https://projects.intra.42.fr/projects/${slug}`, '_blank');
          }
        }
      }
    });
  }

  // Load favorites using the backend setting
  loadStorageBackend();

  // Central function to resolve 42 Intra project slugs correctly
  function getIntraSlug(name) {
    if (!name) return '';
    
    // Lowercase, trim, and handle newlines (split by newline and use first project name)
    let slug = name.split('\n')[0].trim().toLowerCase();
    
    // Remove special characters except alphanumeric, hyphen, underscore
    slug = slug.replace(/[^a-z0-9\s-_]/g, '');
    
    // Handle specific overrides for CPP Modules
    if (slug.includes('cpp-module') || slug.includes('cpp0') || (slug.startsWith('cpp') && slug !== 'cpp')) {
      const match = slug.match(/\d+/);
      const num = match ? match[0].padStart(2, '0') : '00';
      return `cpp-module-${num}`;
    }
    
    // Handle specific overrides for Exam Rank
    if (slug.includes('exam-rank') || slug.includes('exam_rank')) {
      const match = slug.match(/\d+/);
      const num = match ? match[0].padStart(2, '0') : '02';
      return `exam-rank-${num}`;
    }
    
    // Standard spaces to underscore replacement
    slug = slug.replace(/\s+/g, '_');
    
    // Standard mapping table for all core curriculum projects on 42 Intra
    const slugMap = {
      'libft': '42cursus-libft',
      'ft_printf': '42cursus-ft_printf',
      'get_next_line': '42cursus-get_next_line',
      'born2beroot': '42cursus-born2beroot',
      'push_swap': '42cursus-push_swap',
      'minitalk': '42cursus-minitalk',
      'pipex': '42cursus-pipex',
      'so_long': '42cursus-so_long',
      'fract-ol': '42cursus-fract-ol',
      'fdf': '42cursus-fdf',
      'minishell': '42cursus-minishell',
      'philosophers': '42cursus-philosophers',
      'cub3d': '42cursus-cub3d',
      'minirt': '42cursus-minirt',
      'netpractice': '42cursus-netpractice',
      'inception': '42cursus-inception',
      'ft_irc': '42cursus-ft_irc',
      'webserv': '42cursus-webserv',
      'ft_transcendence': '42cursus-ft_transcendence'
    };
    
    return slugMap[slug] || `42cursus-${slug}`;
  }

  // State variables for filter intersection (AND logic)
  const activeProjectFilters = new Map(); // key: colIndex (number), value: state (1 = started, 2 = unstarted)
  let activeCircleFilter = null;          // circle number: 0 to 6 (or null)

  // Helper to determine circle based on Level
  function getCadetCircle(level) {
    if (level >= 6.0) return 6;
    if (level >= 5.0) return 5;
    if (level >= 4.0) return 4;
    if (level >= 3.0) return 3;
    if (level >= 2.0) return 2;
    if (level >= 1.0) return 1;
    return 0;
  }

  // Helper to determine if project is passed in a row
  function isProjectPassed(row, colIndex) {
    const cell = row.querySelector(`td[data-col="${colIndex}"]`);
    if (!cell) return false;
    
    if (cell.classList.contains('cell--choice')) {
      const subs = cell.querySelectorAll('.choice-sub');
      if (subs.length > 0) {
        if (cell.classList.contains('cell--pass')) {
          return true;
        }
        // Choice columns: minitalk/pipex (6), so_long/fract-ol/fdf (7), cub3d/minirt (12), ft_irc/webserv (17)
        const isChoiceCol = [6, 7, 12, 17].includes(colIndex);
        if (isChoiceCol) {
          return Array.from(subs).some(sub => sub.classList.contains('cell--pass'));
        }
        return false;
      }
    }
    
    return cell.classList.contains('cell--pass');
  }

  // Project headers click filter toggle logic (0: Reset, 1: Started, 2: Unstarted)
  const projectHeaders = document.querySelectorAll('.dashboard-table thead tr:last-child th:not(.sticky-col)');
  projectHeaders.forEach(th => {
    th.style.cursor = 'pointer';
    
    th.addEventListener('click', () => {
      const colIndex = parseInt(th.getAttribute('data-col'));
      
      // Read current state from dataset
      let currentState = parseInt(th.dataset.filterState || '0');
      currentState = (currentState + 1) % 3;
      th.dataset.filterState = currentState.toString();
      
      // Update visual styles
      th.classList.remove('filter-active-started', 'filter-active-unstarted');
      if (currentState === 1) {
        th.classList.add('filter-active-started');
        activeProjectFilters.set(colIndex, 1);
      } else if (currentState === 2) {
        th.classList.add('filter-active-unstarted');
        activeProjectFilters.set(colIndex, 2);
      } else {
        activeProjectFilters.delete(colIndex);
      }
      
      // Trigger global filter update
      if (typeof updateFilters === 'function') {
        updateFilters();
      }
    });
  });

  // Circle group headers click filter toggle logic (0: Reset, 1: Filter active circle)
  const circleHeaders = document.querySelectorAll('.circle-group-header');
  circleHeaders.forEach(th => {
    th.style.cursor = 'pointer';
    
    th.addEventListener('click', () => {
      const circleText = th.textContent.trim();
      const circleNum = parseInt(circleText.replace(/[^0-9]/g, ''));
      
      const isAlreadyActive = th.classList.contains('circle-active');
      
      // Reset all circle headers
      circleHeaders.forEach(otherTh => {
        otherTh.classList.remove('circle-active');
      });
      
      if (isAlreadyActive) {
        activeCircleFilter = null;
      } else {
        th.classList.add('circle-active');
        activeCircleFilter = circleNum;
      }
      
      // Trigger global filter update
      if (typeof updateFilters === 'function') {
        updateFilters();
      }
    });
  });

  // Cohort Parsing and Dynamic Filtering Logic
  function getCohortGroup(cohortStr) {
    if (!cohortStr) return '미식별';
    
    // Normalize spaces and lowercase
    const norm = cohortStr.replace(/\s+/g, '').toLowerCase();
    
    if (norm.includes('1기') || norm.includes('2024-02-26')) return '1기';
    if (norm.includes('2기') || norm.includes('2024-10-01')) return '2기';
    if (norm.includes('3기a') || norm.includes('2025-04-01')) return '3기A';
    if (norm.includes('3기b') || norm.includes('2025-10-01')) return '3기B';
    if (norm.includes('3기c') || norm.includes('2025-12-15')) return '3기C';
    if (norm.includes('4기a') || norm.includes('2026-04-01')) return '4기A';
    
    // If unidentified, extract date (YYYY-MM-DD) or fallback to raw string
    const dateMatch = cohortStr.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return dateMatch[0];
    }
    const monthMatch = cohortStr.match(/\d{4}-\d{2}/);
    if (monthMatch) {
      return monthMatch[0];
    }
    return cohortStr.trim();
  }

  const PREDEFINED_COHORTS = [
    { value: '1기', label: '1기 (2024-02-26)' },
    { value: '2기', label: '2기 (2024-10-01)' },
    { value: '3기A', label: '3기 A (2025-04-01)' },
    { value: '3기B', label: '3기 B (2025-10-01)' },
    { value: '3기C', label: '3기 C (2025-12-15)' },
    { value: '4기A', label: '4기 A (2026-04-01)' }
  ];

  const allCheckbox = document.getElementById('cohort-all-checkbox');
  const dynamicContainer = document.getElementById('cohort-dynamic-options');
  const toggleBlackhole = document.getElementById('toggle-exclude-blackhole');
  const toggleFrozen = document.getElementById('toggle-include-frozen');

  // Helpers to detect status
  function isBlackholed(loginCell) {
    const bh = loginCell.getAttribute('data-bh') || '';
    if (bh === '멤버' || !bh || bh === '-') return false;
    const bhDate = new Date(bh).getTime();
    return !isNaN(bhDate) && bhDate < Date.now();
  }

  function isFrozen(loginCell) {
    const bh = loginCell.getAttribute('data-bh') || '';
    return bh === '멤버' || bh === '-' || !bh;
  }

  let cohortStates = {}; // Keep track of checkbox states to avoid resets on re-renders

  // Global function inside DOMContentLoaded
  let updateFilters = function() {
    // 1. Get active cohorts
    const cohortCheckboxes = document.querySelectorAll('.cohort-checkbox');
    const activeCohorts = Array.from(cohortCheckboxes)
                               .filter(c => c.checked)
                               .map(c => c.value);

    // Toggles status values
    const includeBlackhole = toggleBlackhole ? toggleBlackhole.checked : true;
    const includeFrozen = toggleFrozen ? toggleFrozen.checked : true;

    // 2. Filter Table Rows (AND Intersection: Cohort && Blackhole && Freeze && Circle && Project)
    const currentRows = document.querySelectorAll('.dashboard-table tbody tr');
    let visibleCount = 0;
    currentRows.forEach(row => {
      const loginCell = row.querySelector('.td-login');
      if (!loginCell) return;

      const login = (loginCell.getAttribute('data-login') || '').toLowerCase();

      // P1-1: Search filter
      if (searchQuery && !login.includes(searchQuery)) {
        row.style.display = 'none';
        return;
      }

      // P1-2: Starred tab filter
      if (activeTab === 'starred') {
        const isFav = favorites.includes(loginCell.getAttribute('data-login') || '');
        if (!isFav) {
          row.style.display = 'none';
          return;
        }
      }

      // Blackhole check
      if (!includeBlackhole && isBlackholed(loginCell)) {
        row.style.display = 'none';
        return;
      }

      // Frozen check
      if (!includeFrozen && isFrozen(loginCell)) {
        row.style.display = 'none';
        return;
      }

      // Cohort match
      const cohortVal = loginCell.getAttribute('data-cohort');
      if (!cohortVal || cohortVal === '-') {
        row.style.display = 'none';
        return;
      }
      const group = getCohortGroup(cohortVal);
      const cohortMatch = activeCohorts.includes(group);

      // Circle match
      let circleMatch = true;
      if (activeCircleFilter !== null) {
        const level = parseFloat(loginCell.getAttribute('data-level') || '0');
        const cadetCircle = getCadetCircle(level);
        circleMatch = (cadetCircle === activeCircleFilter);
      }

      // Project match (AND intersection: must satisfy all active project filters)
      let projectMatch = true;
      for (const [colIndex, state] of activeProjectFilters.entries()) {
        const isPassed = isProjectPassed(row, colIndex);
        if (state === 1) { // 1 = Green (Passed)
          if (!isPassed) {
            projectMatch = false;
            break;
          }
        } else if (state === 2) { // 2 = Red (Others: failed, progress, unstarted)
          if (isPassed) {
            projectMatch = false;
            break;
          }
        }
      }
      
      // Show row if it satisfies all active criteria (AND logic)
      if (cohortMatch && circleMatch && projectMatch) {
        row.style.display = 'table-row';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    const countElement = document.getElementById('visible-count');
    if (countElement) countElement.textContent = visibleCount;
  };
  window.updateFilters = updateFilters;

  function buildCohortCheckboxes() {
    if (!dynamicContainer) return;
    
    // 1. Collect unique cohort values from all current table rows
    const foundCohorts = new Set();
    const currentRows = document.querySelectorAll('.dashboard-table tbody tr');
    currentRows.forEach(row => {
      const loginCell = row.querySelector('.td-login');
      if (loginCell) {
        const cohortVal = loginCell.getAttribute('data-cohort');
        if (cohortVal) {
          foundCohorts.add(getCohortGroup(cohortVal));
        }
      }
    });

    // Compare found cohorts with current checkboxes to see if we need to rebuild
    const currentCBs = document.querySelectorAll('.cohort-checkbox');
    const currentCBValues = Array.from(currentCBs).map(cb => cb.value);
    const cohortsChanged = foundCohorts.size !== currentCBValues.length || 
                           Array.from(foundCohorts).some(c => !currentCBValues.includes(c));
    
    if (!cohortsChanged && currentCBValues.length > 0) {
      updateFilters();
      return;
    }

    // Save current states of existing checkboxes before rebuilding
    currentCBs.forEach(cb => {
      cohortStates[cb.value] = cb.checked;
    });

    // 2. Determine extra (unidentified) cohorts
    const predefinedValues = PREDEFINED_COHORTS.map(c => c.value);
    const extraCohorts = Array.from(foundCohorts).filter(val => !predefinedValues.includes(val));

    // Helper to identify if cohort is 4기 or later (or starts after 2026-04)
    function isCohort4OrLater(cValue) {
      if (!cValue) return false;
      const match = cValue.match(/(\d+)기/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num >= 4;
      }
      const dateMatch = cValue.match(/^(\d{4})-(\d{2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        if (year > 2026) return true;
        if (year === 2026 && month >= 4) return true;
      }
      return false;
    }

    // 3. Dynamically build checkboxes (horizontal pill layout)
    dynamicContainer.innerHTML = '';
    
    // Predefined cohorts
    PREDEFINED_COHORTS.forEach(cohort => {
      const label = document.createElement('label');
      label.className = 'cohort-label';
      const defaultChecked = !isCohort4OrLater(cohort.value);
      const isChecked = cohortStates[cohort.value] !== undefined ? cohortStates[cohort.value] : defaultChecked;
      label.innerHTML = `<input type="checkbox" value="${cohort.value}" class="cohort-checkbox" ${isChecked ? 'checked' : ''}> ${cohort.value}`;
      dynamicContainer.appendChild(label);
    });

    // Extra unidentified cohorts
    if (extraCohorts.length > 0) {
      const details = document.createElement('details');
      details.className = 'extra-cohorts-dropdown';
      details.style.marginLeft = '8px';
      details.style.display = 'inline-block';
      details.style.position = 'relative';
      
      const summary = document.createElement('summary');
      summary.textContent = '기타 기수...';
      summary.style.cursor = 'pointer';
      summary.style.padding = '4px 8px';
      summary.style.backgroundColor = 'var(--bg-elevated)';
      summary.style.borderRadius = '4px';
      summary.style.fontSize = '12px';
      summary.style.userSelect = 'none';
      
      const dropdownContent = document.createElement('div');
      dropdownContent.style.display = 'flex';
      dropdownContent.style.gap = '8px';
      dropdownContent.style.flexWrap = 'wrap';
      dropdownContent.style.padding = '12px';
      dropdownContent.style.marginTop = '4px';
      dropdownContent.style.backgroundColor = 'var(--bg-surface)';
      dropdownContent.style.border = '1px solid var(--border)';
      dropdownContent.style.borderRadius = '6px';
      dropdownContent.style.position = 'absolute';
      dropdownContent.style.right = '0';
      dropdownContent.style.zIndex = '100';
      dropdownContent.style.width = '420px';
      dropdownContent.style.maxHeight = '240px';
      dropdownContent.style.overflowY = 'auto';

      extraCohorts.forEach(cohort => {
        const label = document.createElement('label');
        label.className = 'cohort-label';
        const defaultChecked = false; // Default to unchecked for extra cohorts
        const isChecked = cohortStates[cohort] !== undefined ? cohortStates[cohort] : defaultChecked;
        label.innerHTML = `<input type="checkbox" value="${cohort}" class="cohort-checkbox" ${isChecked ? 'checked' : ''}> ${cohort}`;
        dropdownContent.appendChild(label);
      });

      details.appendChild(summary);
      details.appendChild(dropdownContent);
      dynamicContainer.appendChild(details);
    }

    // Grab cohort check elements after rendering
    const cohortCheckboxes = document.querySelectorAll('.cohort-checkbox');

    // Individual checkbox change listener
    cohortCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        cohortStates[cb.value] = cb.checked;
        
        const allChecked = Array.from(cohortCheckboxes).every(c => c.checked);
        const noneChecked = Array.from(cohortCheckboxes).every(c => !c.checked);
        
        if (allCheckbox) {
          if (allChecked) {
            allCheckbox.checked = true;
            allCheckbox.indeterminate = false;
          } else if (noneChecked) {
            allCheckbox.checked = false;
            allCheckbox.indeterminate = false;
          } else {
            allCheckbox.checked = false;
            allCheckbox.indeterminate = true;
          }
        }
        updateFilters();
      });
    });

    // Sync allCheckbox state initially on load
    if (allCheckbox && cohortCheckboxes.length > 0) {
      const allChecked = Array.from(cohortCheckboxes).every(c => c.checked);
      const noneChecked = Array.from(cohortCheckboxes).every(c => !c.checked);
      if (allChecked) {
        allCheckbox.checked = true;
        allCheckbox.indeterminate = false;
      } else if (noneChecked) {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = false;
      } else {
        allCheckbox.checked = false;
        allCheckbox.indeterminate = true;
      }
    }

    updateFilters();
  }
  window.buildCohortCheckboxes = buildCohortCheckboxes;

  // Toggle All Checkboxes (bind once)
  if (allCheckbox) {
    allCheckbox.addEventListener('change', () => {
      const isChecked = allCheckbox.checked;
      const cohortCheckboxes = document.querySelectorAll('.cohort-checkbox');
      cohortCheckboxes.forEach(cb => {
        cb.checked = isChecked;
        cohortStates[cb.value] = isChecked;
      });
      updateFilters();
    });
  }

  // Toggle check bindings (bind once)
  if (toggleBlackhole) {
    toggleBlackhole.addEventListener('change', () => updateFilters());
  }
  if (toggleFrozen) {
    toggleFrozen.addEventListener('change', () => updateFilters());
  }

  // Initial build of checkboxes (will be empty rows initially, but shows predefined values)
  buildCohortCheckboxes();

  // Project Filter Reset Button Logic
  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      activeProjectFilters.clear();
      activeCircleFilter = null;
      projectHeaders.forEach(th => {
        th.classList.remove('filter-active-started', 'filter-active-unstarted');
        th.dataset.filterState = '0';
      });
      circleHeaders.forEach(th => {
        th.classList.remove('circle-active');
      });
      updateFilters();
    });
  }

  // ─── P1-1: Search ──────────────────────────────────────────────────────────
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchDebounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchQuery = searchInput.value.trim().toLowerCase();
        updateFilters();
      }, 200);
    });
  }

  // ─── P1-2: Tab Switching ───────────────────────────────────────────────────
  const tabAll = document.getElementById('tab-all');
  const tabStarred = document.getElementById('tab-starred');
  if (tabAll && tabStarred) {
    tabAll.addEventListener('click', () => {
      activeTab = 'all';
      tabAll.classList.add('active');
      tabStarred.classList.remove('active');
      updateFilters();
    });
    tabStarred.addEventListener('click', () => {
      activeTab = 'starred';
      tabStarred.classList.add('active');
      tabAll.classList.remove('active');
      updateFilters();
    });
  }

  // ─── P1-5: Row Sorting ────────────────────────────────────────────────────
  function parseBhDays(bhStr) {
    // Returns Infinity for "무기한" / non-numeric, numeric days otherwise
    if (!bhStr) return Infinity;
    const match = bhStr.match(/(-?\d+)/);
    if (!match) return Infinity;
    return parseInt(match[1], 10);
  }

  function sortTable() {
    const tbody = document.querySelector('.dashboard-table tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => {
      const aCell = a.querySelector('.td-login');
      const bCell = b.querySelector('.td-login');
      if (!aCell || !bCell) return 0;

      let aVal, bVal;
      if (sortKey === 'login') {
        aVal = (aCell.getAttribute('data-login') || '').toLowerCase();
        bVal = (bCell.getAttribute('data-login') || '').toLowerCase();
        return sortDir * aVal.localeCompare(bVal);
      } else if (sortKey === 'level') {
        aVal = parseFloat(aCell.getAttribute('data-level') || '0');
        bVal = parseFloat(bCell.getAttribute('data-level') || '0');
        return sortDir * (bVal - aVal); // desc = higher first by default
      } else if (sortKey === 'bh') {
        aVal = parseBhDays(aCell.getAttribute('data-bh'));
        bVal = parseBhDays(bCell.getAttribute('data-bh'));
        // Infinity (무기한) always goes to the bottom when sorting by urgency (asc)
        if (aVal === Infinity && bVal === Infinity) return 0;
        if (aVal === Infinity) return 1;
        if (bVal === Infinity) return -1;
        return sortDir * (aVal - bVal);
      }
      return 0;
    });
    rows.forEach(row => tbody.appendChild(row));
  }
  window.sortTable = sortTable;

  // Bind sort to sticky diagonal header
  const stickyHeader = document.querySelector('.sticky-col.diagonal-header');
  if (stickyHeader) {
    // Cycle through: login → level → bh → login ...
    const sortCycle = ['login', 'level', 'bh'];
    const sortLabels = { login: 'Login', level: '레벨', bh: '블랙홀' };
    stickyHeader.style.cursor = 'pointer';
    stickyHeader.title = '클릭하여 정렬 기준 변경 (Login → 레벨 → 블랙홀)';

    let sortCycleIdx = 1; // start at 'level'
    stickyHeader.addEventListener('click', () => {
      sortCycleIdx = (sortCycleIdx + 1) % sortCycle.length;
      sortKey = sortCycle[sortCycleIdx];
      sortDir = sortKey === 'bh' ? 1 : -1; // bh: ascending (most urgent first)
      stickyHeader.title = `정렬 기준: ${sortLabels[sortKey]} (클릭하여 변경)`;
      sortTable();
    });

    // Also bind the bottom diagonal label bottom (intra_id) to toggle asc/desc
    const bottomLabel = stickyHeader.querySelector('.diagonal-label--bottom');
    if (bottomLabel) {
      bottomLabel.title = '클릭: 정렬 기준 변경';
    }
  }

  // Initial sort
  sortTable();
});
