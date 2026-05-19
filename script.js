document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('lang-toggle-btn');
    
    // Check local storage for language preference, default to 'ko'
    let currentLang = localStorage.getItem('siteLang') || 'ko';
    
    function applyLanguage(lang) {
        const elements = document.querySelectorAll('[data-ko]');
        
        elements.forEach(el => {
            if (lang === 'ko' && el.dataset.ko) {
                el.innerHTML = el.dataset.ko;
            } else if (lang === 'en' && el.dataset.en) {
                el.innerHTML = el.dataset.en;
            }
        });

        if (toggleBtn) {
            toggleBtn.textContent = lang === 'ko' ? 'English' : '한국어';
        }
    }

    // Apply language on load
    applyLanguage(currentLang);

    // Toggle button click event
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            currentLang = currentLang === 'ko' ? 'en' : 'ko';
            localStorage.setItem('siteLang', currentLang);
            applyLanguage(currentLang);
        });
    }
});
