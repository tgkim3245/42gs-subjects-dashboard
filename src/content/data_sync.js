// data_sync.js - Handles API data synchronization, parsing, and UI rendering

// Slug keys are normalized without `42cursus-` prefix internally
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

// All slugs we care about (for slim storage filtering in worker.js)
const TARGET_SLUGS = new Set([
  ...Object.keys(COL_MAP),
  ...Object.values(CHOICE_COLS).flat(),
  ...Object.values(MODULE_COLS).flat()
]);

function escapeHtml(string) {
  if (!string) return '';
  return string
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseUserData(projectsUsers) {
  const parsed = {};
  if (!Array.isArray(projectsUsers)) return parsed;

  projectsUsers.forEach(pu => {
    if (!pu.project) return;
    // Normalize slug by removing 42cursus- prefix if present
    const slug = pu.project.slug.toLowerCase().replace(/^42cursus-/, '');
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

  const dateStr = p.updated_at ? new Date(p.updated_at).toLocaleDateString('ko-KR') : '';
  const attempts = [{ date: dateStr, score: p.mark !== null ? p.mark : '?', status: p.validated ? 'pass' : 'fail' }];
  const attemptsJson = escapeHtml(JSON.stringify(attempts));
  const passDateAttr = p.validated ? `data-pass-date="${dateStr}"` : '';

  if (p.status === 'finished' && p.validated === true) {
    return `<td class="cell cell--pass" data-col="-" data-project-name="${slug}" ${passDateAttr} data-attempts="${attemptsJson}"><span class="cell__score">${p.mark !== null ? p.mark : '✅'}</span></td>`;
  }
  if (p.status === 'finished' && p.validated === false) {
    return `<td class="cell cell--fail" data-col="-" data-project-name="${slug}" data-attempts="${attemptsJson}"><span class="cell__score">${p.mark !== null ? p.mark : 'F'}</span></td>`;
  }
  return `<td class="cell cell--progress" data-col="-" data-project-name="${slug}" data-attempts="${attemptsJson}"><span class="cell__score">●</span></td>`;
}

function getCellHTMLForChoice(parsed, slugs) {
  let html = `<div class="choice-container">`;
  slugs.forEach(slug => {
    const p = parsed[slug];
    if (!p || !p.status) {
      html += `<div class="choice-sub cell--empty" data-project-name="${slug}">${slug}: —</div>`;
    } else {
      const dateStr = p.updated_at ? new Date(p.updated_at).toLocaleDateString('ko-KR') : '';
      const attempts = [{ date: dateStr, score: p.mark !== null ? p.mark : '?', status: p.validated ? 'pass' : 'fail' }];
      const attemptsJson = escapeHtml(JSON.stringify(attempts));
      const passDateAttr = p.validated ? `data-pass-date="${dateStr}"` : '';

      if (p.status === 'finished' && p.validated === true) {
        html += `<div class="choice-sub cell--pass" data-project-name="${slug}" ${passDateAttr} data-attempts="${attemptsJson}">${slug}: ${p.mark !== null ? p.mark : '✅'}</div>`;
      } else if (p.status === 'finished' && p.validated === false) {
        html += `<div class="choice-sub cell--fail" data-project-name="${slug}" data-attempts="${attemptsJson}">${slug}: ${p.mark !== null ? p.mark : 'F'}</div>`;
      } else {
        html += `<div class="choice-sub cell--progress" data-project-name="${slug}" data-attempts="${attemptsJson}">${slug}: ●</div>`;
      }
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
    } else {
      const dateStr = p.updated_at ? new Date(p.updated_at).toLocaleDateString('ko-KR') : '';
      const attempts = [{ date: dateStr, score: p.mark !== null ? p.mark : '?', status: p.validated ? 'pass' : 'fail' }];
      const attemptsJson = escapeHtml(JSON.stringify(attempts));
      const passDateAttr = p.validated ? `data-pass-date="${dateStr}"` : '';

      if (p.status === 'finished' && p.validated === true) {
        anyFinished = true;
        html += `<div class="choice-sub cell--pass" data-project-name="${slug}" ${passDateAttr} data-attempts="${attemptsJson}">${slug.replace('cpp-module-0', 'CPP0')}: ${p.mark !== null ? p.mark : '✅'}</div>`;
      } else if (p.status === 'finished' && p.validated === false) {
        allPass = false;
        anyFinished = true;
        html += `<div class="choice-sub cell--fail" data-project-name="${slug}" data-attempts="${attemptsJson}">${slug.replace('cpp-module-0', 'CPP0')}: ${p.mark !== null ? p.mark : 'F'}</div>`;
      } else {
        allPass = false;
        anyProgress = true;
        html += `<div class="choice-sub cell--progress" data-project-name="${slug}" data-attempts="${attemptsJson}">${slug.replace('cpp-module-0', 'CPP0')}: ●</div>`;
      }
    }
  });
  html += `</div>`;

  let containerClass = "cell--empty";
  if (allPass) containerClass = "cell--pass";
  else if (anyProgress) containerClass = "cell--progress";
  else if (anyFinished) containerClass = "cell--partial";

  return `<td class="cell cell--choice ${containerClass}" data-col="-">${html}</td>`;
}

function buildRowHTML(user, parsedData, isStarred, isPending) {
  let html = `<tr data-login="${user.login}" data-level="${user.level}">`;
  const avatar = user.avatar_url || "https://profile.intra.42.fr/assets/42_logo_black-684989d43d629b3c0ff6fd7e1157ee04db9bb7a73fba8ec4e01543d650a1c607.png";
  const starChar = isStarred ? '★' : '☆';
  const starredClass = isStarred ? 'starred' : '';

  // Determine user status
  let statusBadge = '';
  let statusClass = '';
  
  if (user.blackholed_at) {
    const bhDate = new Date(user.blackholed_at).getTime();
    if (!isNaN(bhDate) && bhDate < Date.now()) {
      statusBadge = `<span class="badge badge--blackhole" title="블랙홀 제적">☠️</span>`;
      statusClass = 'row--blackhole';
    }
  } else {
    // blackholed_at is null
    if (user.level >= 18.0) {
      statusBadge = `<span class="badge badge--member" title="Common Core 멤버 (수료)">🎓</span>`;
      statusClass = 'row--member';
    } else {
      statusBadge = `<span class="badge badge--frozen" title="프리즈 (휴학/무기한)">❄️</span>`;
      statusClass = 'row--frozen';
    }
  }

  const cohort = user.begin_at ? user.begin_at.substring(0, 10) : '-';
  let spinnerHtml = '';
  if (isPending) {
    spinnerHtml = ` <span class="sync-spinner-mini" title="데이터 수집 대기 중...">🔄</span>`;
  }
  html += `<td class="sticky-col td-login ${statusClass}" data-login="${user.login}" data-avatar="${avatar}" data-level="${user.level}" data-bh="${user.blackholed_at || '멤버'}" data-cohort="${cohort}">`;
  html += `${statusBadge}${user.login}${spinnerHtml} <span class="star-icon ${starredClass}">${starChar}</span></td>`;

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

  chrome.storage.local.get(['users_index', 'starred_cadets', 'parse_mode'], (res) => {
    const users = res.users_index || [];
    const starred = res.starred_cadets || [];
    const parseMode = res.parse_mode || 'all';
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
        const now = Date.now();
        const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

        users.forEach(user => {
          const rawData = dataRes[`user_data_${user.login}`];
          
          let isPending = false;
          if (rawData === undefined) {
            let isSkipped = false;
            if (parseMode === 'active' && user.blackholed_at) {
              const bhDate = new Date(user.blackholed_at).getTime();
              if (!isNaN(bhDate) && (now - bhDate > SIX_MONTHS_MS)) {
                isSkipped = true;
              }
            }
            if (!isSkipped) {
              isPending = true;
            }
          }

          const parsed = parseUserData(rawData || []);
          const isStarred = starred.includes(user.login);
          finalHTML += buildRowHTML(user, parsed, isStarred, isPending);
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
      chrome.storage.local.get(['starred_cadets', 'parse_mode'], (starRes) => {
        const starred = starRes.starred_cadets || [];
        const parseMode = starRes.parse_mode || 'all';
        const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

        users.forEach(user => {
          // Skip inactive users if parse_mode is 'active'
          if (parseMode === 'active' && user.blackholed_at) {
            const bhDate = new Date(user.blackholed_at).getTime();
            if (!isNaN(bhDate) && (now - bhDate > SIX_MONTHS_MS)) {
              return; // Skip: blackholed more than 6 months ago
            }
          }

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
  if (msg.type === 'INDEX_COMPLETED') {
    syncData();
    renderTable();
  } else if (msg.type === 'JOB_COMPLETED') {
    // Throttle render during bulk collection: at most once every 5 seconds
    const now = Date.now();
    if (!window.lastRenderTime) window.lastRenderTime = 0;
    
    if (now - window.lastRenderTime >= 5000) {
      renderTable();
      window.lastRenderTime = now;
    } else {
      if (window.renderTimeout) clearTimeout(window.renderTimeout);
      window.renderTimeout = setTimeout(() => {
        renderTable();
        window.lastRenderTime = Date.now();
      }, 5000 - (now - window.lastRenderTime));
    }
  } else if (msg.type === 'QUEUE_STATUS') {
    const statusMsg = document.getElementById('auth-status-msg');
    const topSubtitle = document.getElementById('sync-subtitle');
    
    if (msg.payload.total > 0) {
      const text = `🔄 수집 중 (대기열: ${msg.payload.total}개)`;
      if (statusMsg) {
        statusMsg.textContent = text;
        statusMsg.className = 'auth-status';
      }
      if (topSubtitle) {
        topSubtitle.textContent = text;
        topSubtitle.style.color = 'var(--accent-blue)';
      }
    } else if (msg.payload.total === 0) {
      const text = `✅ 모든 데이터 최신화 완료`;
      if (statusMsg) {
        statusMsg.textContent = text;
        statusMsg.className = 'auth-status success';
      }
      if (topSubtitle) {
        topSubtitle.textContent = text;
        topSubtitle.style.color = 'var(--status-pass-text)';
      }
      // Final render when collection is done
      renderTable();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderTable();
  syncData();
});

