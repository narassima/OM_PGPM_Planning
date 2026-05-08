let papersFetched = false;

window.fetchArxivPapers = async function() {
    if (papersFetched) return;
    
    const loadingDiv = document.getElementById('papers-loading');
    const gridDiv = document.getElementById('dynamic-papers-grid');
    
    try {
        loadingDiv.style.display = 'block';
        gridDiv.style.display = 'none';
        
        const cacheKey = 'om_arxiv_cache';
        const cacheTimeKey = 'om_arxiv_cache_time';
        const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms
        
        const now = Date.now();
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(cacheTimeKey);
        
        let papersHTML = '';

        if (cachedData && cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION) {
            // Use cached data
            papersHTML = cachedData;
        } else {
            // Fetch 6 recent papers matching Operations Management OR Supply Chain
            const query = 'all:"supply chain" OR all:"operations management"';
            const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=6&sortBy=submittedDate&sortOrder=descending`;
            
            const response = await fetch(url);
            const text = await response.text();
            
            // Parse XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const entries = xmlDoc.getElementsByTagName('entry');
            
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const title = entry.getElementsByTagName('title')[0].textContent.replace(/\n/g, ' ').trim();
                const summary = entry.getElementsByTagName('summary')[0].textContent.substring(0, 150).replace(/\n/g, ' ').trim() + '...';
                const link = entry.getElementsByTagName('id')[0].textContent;
                
                // Extract primary author
                let authorName = "Unknown";
                const authors = entry.getElementsByTagName('author');
                if (authors.length > 0) {
                    authorName = authors[0].getElementsByTagName('name')[0].textContent;
                }
                if (authors.length > 1) {
                    authorName += " et al.";
                }
                
                // Extract date
                const published = new Date(entry.getElementsByTagName('published')[0].textContent);
                const dateStr = published.toLocaleDateString();

                papersHTML += `
                    <div class="resource-card">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <h3 style="font-size: 1.1rem; line-height: 1.4; margin: 0; color: var(--text-primary);"><i data-lucide="file-text" style="color: var(--accent-purple); flex-shrink: 0;"></i> ${title}</h3>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px; font-weight: 500;">
                            ${authorName} • ${dateStr}
                        </div>
                        <p style="font-size: 0.9rem;">${summary}</p>
                        <a href="${link}" target="_blank">Read Paper <i data-lucide="external-link" style="width: 14px; height: 14px;"></i></a>
                    </div>
                `;
            }
            
            // Save to cache
            localStorage.setItem(cacheKey, papersHTML);
            localStorage.setItem(cacheTimeKey, now.toString());
        }
        
        gridDiv.innerHTML = papersHTML;
        lucide.createIcons();
        loadingDiv.style.display = 'none';
        gridDiv.style.display = 'grid';
        papersFetched = true;
        
    } catch (err) {
        console.error("Error fetching ArXiv papers:", err);
        loadingDiv.innerHTML = `<p style="color: var(--accent-red);"><i data-lucide="alert-triangle"></i> Failed to load live papers. Please check your internet connection.</p>`;
        lucide.createIcons();
    }
}
