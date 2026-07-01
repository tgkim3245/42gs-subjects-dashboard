// data_sync.js - Handles API data synchronization, parsing, and UI rendering

const COL_MAP = {
  'libft': 1, 'ft_printf': 2, 'get_next_line': 3, 'born2beroot': 4,
  'push_swap': 5, 'exam-rank-02': 8, 'minishell': 9, 'philosophers': 10,
  'exam-rank-03': 11, 'netpractice': 13, 'exam-rank-04': 15, 'inception': 16,
  'exam-rank-05': 19, 'ft_transcendence': 20, 'exam-rank-06': 21
};

const CHOICE_COLS = {
  6: ['minitalk', 'pipex'],
  7: ['so_long', 'fract-ol', 'fdf'],
  12: ['cub3d', 'minirt'],
  17: ['ft_irc', 'webserv']
};

const MODULE_COLS = {
  14: ['cpp-module-00', 'cpp-module-01', 'cpp-module-02', 'cpp-module-03', 'cpp-module-04'],
  18: ['cpp-module-05', 'cpp-module-06', 'cpp-module-07', 'cpp-module-08', 'cpp-module-09']
};

function parseUserData(projectsUsers) {
  const parsed = {};
  if (!Array.isArray(projectsUsers)) return parsed;

  projectsUsers.forEach(pu => {
    if (!pu.project) return;
    const slug = pu.project.slug.toLowerCase();
    parsed[slug] = {
      status: pu.status,
      validated: pu['validated?'],
      mark: pu.final_mark,
      updated_at: pu.updated_at
    };
  });
  return parsed;
}

function getCellHTMLForSingle(parsed, slug) {
  const p = parsed[slug];
  if (!p || !p.status) return `<td class="cell cell--empty" data-col="-" data-project-name="${slug}"><span class="cell__score">—</span></td>`;
  
  if (p.status === 'finished' && p.validated === true) {
    return `<td class="cell cell--pass" data-col="-" data-project-name="${slug}"><span class="cell__score">${p.mark !== null ? p.mark : '✅'}</span></td>`;
  }
  if (p.status === 'finished' && p.validated === false) {
    return `<td class="cell cell--fail" data-col="-" data-project-name="${slug}"><span class="cell__score">${p.mark !== null ? p.mark : 'F'}</span></td>`;
  }
  return `<td class="cell cell--progress" data-col="-" data-project-name="${slug}"><span class="cell__score">●</span></td>`;
}

function getCellHTMLForChoice(parsed, slugs) {
  let html = `<div class="choice-container">`;
  slugs.forEach(slug => {
    const p = parsed[slug];
    if (!p || !p.status) {
      html += `<div class="choice-sub cell--empty" data-project-name="${slug}">${slug}: —</div>`;
    } else if (p.status === 'finished' && p.validated === true) {
      html += `<div class="choice-sub cell--pass" data-project-name="${slug}">${slug}: ${p.mark !== null ? p.mark : '✅'}</div>`;
    } else if (p.status === 'finished' && p.validated === false) {
      html += `<div class="choice-sub cell--fail" data-project-name="${slug}">${slug}: ${p.mark !== null ? p.mark : 'F'}</div>`;
    } else {
      html += `<div class="choice-sub cell--progress" data-project-name="${slug}">${slug}: ●</div>`;
    }
  });
  html += `</div>`;
  return html;
}

function getCellHTMLForModule(parsed, slugs) {
  let allPass = true;
  let anyProgress = false;
  let anyFinished = false;
  
  let html = `<div class="choice-container">`;
  slugs.forEach(slug => {
    const p = parsed[slug];
    if (!p || !p.status) {
      allPass = false;
      html += `<div class="choice-sub cell--empty" data-project-name="${slug}">${slug.replace('cpp-module-0', 'CPP0')}: —</div>`;
    } else if (p.status === 'finished' && p.validated === true) {
      anyFinished = true;
      html += `<div class="choice-sub cell--pass" data-project-name="${slug}">${slug.replace('cpp-module-0', 'CPP0')}: ${p.mark !== null ? p.mark : '✅'}</div>`;
    } else if (p.status === 'finished' && p.validated === false) {
      allPass = false;
      anyFinished = true;
      html += `<div class="choice-sub cell--fail" data-project-name="${slug}">${slug.replace('cpp-module-0', 'CPP0')}: ${p.mark !== null ? p.mark : 'F'}</div>`;
    } else {
      allPass = false;
      anyProgress = true;
      html += `<div class="choice-sub cell--progress" data-project-name="${slug}">${slug.replace('cpp-module-0', 'CPP0')}: ●</div>`;
    }
  });
  html += `</div>`;
  
  let containerClass = "cell--empty";
  if (allPass) containerClass = "cell--pass";
  else if (anyProgress) containerClass = "cell--progress";
  else if (anyFinished) containerClass = "cell--partial";
  
  return `<td class="cell cell--choice ${containerClass}" data-col="-">${html}</td>`;
}

function buildRowHTML(user, parsedData, isStarred) {
  let html = `<tr data-login="${user.login}" data-level="${user.level}">`;
  const avatar = "https://profile.intra.42.fr/assets/42_logo_black-684989d43d629b3c0ff6fd7e1157ee04db9bb7a73fba8ec4e01543d650a1c607.png";
  const starChar = isStarred ? '★' : '☆';
  const starredClass = isStarred ? 'starred' : '';
  
  html += `<td class="sticky-col td-login" data-login="${user.login}" data-avatar="${avatar}" data-level="${user.level}" data-bh="${user.blackholed_at || '멤버'}" data-cohort="-">`;
  html += `${user.login} <span class="star-icon ${starredClass}">${starChar}</span></td>`;
  
  for (let i = 1; i <= 21; i++) {
    if (CHOICE_COLS[i]) {
      const cellHtml = getCellHTMLForChoice(parsedData, CHOICE_COLS[i]);
      html += `<td class="cell cell--choice" data-col="${i}">${cellHtml}</td>`;
    } else if (MODULE_COLS[i]) {
      const cellHtml = getCellHTMLForModule(parsedData, MODULE_COLS[i]);
      html += cellHtml.replace('data-col="-"', `data-col="${i}"`);
    } else {
      // Find single col slug
      const slug = Object.keys(COL_MAP).find(key => COL_MAP[key] === i);
      if (slug) {
        const cellHtml = getCellHTMLForSingle(parsedData, slug);
        html += cellHtml.replace('data-col="-"', `data-col="${i}"`);
      } else {
        html += `<td class="cell cell--empty" data-col="${i}"><span class="cell__score">—</span></td>`;
      }
    }
  }
  html += `</tr>`;
  return html;
}

function renderTable() {
  console.log('[DataSync] renderTable() called');
  const tbody = document.querySelector('tbody');
  if (!tbody) {
    console.error('[DataSync] tbody element not found!');
    return;
  }

  chrome.storage.local.get(['users_index', 'starred_cadets'], (res) => {
    const users = res.users_index || [];
    const starred = res.starred_cadets || [];
    console.log('[DataSync] users_index retrieved from storage. Count:', users.length);
    
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="22" style="text-align: center; padding: 20px;">데이터를 불러오는 중입니다...</td></tr>`;
      return;
    }
    
    // Sort logic (can be expanded to use current sortKey)
    users.sort((a, b) => (b.level || 0) - (a.level || 0));
    
    let keysToGet = users.map(u => `user_data_${u.login}`);
    chrome.storage.local.get(keysToGet, (dataRes) => {
      try {
        let finalHTML = '';
        
        users.forEach(user => {
          const rawData = dataRes[`user_data_${user.login}`];
          const parsed = parseUserData(rawData || []);
          const isStarred = starred.includes(user.login);
          finalHTML += buildRowHTML(user, parsed, isStarred);
        });
        
        tbody.innerHTML = finalHTML;
        console.log('[DataSync] Table render completed successfully');
        
        // Update filters and sorting on the new rows
        if (typeof window.buildCohortCheckboxes === 'function') window.buildCohortCheckboxes();
        if (typeof window.sortTable === 'function') window.sortTable();
        if (typeof window.updateFilters === 'function') window.updateFilters();
      } catch (err) {
        console.error('[DataSync] Error building table HTML:', err);
      }
    });
  });
}

// Queue syncing logic
function syncData() {
  console.log('[DataSync] syncData() called');
  chrome.storage.local.get(['users_index', 'meta'], (res) => {
    const now = Date.now();
    const meta = res.meta || {};
    const users = res.users_index || [];
    
    // 1. Fetch index if older than 24h or empty
    if (users.length === 0 || !meta.users_index_updated || (now - meta.users_index_updated > 86400000)) {
      console.log('[DataSync] Index empty or expired. Triggering FETCH_USER_INDEX...');
      chrome.runtime.sendMessage({
        type: 'ENQUEUE_JOB',
        payload: {
          type: 'FETCH_USER_INDEX',
          endpoint: '/v2/cursus_users',
          params: {
            'filter[campus_id]': 69,
            'filter[cursus_id]': 21
          },
          priority: 'NORMAL'
        }
      });
      meta.users_index_updated = now;
      chrome.storage.local.set({ meta });
    }
    
    // 2. Fetch details for each user
    if (users.length > 0) {
      chrome.storage.local.get(['starred_cadets'], (starRes) => {
        const starred = starRes.starred_cadets || [];
        users.forEach(user => {
          chrome.storage.local.get([`user_data_${user.login}`], (dRes) => {
            const hasData = !!dRes[`user_data_${user.login}`];
            if (!hasData) {
              chrome.runtime.sendMessage({
                type: 'ENQUEUE_JOB',
                payload: {
                  type: 'FETCH_USER_DETAIL',
                  login: user.login,
                  user_id: user.id,
                  priority: starred.includes(user.login) ? 'HIGH' : 'NORMAL'
                }
              });
            }
          });
        });
      });
    }
  });
}
window.syncData = syncData;

// Listen to messages
chrome.runtime.onMessage.addListener((msg) => {
  console.log('[DataSync] Received message:', msg.type);
  if (msg.type === 'INDEX_COMPLETED') {
    syncData();
    renderTable();
  } else if (msg.type === 'JOB_COMPLETED') {
    if (window.renderTimeout) clearTimeout(window.renderTimeout);
    window.renderTimeout = setTimeout(renderTable, 500);
  } else if (msg.type === 'QUEUE_STATUS') {
    const statusMsg = document.getElementById('auth-status-msg');
    if (statusMsg && msg.payload.total > 0) {
      statusMsg.textContent = `🔄 데이터 수집 중... (남은 대기열: ${msg.payload.total}개)`;
      statusMsg.className = 'auth-status';
    } else if (statusMsg && msg.payload.total === 0) {
      statusMsg.textContent = `✅ 모든 데이터 최신화 완료`;
      statusMsg.className = 'auth-status success';
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('[DataSync] DOMContentLoaded triggered');
  renderTable();
  syncData();
});
