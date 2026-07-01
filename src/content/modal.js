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

  if (tooltip) {
    document.querySelectorAll('.td-login').forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        const login = cell.getAttribute('data-login');
        const avatar = cell.getAttribute('data-avatar');
        const level = cell.getAttribute('data-level');
        const bh = cell.getAttribute('data-bh');
        const cohort = cell.getAttribute('data-cohort');

        tooltipAvatar.src = avatar;
        tooltipLogin.textContent = login;
        tooltipCohort.textContent = cohort;
        tooltipLevel.textContent = `Level: ${level}`;
        tooltipBh.textContent = `Blackhole: ${bh}`;

        tooltip.style.display = 'flex';
        
        // Position tooltip to the right of the Login cell
        const rect = cell.getBoundingClientRect();
        
        const topPosition = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
        const leftPosition = rect.right + 12;
        
        tooltip.style.top = `${topPosition}px`;
        tooltip.style.left = `${leftPosition}px`;
        
        // Use timeout to trigger CSS transition opacity animation
        setTimeout(() => {
          tooltip.classList.add('show');
        }, 10);
      });

      cell.addEventListener('mouseleave', () => {
        tooltip.classList.remove('show');
        tooltip.style.display = 'none';
      });
    });
  }

  // Project Info Tooltip Hover Card Logic
  const projTooltip = document.getElementById('project-tooltip');
  const projTooltipName = document.getElementById('project-tooltip-name');
  const projTooltipDate = document.getElementById('project-tooltip-date');
  const projTooltipAttempts = document.getElementById('project-tooltip-attempts');
  const projTooltipAttemptList = document.getElementById('project-tooltip-attempt-list');

  if (projTooltip) {
    document.querySelectorAll('[data-project-name]').forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        const name = cell.getAttribute('data-project-name');
        const passDate = cell.getAttribute('data-pass-date');
        const attemptsJson = cell.getAttribute('data-attempts');

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
          } catch (e) {
            console.error('Error parsing attempts JSON', e);
            projTooltipAttempts.style.display = 'none';
          }
        } else {
          projTooltipAttempts.style.display = 'none';
        }

        projTooltip.style.display = 'block';

        // Position tooltip centered above the cell
        const rect = cell.getBoundingClientRect();
        let topPosition = rect.top - projTooltip.offsetHeight - 8;
        // Flip tooltip to render below the cell if it would overflow the viewport top
        if (topPosition < 0) {
          topPosition = rect.bottom + 8;
        }
        const leftPosition = rect.left + (rect.width / 2) - (projTooltip.offsetWidth / 2);
        
        projTooltip.style.top = `${topPosition + window.scrollY}px`;
        projTooltip.style.left = `${leftPosition + window.scrollX}px`;
        
        setTimeout(() => {
          projTooltip.classList.add('show');
        }, 10);
      });

      cell.addEventListener('mouseleave', () => {
        projTooltip.classList.remove('show');
        projTooltip.style.display = 'none';
      });
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

  // ─── P1-3: Settings Panel ─────────────────────────────────────────────────
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', () => {
      const hidden = settingsPanel.style.display === 'none';
      settingsPanel.style.display = hidden ? 'block' : 'none';
    });

    // Storage backend radio change
    document.querySelectorAll('input[name="storage-backend"]').forEach(radio => {
      radio.addEventListener('change', () => {
        storageBackend = radio.value;
        // Persist to chrome.storage meta
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['meta'], (result) => {
            const meta = result.meta || {};
            meta.storage_backend = storageBackend;
            chrome.storage.local.set({ meta });
          });
        }
        // Re-save favorites under new backend
        saveFavorites();
      });
    });
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

  // Inject star element
  document.querySelectorAll('.td-login').forEach(cell => {
    const login = cell.getAttribute('data-login');
    if (!login) return;

    const star = document.createElement('span');
    star.className = 'star-icon';
    star.innerHTML = '☆';
    cell.appendChild(star);

    star.addEventListener('click', (e) => {
      e.stopPropagation();
      const isStarred = star.classList.contains('starred');
      if (isStarred) {
        favorites = favorites.filter(id => id !== login);
      } else {
        favorites.push(login);
      }
      updateStarUI();
      saveFavorites();
    });
  });

  // Load favorites using the backend setting
  loadStorageBackend();



  // Click Login to redirect to Intra Profile Page
  document.querySelectorAll('.td-login').forEach(cell => {
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', (e) => {
      // Don't redirect if we clicked the star itself
      if (e.target.classList.contains('star-icon')) return;
      
      const login = cell.getAttribute('data-login');
      if (login) {
        window.open(`https://profile.intra.42.fr/users/${login}`, '_blank');
      }
    });
  });

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

  // Click Score Cell to redirect to Subject evaluation page
  const scoreCells = document.querySelectorAll('.cell:not(.cell--choice):not(.sticky-col), .choice-sub');
  scoreCells.forEach(cell => {
    // Add hover visual indicator for clickability
    cell.classList.add('clickable-cell');

    cell.addEventListener('click', () => {
      // Find login ID
      const row = cell.closest('tr');
      const loginCell = row ? row.querySelector('.td-login') : null;
      const login = loginCell ? loginCell.getAttribute('data-login') : null;

      // Find slug
      let slug = cell.getAttribute('data-project-slug');
      if (!slug) {
        const name = cell.getAttribute('data-project-name');
        if (name) {
          slug = getIntraSlug(name);
        }
      }

      if (slug) {
        const textVal = cell.textContent.trim();
        const hasStarted = !cell.classList.contains('cell--empty') && textVal !== '—' && textVal !== '';
        
        if (hasStarted && login) {
          // Open user-specific project attempt page
          window.open(`https://projects.intra.42.fr/users/${login}/projects/${slug}`, '_blank');
        } else {
          // Open general project info page
          window.open(`https://projects.intra.42.fr/projects/${slug}`, '_blank');
        }
      }
    });
  });

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

  // Helper to determine if project is started in a row
  function isProjectStarted(row, colIndex) {
    const cell = row.querySelector(`td[data-col="${colIndex}"]`);
    if (!cell) return false;
    
    if (cell.classList.contains('cell--choice')) {
      const subs = cell.querySelectorAll('.choice-sub');
      return Array.from(subs).some(sub => {
        const text = sub.textContent.trim();
        return !sub.classList.contains('cell--empty') && !text.includes('—') && text !== '';
      });
    } else {
      const text = cell.textContent.trim();
      return !cell.classList.contains('cell--empty') && text !== '—' && text !== '';
    }
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
  const tableRows = document.querySelectorAll('.dashboard-table tbody tr');
  const dynamicContainer = document.getElementById('cohort-dynamic-options');

  // Helpers to detect status
  function isBlackholed(loginCell) {
    const bh = loginCell.getAttribute('data-bh') || '';
    return bh.includes('제적') || bh.includes('만료') || bh.includes('종료');
  }

  function isFrozen(loginCell) {
    const bh = loginCell.getAttribute('data-bh') || '';
    return bh.includes('무기한') || bh.includes('프리즈') || bh.includes('멤버') || bh.includes('휴학');
  }

  // Global function inside DOMContentLoaded
  let updateFilters = function() {};

  if (dynamicContainer) {
    // 1. Collect unique cohort values from all table rows
    const foundCohorts = new Set();
    tableRows.forEach(row => {
      const loginCell = row.querySelector('.td-login');
      if (loginCell) {
        const cohortVal = loginCell.getAttribute('data-cohort');
        if (cohortVal) {
          foundCohorts.add(getCohortGroup(cohortVal));
        }
      }
    });

    // 2. Determine extra (unidentified) cohorts
    const predefinedValues = PREDEFINED_COHORTS.map(c => c.value);
    const extraCohorts = Array.from(foundCohorts).filter(val => !predefinedValues.includes(val));

    // 3. Dynamically build checkboxes (horizontal pill layout)
    dynamicContainer.innerHTML = '';
    
    // Predefined cohorts
    PREDEFINED_COHORTS.forEach(cohort => {
      const label = document.createElement('label');
      label.className = 'cohort-label';
      label.innerHTML = `<input type="checkbox" value="${cohort.value}" class="cohort-checkbox" checked> ${cohort.value}`;
      dynamicContainer.appendChild(label);
    });

    // Extra unidentified cohorts
    extraCohorts.forEach(cohort => {
      const label = document.createElement('label');
      label.className = 'cohort-label';
      label.innerHTML = `<input type="checkbox" value="${cohort}" class="cohort-checkbox" checked> ${cohort}`;
      dynamicContainer.appendChild(label);
    });

    // Grab cohort check elements after rendering
    const cohortCheckboxes = document.querySelectorAll('.cohort-checkbox');

    // Toggle All Checkboxes
    if (allCheckbox) {
      allCheckbox.addEventListener('change', () => {
        const isChecked = allCheckbox.checked;
        cohortCheckboxes.forEach(cb => {
          cb.checked = isChecked;
        });
        updateFilters();
      });
    }

    // Individual checkbox change
    cohortCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
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

    // Toggle check bindings
    const toggleBlackhole = document.getElementById('toggle-exclude-blackhole');
    const toggleFrozen = document.getElementById('toggle-include-frozen');

    if (toggleBlackhole) {
      toggleBlackhole.addEventListener('change', () => updateFilters());
    }
    if (toggleFrozen) {
      toggleFrozen.addEventListener('change', () => updateFilters());
    }

    updateFilters = function() {
      // 1. Get active cohorts
      const activeCohorts = Array.from(cohortCheckboxes)
                                 .filter(c => c.checked)
                                 .map(c => c.value);

      // Toggles status values
      const includeBlackhole = toggleBlackhole ? toggleBlackhole.checked : true;
      const includeFrozen = toggleFrozen ? toggleFrozen.checked : true;

      // 2. Filter Table Rows (AND Intersection: Cohort && Blackhole && Freeze && Circle && Project)
      tableRows.forEach(row => {
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
        if (!cohortVal) {
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
          const isStarted = isProjectStarted(row, colIndex);
          if (state === 1) {
            if (!isStarted) {
              projectMatch = false;
              break;
            }
          } else if (state === 2) {
            if (isStarted) {
              projectMatch = false;
              break;
            }
          }
        }
        
        // Show row if it satisfies all active criteria (AND logic)
        if (cohortMatch && circleMatch && projectMatch) {
          row.style.display = 'table-row';
        } else {
          row.style.display = 'none';
        }
      });
    };
    
    // Initial run to make sure everything matches the defaults
    updateFilters();
  }

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
