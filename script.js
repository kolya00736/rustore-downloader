// Android SDK version mapping
const sdkVersions = {
    1:  '1.0',   2:  '1.1',   3:  '1.5',   4:  '1.6',   5:  '2.0',  6:  '2.0.1',
    7:  '2.1',   8:  '2.2',   9:  '2.3',   10: '2.3.3', 11: '3.0',  12: '3.1',
    13: '3.2',   14: '4.0',   15: '4.0.3', 16: '4.1',   17: '4.2',  18: '4.3',
    19: '4.4',   20: '4.4W',  21: '5.0',   22: '5.1',   23: '6.0',  24: '7.0',
    25: '7.1',   26: '8.0',   27: '8.1',   28: '9.0',   29: '10',   30: '11',
    31: '12',    32: '12.1',  33: '13',    34: '14',    35: '15',   36: '16'
}; // https://en.wikipedia.org/wiki/Android_version_history

// Utility functions
const getAndroidVersion = sdk => sdkVersions[sdk] ? `Android ${sdkVersions[sdk]}` : `API ${sdk}`;
const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};
const formatDate = date => new Date(date).toLocaleDateString();
const roundToDecimal = (num, places = 2) => Math.round(num * 10**places) / 10**places;

const createRatingStars = rating => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return Array.from({length: 5}, (_, i) => 
        i < fullStars 
            ? '<span class="rating-star">★</span>' 
            : (i === fullStars && hasHalfStar) 
                ? '<span class="rating-star">⯪</span>' 
                : '<span class="text-gray-300">★</span>'
    ).join('');
};

// Modal Management
const ModalManager = {
    show(modalId, contentId, content) {
        const modal = document.getElementById(modalId);
        if (contentId) {
            document.getElementById(contentId).innerHTML = content;
        }
        modal.classList.remove('hidden');
        modal.classList.add('show');
    },

    hide(modalId, contentId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('hidden');
        modal.classList.remove('show');
        if (contentId) {
            document.getElementById(contentId).innerHTML = '';
        }
    },

    showError(containerId, title, message) {
        document.getElementById(containerId).innerHTML = `
            <div class="col-span-full text-center p-4 bg-red-50 rounded-lg">
                <p class="text-red-600 font-medium">${title}</p>
                <p class="text-red-500 text-sm mt-2">${message}</p>
            </div>
        `;
    }
};

// State Management
const state = {
    controller: null,
    imageIndex: 0,
    images: [],
    page: 0,
    isLoading: false,
    hasMorePages: true,
    query: '',
    
    reset() {
        if (this.controller) this.controller.abort();
        this.controller = new AbortController();
        this.page = 0;
        this.hasMorePages = true;
    }
};

// API functions
async function searchApps(query, isLoadMore = false) {
    if (!isLoadMore) {
        state.reset();
        state.query = query;
        state.isLoading = false;  // Reset loading state for new search
    }

    if (!query.trim() || state.isLoading || !state.hasMorePages) return;

    const resultsContainer = document.getElementById('searchResults');
    if (!isLoadMore) {
        resultsContainer.innerHTML = '<div class="col-span-full text-center p-4"><p class="text-gray-600">Searching...</p></div>';
    }
    
    state.isLoading = true;

    try {
        const response = await fetch(`https://backapi.rustore.ru/applicationData/apps?pageNumber=${state.page}&pageSize=20&query=${encodeURIComponent(query.trim())}`, {
            signal: state.controller.signal
        });
        const data = await response.json();
        
        // Check if this is still the current query
        if (query !== state.query) {
            return;
        }
        
        if (data.code === 'OK') {
            const results = data.body.content;
            
            if (!isLoadMore) resultsContainer.innerHTML = '';
            
            if (results.length === 0) {
                if (!isLoadMore) {
                    resultsContainer.innerHTML = '<div class="col-span-full text-center p-4"><p class="text-gray-600">No apps found</p></div>';
                }
                state.hasMorePages = false;
                return;
            }
            
            for (const app of results) {
                // Check if query has changed before processing each app
                if (query !== state.query) {
                    return;
                }
                const appDetails = await fetchAppDetails(app.packageName, { signal: state.controller.signal });
                if (appDetails) resultsContainer.appendChild(createAppCard(appDetails, app));
            }

            state.hasMorePages = state.page < data.body.totalPages - 1;
            state.page++;
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error searching apps:', error);
            if (!isLoadMore && query === state.query) {
                ModalManager.showError('searchResults', 'Unable to connect to the server', 'Please check your internet connection and try again');
            }
        }
    } finally {
        if (query === state.query) {
            state.isLoading = false;
        }
    }
}

async function fetchAppDetails(packageName, { signal } = {}) {
    try {
        const response = await fetch(`https://backapi.rustore.ru/applicationData/overallInfo/${packageName}`, { signal });
        const data = await response.json();
        return data.code === 'OK' ? data.body : null;
    } catch (error) {
        if (error.name !== 'AbortError') console.error('Error fetching app details:', error);
        return null;
    }
}

// UI functions
function createAppCard(appDetails, app) {
    const screenshots = appDetails.fileUrls.sort((a, b) => a.ordinal - b.ordinal);
    
    // Escape special characters in the description
    const escapedDescription = appDetails.fullDescription
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    
    return Object.assign(document.createElement('div'), {
        className: 'app-card p-4 flex flex-col justify-between h-full',
        innerHTML: `
            <div class="flex items-start gap-4">
                <img src="${appDetails.iconUrl}" alt="${appDetails.appName}" class="w-20 h-20 rounded-lg">
                <div class="flex-1 flex flex-col min-w-0">
                    <h2 class="text-xl font-bold break-words whitespace-normal w-full">${appDetails.appName}</h2>
                    <p class="text-gray-600 break-words whitespace-normal max-w-full" title="${appDetails.packageName}">${appDetails.packageName}</p>
                    <div class="rating mt-2">
                        ${createRatingStars(app.averageUserRating)}
                        ${roundToDecimal(app.averageUserRating)}
                        <span class="text-sm text-gray-600">(${app.totalRatings.toLocaleString()})</span>
                    </div>
                </div>
            </div>
            
            <div class="mt-4">
                <p class="text-gray-700">${appDetails.shortDescription}</p>
                <button class="description-toggle mt-2" onclick="showDescription('${appDetails.appName}', '${escapedDescription}')">Show full description</button>
            </div>
            
            <div class="screenshots-container my-4">
                ${screenshots.map(s => `<img src="${s.fileUrl}" alt="Screenshot" class="w-40 cursor-pointer rounded shadow" onclick="openPreview('${s.fileUrl}', event)">`).join('')}
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>App ID: ${appDetails.appId}</div>
                <div>Version Code: ${appDetails.versionCode}</div>
                <div>Size: ~${formatFileSize(appDetails.fileSize)}</div>
                <div>Min SDK: ${getAndroidVersion(appDetails.minSdkVersion)}</div>
                <div>Version: ${appDetails.versionName}</div>
                <div>Downloads: ${appDetails.downloads.toLocaleString()}</div>
                <div>Updated: ${formatDate(appDetails.appVerUpdatedAt)}</div>
                <div>Added: ${ appDetails.appVerUpdatedAt > appDetails.firstPublishedAt 
                    ? formatDate(appDetails.firstPublishedAt)
                    : formatDate(appDetails.appVerUpdatedAt) }</div>
            </div>
            
            <div class="mt-4 flex justify-between items-center">
                <button class="download-btn" onclick="downloadApp(${appDetails.appId})">Download</button>
                <span class="version-history-btn" onclick="showVersionHistory(${appDetails.appId})">Version History</span>
            </div>
        `
    });
}

async function showVersionHistory(appId) {
    ModalManager.show('versionModal', 'versionHistory', '<div class="text-center p-4"><p class="text-gray-600">Loading version history...</p></div>');
    
    try {
        const response = await fetch(`https://backapi.rustore.ru/applicationData/allAppVersionWhatsNew/${appId}`);
        const data = await response.json();
        
        if (data.code === 'OK') {
            const versions = data.body.content;
            document.getElementById('versionHistory').innerHTML = versions.length ? 
                versions.map(v => `
                    <div class="border-b pb-4">
                        <div class="font-bold">Version ${v.versionName}</div>
                        <div class="text-sm text-gray-600">${formatDate(v.appVerUpdatedAt)}</div>
                        <div class="mt-2">${v.whatsNew}</div>
                    </div>
                `).join('') : 
                '<div class="text-center p-4"><p class="text-gray-600">No version history available</p></div>';
        }
    } catch (error) {
        console.error('Error fetching version history:', error);
        ModalManager.showError('versionHistory', 'Unable to load version history', 'Please try again later');
    }
}

async function downloadApp(appId) {
    ModalManager.show('downloadModal', 'downloadResults', '<div class="text-center p-4"><p class="text-gray-600">Obtaining download link...</p></div>');

    try {
        const response = await fetch('https://backapi.rustore.ru/applicationData/v2/download-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId })
        });
        
        const data = await response.json();
        if (data.code === 'OK') {
            document.getElementById('downloadResults').innerHTML = JSON.stringify(data, null, 4).replace(
                /(https?:\/\/[^\s"]+)/g,
                '<a href="$1" class="text-blue-500 hover:text-blue-700 underline" rel="noopener" download>$1</a>'
            );
        }
    } catch (error) {
        console.error('Error downloading app:', error);
        ModalManager.showError('downloadResults', 'Unable to obtain download URLs', 'Please try again');
    }
}

function showDescription(appName, description) {
    const modal = document.getElementById('descriptionModal');
    const content = document.getElementById('descriptionContent');
    
    // Set the app name as the modal title
    modal.querySelector('h2').textContent = `${appName} - Description`;
    
    // Set the description content
    content.textContent = description;
    
    // Show the modal
    modal.classList.remove('hidden');
    modal.classList.add('show');
}

// Image Preview functions
function openPreview(imageUrl, event) {
    const modal = document.getElementById('imagePreviewModal');
    const currentCard = event.target.closest('.app-card');
    const screenshots = Array.from(currentCard.querySelectorAll('.screenshots-container img'));
    
    state.images = screenshots.map(img => img.src);
    state.imageIndex = state.images.indexOf(imageUrl);
    
    document.getElementById('previewImage').src = imageUrl;
    modal.classList.remove('hidden');
    modal.classList.add('show');
    modal.focus();
    modal.setAttribute('tabindex', '0');
    
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const prevButton = document.getElementById('prevImage');
    const nextButton = document.getElementById('nextImage');
    const progressIndicator = document.getElementById('imageProgress');
    
    prevButton.style.display = state.imageIndex > 0 ? 'block' : 'none';
    nextButton.style.display = state.imageIndex < state.images.length - 1 ? 'block' : 'none';
    progressIndicator.textContent = `${state.imageIndex + 1} / ${state.images.length}`;
}

function navigateImage(direction) {
    if (direction === 'prev' && state.imageIndex > 0) {
        state.imageIndex--;
    } else if (direction === 'next' && state.imageIndex < state.images.length - 1) {
        state.imageIndex++;
    }
    
    document.getElementById('previewImage').src = state.images[state.imageIndex];
    updateNavigationButtons();
}

function closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    modal.classList.add('hidden');
    modal.classList.remove('show');
    modal.removeAttribute('tabindex');
    state.images = [];
    state.imageIndex = 0;
    document.getElementById('imageProgress').textContent = '';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearch');
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchApps(e.target.value), 500);
        
        // Show/hide clear button based on input value
        clearButton.classList.toggle('hidden', !e.target.value);
    });

    // Clear input and hide button when clicked
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        clearButton.classList.add('hidden');
        searchInput.focus();
        // Clear the search results immediately
        document.getElementById('searchResults').innerHTML = '';
        // Reset the state
        state.reset();
        state.query = '';
        state.isLoading = false;
    });
    
    // Modal event listeners
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.onclick = () => {
            const modal = closeBtn.closest('.modal');
            const contentId = modal.querySelector('[id]').id;
            if (modal.id === 'imagePreviewModal') {
                closeImagePreview();
            } else {
                ModalManager.hide(modal.id, contentId);
            }
        };
    });
    
    // Image navigation
    document.getElementById('prevImage').onclick = () => navigateImage('prev');
    document.getElementById('nextImage').onclick = () => navigateImage('next');
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!document.getElementById('imagePreviewModal').classList.contains('hidden')) {
            if (['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'ArrowLeft') navigateImage('prev');
                else if (e.key === 'ArrowRight') navigateImage('next');
                else if (e.key === 'Escape') closeImagePreview();
            }
        }
    });
    
    // Modal backdrop clicks
    window.onclick = e => {
        if (e.target.classList.contains('modal')) {
            if (e.target.id === 'imagePreviewModal') {
                closeImagePreview();
            } else {
                const contentId = e.target.querySelector('[id]').id;
                ModalManager.hide(e.target.id, contentId);
            }
        }
    };

    // Infinite scroll
    window.addEventListener('scroll', () => {
        if (state.isLoading || !state.hasMorePages) return;
        const scrollPosition = window.innerHeight + window.scrollY;
        const pageHeight = document.documentElement.scrollHeight;
        if (scrollPosition >= pageHeight - 200) {
            searchApps(state.query, true);
        }
    });
});