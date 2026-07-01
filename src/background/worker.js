// Background service worker for 42-subject-dashboard Chrome Extension
// Handles: API request queue, Rate limit control, alarm schedules.

importScripts('/utils/api_client.js');

const INTERVAL_MS = 550;
const BASE_DELAY = 1000;
const MAX_RETRIES = 3;

let jobQueue = [];
let isRunning = false;
let isPaused = false;
let pauseTimeout = null;

// Load persisted queue from storage on boot
chrome.storage.local.get(['jobQueue'], (res) => {
  if (res.jobQueue && Array.isArray(res.jobQueue)) {
    jobQueue = res.jobQueue;
    if (jobQueue.length > 0) {
      console.log(`[Worker] Restored ${jobQueue.length} jobs from storage.`);
      startQueueRunner();
    }
  }
});

// Save queue to storage
function persistQueue() {
  chrome.storage.local.set({ jobQueue });
}

// Push job to queue (avoid duplicates)
function enqueueJob(job) {
  const isDuplicate = jobQueue.some(j => j.login === job.login && j.type === job.type);
  if (!isDuplicate) {
    jobQueue.push(job);
    persistQueue();
    startQueueRunner();
  }
}

function getHighestPriorityJobIndex() {
  if (jobQueue.length === 0) return -1;
  // Find first HIGH priority job
  const highIdx = jobQueue.findIndex(j => j.priority === 'HIGH');
  if (highIdx !== -1) return highIdx;
  // Fallback to first NORMAL priority job
  return 0;
}

function broadcastStatus(login) {
  chrome.runtime.sendMessage({
    type: 'QUEUE_STATUS',
    payload: {
      total: jobQueue.length,
      current_login: login
    }
  }).catch(() => { /* Ignore errors if popup is closed */ });
}

async function startQueueRunner() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Worker] Queue runner started.');

  while (isRunning) {
    if (isPaused) {
      await new Promise(r => setTimeout(r, 100)); // Sleep while paused
      continue;
    }

    if (jobQueue.length === 0) {
      isRunning = false;
      console.log('[Worker] Queue empty. Runner stopped.');
      broadcastStatus(null);
      break;
    }

    const jobIdx = getHighestPriorityJobIndex();
    const job = jobQueue[jobIdx];
    // Remove from queue for processing
    jobQueue.splice(jobIdx, 1);
    persistQueue();
    broadcastStatus(job.login);

    try {
      let data;
      if (job.type === 'FETCH_USER_DETAIL') {
        data = await self.ApiClient.fetch(`/v2/users/${job.user_id}/projects_users`);
        if (data && Array.isArray(data)) {
          // Slim storage: only keep the 21 target project records with minimal fields (normalized without 42cursus- prefix)
          const TARGET_SLUGS = new Set([
            'libft', 'ft_printf', 'get_next_line', 'born2beroot',
            'push_swap', 'minitalk', 'pipex',
            'so_long', 'fract-ol', 'fdf',
            'exam-rank-02', 'minishell', 'philosophers', 'exam-rank-03',
            'cub3d', 'minirt', 'netpractice',
            'cpp-module-00', 'cpp-module-01', 'cpp-module-02', 'cpp-module-03', 'cpp-module-04',
            'exam-rank-04', 'inception', 'ft_irc', 'webserv',
            'cpp-module-05', 'cpp-module-06', 'cpp-module-07', 'cpp-module-08', 'cpp-module-09',
            'exam-rank-05', 'ft_transcendence', 'exam-rank-06'
          ]);
          const slimData = [];
          data.forEach(pu => {
            if (!pu.project || !pu.project.slug) return;
            const cleanSlug = pu.project.slug.toLowerCase().replace(/^42cursus-/, '');
            if (TARGET_SLUGS.has(cleanSlug)) {
              slimData.push({
                project: { slug: cleanSlug },
                status: pu.status,
                'validated?': pu['validated?'],
                final_mark: pu.final_mark,
                updated_at: pu.updated_at
              });
            }
          });
          const storageKey = `user_data_${job.login}`;
          await new Promise(resolve => chrome.storage.local.set({ [storageKey]: slimData }, resolve));
          chrome.runtime.sendMessage({ type: 'JOB_COMPLETED', payload: { login: job.login, type: job.type } }).catch(() => {});
        }
      } else if (job.type === 'FETCH_USER_INDEX') {
        const page = job.page || 1;
        const perPage = 100;
        const params = Object.assign({ page, per_page: perPage }, job.params || {});
        
        data = await self.ApiClient.fetch(job.endpoint, params);
        
        if (data && Array.isArray(data)) {
          console.log('[Worker] FETCH_USER_INDEX response length:', data.length);
          if (data.length > 0) {
            console.log('[Worker] Sample user data from API:', JSON.stringify(data[0]));
          }
          
          // Parse CursusUser records
          const parsedUsers = [];
          data.forEach(rawItem => {
            if (!rawItem.user) return;
            parsedUsers.push({
              id: rawItem.user.id,
              login: rawItem.user.login,
              level: rawItem.level,
              blackholed_at: rawItem.blackholed_at,
              begin_at: rawItem.begin_at
            });
          });
          console.log('[Worker] Parsed Cursus 21 users count:', parsedUsers.length);

          // Merge with existing users_index (overwrite if page 1 to clear old data)
          await new Promise(resolve => {
            chrome.storage.local.get(['users_index'], (res) => {
              const existing = (page === 1) ? [] : (res.users_index || []);
              const merged = [...existing, ...parsedUsers];
              // Deduplicate just in case
              const unique = Array.from(new Map(merged.map(u => [u.id, u])).values());
              chrome.storage.local.set({ users_index: unique }, resolve);
            });
          });

          // Pagination: If we received exactly perPage items, there might be a next page
          if (data.length === perPage) {
            enqueueJob({
              type: 'FETCH_USER_INDEX',
              endpoint: job.endpoint,
              params: job.params, // Pass filters to the next page
              page: page + 1,
              priority: 'NORMAL',
              retries: 0
            });
          } else {
            console.log('[Worker] FETCH_USER_INDEX completed entirely.');
            chrome.runtime.sendMessage({ type: 'INDEX_COMPLETED' }).catch(() => {});
          }
        }
      }

      // Wait INTERVAL_MS before next request
      await new Promise(r => setTimeout(r, INTERVAL_MS));

    } catch (error) {
      if (error.status === 429 || error.status >= 500) {
        if (job.retries < MAX_RETRIES) {
          job.retries += 1;
          const jitter = Math.floor(Math.random() * 500);
          const backoffDelay = BASE_DELAY * Math.pow(2, job.retries) + jitter;
          
          console.warn(`[Worker] API Error ${error.status}. Retrying job ${job.id} (${job.retries}/${MAX_RETRIES}) after ${backoffDelay}ms`);
          
          // Re-insert job
          jobQueue.push(job);
          persistQueue();

          isPaused = true;
          let pauseTime = backoffDelay;
          if (error.status === 429 && error.retryAfter) {
            pauseTime = Math.max(pauseTime, error.retryAfter * 1000);
          }
          
          clearTimeout(pauseTimeout);
          pauseTimeout = setTimeout(() => {
            isPaused = false;
          }, pauseTime);
        } else {
          console.error(`[Worker] Max retries exceeded for job ${job.id}`);
          chrome.storage.local.set({
            [`error_${job.login}`]: { error: 'MAX_RETRY_EXCEEDED', timestamp: Date.now() }
          });
        }
      } else {
        console.error(`[Worker] Unrecoverable error for job ${job.id}:`, error);
        chrome.storage.local.set({
          last_worker_error: {
            jobId: job.id,
            status: error.status || 'UNKNOWN',
            message: error.message || String(error),
            timestamp: Date.now()
          }
        });
      }
    }
  }
}

// Listen for messages from Popup/Content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENQUEUE_JOB') {
    const job = message.payload;
    if (!job.id) job.id = `job_${job.login || 'sys'}_${Date.now()}`;
    if (typeof job.retries === 'undefined') job.retries = 0;
    
    enqueueJob(job);
    sendResponse({ status: 'enqueued' });
  } else if (message.type === 'GET_QUEUE_STATUS') {
    sendResponse({
      isRunning,
      isPaused,
      total: jobQueue.length
    });
  } else if (message.type === 'TEST_AUTH') {
    const { uid, secret } = message.payload;
    self.ApiClient.refreshToken(uid, secret).then(token => {
      if (token) {
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'INVALID_CREDENTIALS' });
      }
    });
    return true; // async response
  } else if (message.type === 'CLEAR_QUEUE') {
    jobQueue = [];
    persistQueue();
    isRunning = false; // stop the loop
    broadcastStatus(null);
    sendResponse({ success: true });
    return true;
  }
  return true; // async response
});
