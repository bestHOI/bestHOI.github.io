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

        // Translate placeholders
        const inputs = document.querySelectorAll('[data-ko-placeholder]');
        inputs.forEach(el => {
            if (lang === 'ko' && el.dataset.koPlaceholder) {
                el.setAttribute('placeholder', el.dataset.koPlaceholder);
            } else if (lang === 'en' && el.dataset.enPlaceholder) {
                el.setAttribute('placeholder', el.dataset.enPlaceholder);
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

    // Contact Form handling via EmailJS
    const contactForm = document.getElementById('contact-form');
    const statusDiv = document.getElementById('form-status');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Set loading status
            statusDiv.style.display = 'block';
            statusDiv.className = 'form-status loading';
            statusDiv.textContent = currentLang === 'ko' ? '⏳ 전송 중입니다...' : '⏳ Sending message...';

            const name = document.getElementById('from-name').value;
            const email = document.getElementById('from-email').value;
            const title = document.getElementById('msg-title').value;
            const message = document.getElementById('msg-content').value;

            // Generate time string
            const now = new Date();
            const timeString = now.toLocaleString(currentLang === 'ko' ? 'ko-KR' : 'en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            // Send via EmailJS
            emailjs.send("service_o5yj0lq", "template_m023u8f", {
                name: name,
                email: email,
                title: title,
                message: message,
                time: timeString
            })
            .then(() => {
                statusDiv.className = 'form-status success';
                statusDiv.textContent = currentLang === 'ko' ? '✅ 문의가 성공적으로 전송되었습니다!' : '✅ Your message was sent successfully!';
                contactForm.reset();
            })
            .catch((error) => {
                console.error('EmailJS Error:', error);
                statusDiv.className = 'form-status error';
                statusDiv.textContent = currentLang === 'ko' ? '❌ 전송에 실패했습니다. 다시 시도해 주세요.' : '❌ Failed to send message. Please try again.';
            });
        });
    }

    // Educational Notice Modal handling
    const modal = document.getElementById('notice-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    if (modal && modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        });
    }
});
