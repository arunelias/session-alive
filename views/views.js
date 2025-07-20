const themeSwitch = document.getElementById('themeSwitch');

/**
 * Applies the specified theme to the document.
 * @param {boolean} isDark - Whether to apply the dark theme (true) or light theme (false).
 */
function applyTheme(isDark) {
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
    themeSwitch.checked = isDark;
}

/**
 * Initializes the theme based on system preferences.
 */
function initializeTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    applyTheme(e.matches);
});

// Handle manual theme switch
themeSwitch.addEventListener('change', () => {
    applyTheme(themeSwitch.checked);
});

// Initialize theme on load
initializeTheme();

// Handle Nav click
const headerOffset = 70; // Height of sticky header
const navItems = document.querySelectorAll('#helpNav .nav-item');

// Handle nav item clicks
document.getElementById('helpNav').addEventListener('click', function (e) {
    const navItem = e.target.closest('.nav-item');
    if (navItem) {
        // Get target section
        const sectionId = navItem.dataset.section;
        const targetSection = document.getElementById(sectionId);

        if (targetSection) {
            // Calculate position adjusted for header offset
            const elementPosition = targetSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            // Smooth scroll to offset position
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
        // Update active nav item
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });
    }
});

// Translate
translate();