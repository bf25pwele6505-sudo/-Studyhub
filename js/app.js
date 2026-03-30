const STORAGE_KEY_PREFIX = 'studyhub_subjects_sem_';
const PROFILE_STORAGE_KEY = 'studyhub_profile_local';

function getSemesterIdFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        const semesterId = Number.parseInt(params.get('semester'), 10);
        return Number.isFinite(semesterId) && semesterId > 0 ? semesterId : 1;
    } catch (error) {
        return 1;
    }
}

function getSubjectIdFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        const subjectId = Number.parseInt(params.get('subject'), 10);
        return Number.isFinite(subjectId) && subjectId > 0 ? subjectId : 1;
    } catch (error) {
        return 1;
    }
}

function normalizeTextCollection(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
}

function normalizeResourceItem(item, allowedTypes) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const type = typeof item.type === 'string' ? item.type.trim().toLowerCase() : 'link';
    const safeType = allowedTypes.includes(type) ? type : 'link';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!title || !url) {
        return null;
    }

    return {
        type: safeType,
        title,
        url,
        source: item.source === 'file' ? 'file' : 'link',
        fileName: typeof item.fileName === 'string' ? item.fileName.trim() : ''
    };
}

function normalizeLectures(lectures, legacyNotes) {
    const safeLectures = Array.isArray(lectures) ? lectures : [];
    const normalizedLectures = safeLectures
        .map((lecture) => {
            if (!lecture || typeof lecture !== 'object') {
                return null;
            }

            const title = typeof lecture.title === 'string' ? lecture.title.trim() : '';
            if (!title) {
                return null;
            }

            const resources = Array.isArray(lecture.resources)
                ? lecture.resources
                    .map((resource) => normalizeResourceItem(resource, ['pdf', 'document', 'video', 'link']))
                    .filter(Boolean)
                : [];

            return {
                title,
                resources
            };
        })
        .filter(Boolean);

    if (normalizedLectures.length > 0) {
        return normalizedLectures;
    }

    return normalizeTextCollection(legacyNotes).map((noteTitle) => ({
        title: noteTitle,
        resources: []
    }));
}

function normalizeStructuredItems(items, legacyItems) {
    const safeItems = Array.isArray(items) ? items : [];
    const normalizedItems = safeItems
        .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }

            const title = typeof entry.title === 'string' ? entry.title.trim() : '';
            if (!title) {
                return null;
            }

            const resources = Array.isArray(entry.resources)
                ? entry.resources
                    .map((resource) => normalizeResourceItem(resource, ['pdf', 'document', 'video', 'link']))
                    .filter(Boolean)
                : [];

            return {
                title,
                resources
            };
        })
        .filter(Boolean);

    if (normalizedItems.length > 0) {
        return normalizedItems;
    }

    return normalizeTextCollection(legacyItems).map((title) => ({
        title,
        resources: []
    }));
}

function normalizeSubject(subject, index) {
    const safeIndex = index + 1;
    const normalizedBooks = Array.isArray(subject && subject.books)
        ? subject.books
            .map((book) => normalizeResourceItem(book, ['pdf', 'document', 'link']))
            .filter(Boolean)
        : [];

    return {
        code: subject && subject.code ? subject.code : `SUBJ${String(safeIndex).padStart(3, '0')}`,
        name: subject && subject.name ? subject.name : `Subject ${safeIndex}`,
        details: subject && subject.details ? subject.details : '',
        credit_hours: subject && Number.isFinite(subject.credit_hours) ? subject.credit_hours : 0,
        contact_hours: subject && Number.isFinite(subject.contact_hours) ? subject.contact_hours : 0,
        final_marks: subject && Number.isFinite(subject.final_marks) ? subject.final_marks : 0,
        books: normalizedBooks,
        lectures: normalizeLectures(subject && subject.lectures, subject && subject.notes),
        assignments: normalizeStructuredItems(subject && subject.assignments, subject && subject.assignments),
        quizzes: normalizeStructuredItems(subject && subject.quizzes, subject && subject.quizzes)
    };
}

function getLocalBackup(semesterId) {
    try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${semesterId}`);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('Unable to read local backup', error);
        return null;
    }
}

async function loadStudyData() {
    const sources = ['/api/data', 'data/data.json'];

    for (const source of sources) {
        try {
            const response = await fetch(source, { cache: 'no-store' });
            if (!response.ok) {
                continue;
            }

            return await response.json();
        } catch (error) {
            console.warn(`Failed to load ${source}`, error);
        }
    }

    return null;
}

function showSaveToast(message) {
    let toast = document.getElementById('save-status');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'save-status';
        toast.style.position = 'fixed';
        toast.style.right = '18px';
        toast.style.bottom = '18px';
        toast.style.padding = '8px 12px';
        toast.style.borderRadius = '10px';
        toast.style.background = 'linear-gradient(90deg,#2b6cb0,#06b6d4)';
        toast.style.color = '#fff';
        toast.style.boxShadow = '0 8px 26px rgba(2,6,23,0.16)';
        toast.style.transition = 'opacity 0.2s ease';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    window.setTimeout(() => {
        toast.style.opacity = '0';
    }, 1800);
}

function normalizeProfile(profile) {
    const safe = profile && typeof profile === 'object' ? profile : {};
    const safeString = (value) => (typeof value === 'string' ? value.trim() : '');
    return {
        name: safeString(safe.name),
        father_name: safeString(safe.father_name),
        registration_no: safeString(safe.registration_no),
        section: safeString(safe.section),
        department: safeString(safe.department)
    };
}

function getLocalProfileBackup() {
    try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        return normalizeProfile(JSON.parse(raw));
    } catch (error) {
        console.warn('Unable to read local profile backup', error);
        return null;
    }
}

function setLocalProfileBackup(profile) {
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalizeProfile(profile)));
    } catch (error) {
        console.warn('Unable to save local profile backup', error);
    }
}

function applyProfileToUI(profile) {
    const safe = normalizeProfile(profile);
    const nameElement = document.getElementById('profile-name');
    const fatherNameElement = document.getElementById('profile-father-name');
    const registrationElement = document.getElementById('profile-registration');
    const sectionElement = document.getElementById('profile-section');
    const departmentElement = document.getElementById('profile-department');
    const welcomeNameElement = document.getElementById('welcome-name');

    if (nameElement && safe.name) {
        nameElement.textContent = safe.name;
    }
    if (fatherNameElement && safe.father_name) {
        fatherNameElement.textContent = safe.father_name;
    }
    if (registrationElement && safe.registration_no) {
        registrationElement.textContent = safe.registration_no;
    }
    if (sectionElement && safe.section) {
        sectionElement.textContent = safe.section;
    }
    if (departmentElement && safe.department) {
        departmentElement.textContent = safe.department;
    }
    if (welcomeNameElement && safe.name) {
        welcomeNameElement.textContent = safe.name;
    }
}

(function initProfileEditor() {
    const editButton = document.getElementById('profile-edit-btn');
    const modal = document.getElementById('profile-modal');
    const closeButton = document.getElementById('profile-modal-close');
    const cancelButton = document.getElementById('profile-modal-cancel');
    const form = document.getElementById('profile-form');

    if (!editButton || !modal || !form) {
        return;
    }

    const formName = form.querySelector('input[name="name"]');
    const formFatherName = form.querySelector('input[name="father_name"]');
    const formRegistration = form.querySelector('input[name="registration_no"]');
    const formSection = form.querySelector('input[name="section"]');
    const formDepartment = form.querySelector('textarea[name="department"]');

    let currentProfile = normalizeProfile({
        name: document.getElementById('profile-name')?.textContent || '',
        father_name: document.getElementById('profile-father-name')?.textContent || '',
        registration_no: document.getElementById('profile-registration')?.textContent || '',
        section: document.getElementById('profile-section')?.textContent || '',
        department: document.getElementById('profile-department')?.textContent || ''
    });

    function fillForm(profile) {
        const safe = normalizeProfile(profile);
        if (formName) formName.value = safe.name;
        if (formFatherName) formFatherName.value = safe.father_name;
        if (formRegistration) formRegistration.value = safe.registration_no;
        if (formSection) formSection.value = safe.section;
        if (formDepartment) formDepartment.value = safe.department;
    }

    function openModal() {
        fillForm(currentProfile);
        modal.style.display = 'flex';
        if (formName) {
            formName.focus();
            formName.setSelectionRange(formName.value.length, formName.value.length);
        }
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    async function saveProfile(profile) {
        const safe = normalizeProfile(profile);
        try {
            const latestData = await loadStudyData();
            const payload = {
                semesters: Array.isArray(latestData && latestData.semesters) ? latestData.semesters : [],
                overall_gpa: Number.isFinite(latestData && latestData.overall_gpa)
                    ? latestData.overall_gpa
                    : 0,
                profile: safe
            };

            const response = await fetch('/api/data', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Profile save failed with ${response.status}`);
            }

            setLocalProfileBackup(safe);
            return { ok: true, mode: 'server' };
        } catch (error) {
            console.warn('Profile save failed on server, using local backup', error);
            setLocalProfileBackup(safe);
            return { ok: true, mode: 'local' };
        }
    }

    editButton.addEventListener('click', openModal);

    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const updatedProfile = normalizeProfile({
            name: formName ? formName.value : '',
            father_name: formFatherName ? formFatherName.value : '',
            registration_no: formRegistration ? formRegistration.value : '',
            section: formSection ? formSection.value : '',
            department: formDepartment ? formDepartment.value : ''
        });

        if (!updatedProfile.name) {
            if (formName) {
                formName.focus();
            }
            return;
        }

        const result = await saveProfile(updatedProfile);
        currentProfile = updatedProfile;
        applyProfileToUI(updatedProfile);
        showSaveToast(result.mode === 'server' ? 'Profile saved' : 'Saved locally');
        closeModal();
    });

    loadStudyData()
        .then((data) => {
            if (data && data.profile) {
                currentProfile = normalizeProfile(data.profile);
            }

            const localBackup = getLocalProfileBackup();
            if (localBackup) {
                currentProfile = normalizeProfile({
                    ...currentProfile,
                    ...localBackup
                });
            }

            applyProfileToUI(currentProfile);
        })
        .catch((error) => {
            console.warn('Unable to load profile from API', error);
            const localBackup = getLocalProfileBackup();
            if (localBackup) {
                currentProfile = localBackup;
                applyProfileToUI(currentProfile);
            }
        });
})();

(function initDashboard() {
    const overallGPA = document.querySelector('#overall-gpa p');
    const dashboardGPA = document.getElementById('dash-gpa');

    if (!overallGPA && !dashboardGPA) {
        return;
    }

    loadStudyData()
        .then((data) => {
            if (!data || typeof data.overall_gpa === 'undefined') {
                return;
            }

            if (overallGPA) {
                overallGPA.textContent = data.overall_gpa;
            }

            if (dashboardGPA) {
                dashboardGPA.textContent = data.overall_gpa;
            }
        })
        .catch((error) => {
            console.error('Error loading dashboard data:', error);
        });
})();

(function initTheme() {
    const THEME_KEY = 'studyhub_theme';
    const button = document.getElementById('theme-toggle');

    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('theme-light');
        } else {
            document.body.classList.remove('theme-light');
        }

        if (button) {
            button.textContent = theme === 'light' ? 'Light' : 'Dark';
        }
    }

    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        applyTheme('light');
    } else {
        applyTheme('dark');
    }

    if (button) {
        button.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('theme-light');
            const nextTheme = isLight ? 'light' : 'dark';
            localStorage.setItem(THEME_KEY, nextTheme);
            applyTheme(nextTheme);
        });
    }
})();

(function initSubjectTabs() {
    const tabs = Array.from(document.querySelectorAll('.subject-tab'));
    if (!tabs.length) {
        return;
    }

    function setActive(hash) {
        tabs.forEach((tab) => {
            const href = tab.getAttribute('href') || '';
            tab.classList.toggle('is-active', href === hash);
        });
    }

    const initialHash = window.location.hash || tabs[0].getAttribute('href') || '';
    if (initialHash) {
        setActive(initialHash);
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const hash = tab.getAttribute('href') || '';
            if (hash) {
                setActive(hash);
            }
        });
    });

    window.addEventListener('hashchange', () => {
        if (window.location.hash) {
            setActive(window.location.hash);
        }
    });
})();

(function initSemesterPage() {
    const grid = document.getElementById('subjects-grid');
    const settingsButton = document.getElementById('subjects-settings');
    const menu = document.getElementById('subjects-menu');
    const modal = document.getElementById('subjects-modal');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.getElementById('modal-close');

    if (!grid || !settingsButton || !menu || !modal || !modalBody || !modalClose) {
        return;
    }

    const semesterId = getSemesterIdFromURL();
    const state = {
        semesterName: `Semester ${semesterId}`,
        semesterGPA: 0,
        subjects: []
    };
    let saveTimer = null;

    function formatCount(value, singularLabel, pluralLabel = `${singularLabel}s`) {
        return `${value} ${value === 1 ? singularLabel : pluralLabel}`;
    }

    function getStudyItemCount(subject) {
        return (subject.lectures || []).length + (subject.assignments || []).length + (subject.quizzes || []).length;
    }

    function getSemesterMetrics() {
        return state.subjects.reduce((totals, subject) => {
            totals.subjects += 1;
            totals.creditHours += Number(subject.credit_hours) || 0;
            totals.contactHours += Number(subject.contact_hours) || 0;
            totals.lectures += (subject.lectures || []).length;
            totals.assignments += (subject.assignments || []).length;
            totals.quizzes += (subject.quizzes || []).length;
            return totals;
        }, {
            subjects: 0,
            creditHours: 0,
            contactHours: 0,
            lectures: 0,
            assignments: 0,
            quizzes: 0
        });
    }

    function updateHeader() {
        const pageTitle = document.getElementById('semester-page-title');
        const overviewTitle = document.getElementById('semester-overview-title');
        if (pageTitle) {
            pageTitle.textContent = state.semesterName;
        }

        if (overviewTitle) {
            overviewTitle.textContent = state.semesterName;
        }

        document.title = `StudyHub — ${state.semesterName}`;
    }

    function updateOverview() {
        const metrics = getSemesterMetrics();
        const studyItems = metrics.lectures + metrics.assignments + metrics.quizzes;
        const summaryNote = document.getElementById('semester-overview-note');
        const subjectCount = document.getElementById('semester-subject-count');
        const creditHours = document.getElementById('semester-credit-hours');
        const studyItemCount = document.getElementById('semester-study-items');
        const contactHours = document.getElementById('semester-contact-hours');
        const lectureCount = document.getElementById('semester-lecture-count');
        const assignmentCount = document.getElementById('semester-assignment-count');
        const quizCount = document.getElementById('semester-quiz-count');
        const loadSummary = document.getElementById('semester-load-summary');

        if (summaryNote) {
            summaryNote.textContent = metrics.subjects
                ? `${formatCount(metrics.subjects, 'subject')}, ${metrics.creditHours} credit hours, and ${studyItems} study items are currently mapped for this semester.`
                : 'Track subjects, workload, and performance from one place.';
        }

        if (subjectCount) {
            subjectCount.textContent = String(metrics.subjects);
        }

        if (creditHours) {
            creditHours.textContent = String(metrics.creditHours);
        }

        if (studyItemCount) {
            studyItemCount.textContent = String(studyItems);
        }

        if (contactHours) {
            contactHours.textContent = String(metrics.contactHours);
        }

        if (lectureCount) {
            lectureCount.textContent = String(metrics.lectures);
        }

        if (assignmentCount) {
            assignmentCount.textContent = String(metrics.assignments);
        }

        if (quizCount) {
            quizCount.textContent = String(metrics.quizzes);
        }

        if (loadSummary) {
            loadSummary.textContent = metrics.subjects
                ? `This term currently carries ${metrics.contactHours} contact hours across ${formatCount(metrics.subjects, 'course')}.`
                : 'No course workload has been added yet.';
        }
    }

    function updateGPA() {
        const gpaCard = document.getElementById('semester-gpa');
        if (!gpaCard) {
            return;
        }

        const metrics = getSemesterMetrics();
        const numericGPA = Number(state.semesterGPA) || 0;
        const gpaValue = document.getElementById('semester-gpa-value');
        const badge = document.getElementById('semester-gpa-badge');
        const fill = document.getElementById('semester-gpa-fill');
        const alert = document.getElementById('semester-gpa-alert');
        const alertTitle = gpaCard.querySelector('.alert-title');
        const alertBody = gpaCard.querySelector('.alert-body');

        if (gpaValue) {
            gpaValue.textContent = numericGPA.toFixed(2);
        }

        if (badge) {
            badge.classList.remove('badge-green', 'badge-blue', 'badge-amber', 'badge-red');

            if (!metrics.subjects) {
                badge.textContent = 'Setup Required';
                badge.classList.add('badge-amber');
            } else if (numericGPA >= 3.5) {
                badge.textContent = 'Excellent';
                badge.classList.add('badge-green');
            } else if (numericGPA >= 2.5) {
                badge.textContent = 'On Track';
                badge.classList.add('badge-blue');
            } else if (numericGPA > 0) {
                badge.textContent = 'Needs Attention';
                badge.classList.add('badge-red');
            } else {
                badge.textContent = 'In Progress';
                badge.classList.add('badge-amber');
            }
        }

        if (fill) {
            const normalizedGPA = Math.max(0, Math.min(numericGPA, 4));
            fill.style.width = `${(normalizedGPA / 4) * 100}%`;
        }

        if (alertTitle) {
            if (!metrics.subjects) {
                alertTitle.textContent = 'No subjects yet';
            } else if (numericGPA > 0) {
                alertTitle.textContent = 'GPA updated';
            } else {
                alertTitle.textContent = 'Marks pending';
            }
        }

        if (alertBody) {
            if (!metrics.subjects) {
                alertBody.textContent = 'Add your first subject from the three-dots menu to start tracking this semester.';
            } else if (numericGPA > 0) {
                alertBody.textContent = `The current semester GPA is based on ${formatCount(metrics.subjects, 'subject')} in this term.`;
            } else {
                alertBody.textContent = 'Add subject marks to calculate GPA and compare semester performance.';
            }
        }

        if (alert) {
            alert.classList.remove('alert-warning', 'alert-success', 'alert-info');
            if (!metrics.subjects) {
                alert.classList.add('alert-warning');
            } else if (numericGPA > 0) {
                alert.classList.add('alert-success');
            } else {
                alert.classList.add('alert-info');
            }
        }
    }

    function getSubjectLink(index) {
        return `subject.html?semester=${semesterId}&subject=${index + 1}`;
    }

    function renderSubjectGrid() {
        grid.innerHTML = '';

        if (!state.subjects.length) {
            const empty = document.createElement('div');
            empty.className = 'subjects-empty';
            empty.innerHTML = '<strong>No subjects added yet.</strong><span>Open the three-dots menu to create your first subject for this semester.</span>';
            grid.appendChild(empty);
            updateOverview();
            updateGPA();
            return;
        }

        state.subjects.forEach((subject, index) => {
            const studyItems = getStudyItemCount(subject);
            const card = document.createElement('article');
            card.className = 'subject-card';
            card.setAttribute('role', 'listitem');

            const top = document.createElement('div');
            top.className = 'subject-card-top';

            const codeChip = document.createElement('span');
            codeChip.className = 'subject-code-chip';
            codeChip.textContent = subject.code;

            const itemChip = document.createElement('span');
            itemChip.className = 'subject-item-chip';
            itemChip.textContent = formatCount(studyItems, 'item');

            top.appendChild(codeChip);
            top.appendChild(itemChip);

            const body = document.createElement('div');
            body.className = 'subject-card-body';

            const link = document.createElement('a');
            link.className = 'subject-title-link';
            link.href = getSubjectLink(index);
            link.textContent = subject.name;
            link.setAttribute('aria-label', `Open ${subject.name}`);

            const details = document.createElement('p');
            details.className = 'subject-details';
            details.textContent = subject.details || 'No subject details added yet.';

            body.appendChild(link);
            body.appendChild(details);

            const stats = document.createElement('div');
            stats.className = 'subject-stat-grid';

            [
                { label: 'Credit Hours', value: String(Number(subject.credit_hours) || 0) },
                { label: 'Contact Hours', value: String(Number(subject.contact_hours) || 0) },
                { label: 'Final Marks', value: String(Number(subject.final_marks) || 0) },
                { label: 'Lectures', value: String((subject.lectures || []).length) }
            ].forEach((entry) => {
                const stat = document.createElement('div');
                stat.className = 'subject-stat';

                const label = document.createElement('span');
                label.className = 'subject-stat-label';
                label.textContent = entry.label;

                const value = document.createElement('strong');
                value.className = 'subject-stat-value';
                value.textContent = entry.value;

                stat.appendChild(label);
                stat.appendChild(value);
                stats.appendChild(stat);
            });

            const footer = document.createElement('div');
            footer.className = 'subject-card-footer';

            const caption = document.createElement('span');
            caption.className = 'subject-card-caption';
            caption.textContent = `${formatCount((subject.assignments || []).length, 'assignment')} and ${formatCount((subject.quizzes || []).length, 'quiz', 'quizzes')}`;

            const cta = document.createElement('a');
            cta.className = 'subject-open-link';
            cta.href = getSubjectLink(index);
            cta.textContent = 'Open workspace';
            cta.setAttribute('aria-label', `Open ${subject.name} workspace`);

            footer.appendChild(caption);
            footer.appendChild(cta);

            card.appendChild(top);
            card.appendChild(body);
            card.appendChild(stats);
            card.appendChild(footer);
            grid.appendChild(card);
        });

        updateOverview();
        updateGPA();
    }

    function toggleMenu(show) {
        menu.style.display = show ? 'block' : 'none';
        settingsButton.setAttribute('aria-expanded', show ? 'true' : 'false');
        menu.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    function openModal() {
        renderModal();
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }

    function persistLocalBackup() {
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${semesterId}`,
            JSON.stringify({ subjects: state.subjects })
        );
    }

    async function saveSubjects() {
        const payload = {
            subjects: state.subjects.map((subject, index) => normalizeSubject(subject, index))
        };

        try {
            const response = await fetch(`/api/semesters/${semesterId}/subjects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Save failed with ${response.status}`);
            }

            localStorage.removeItem(`${STORAGE_KEY_PREFIX}${semesterId}`);
            showSaveToast('Subjects saved');
        } catch (error) {
            console.warn('Save failed, using local backup instead', error);
            persistLocalBackup();
            showSaveToast('Saved locally');
        }
    }

    function scheduleSave() {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            saveSubjects();
        }, 500);
    }

    function addSubject(name, details) {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return false;
        }

        state.subjects.push(normalizeSubject({ name: trimmedName, details: details.trim() }, state.subjects.length));
        renderSubjectGrid();
        renderModal();
        scheduleSave();
        return true;
    }

    function updateSubject(index, name, details) {
        const trimmedName = name.trim();
        if (!trimmedName || !state.subjects[index]) {
            return false;
        }

        state.subjects[index] = {
            ...state.subjects[index],
            name: trimmedName,
            details: details.trim()
        };

        renderSubjectGrid();
        renderModal();
        scheduleSave();
        return true;
    }

    function deleteSubject(index) {
        if (!state.subjects[index]) {
            return;
        }

        state.subjects.splice(index, 1);
        state.subjects = state.subjects.map((subject, currentIndex) => normalizeSubject(subject, currentIndex));
        renderSubjectGrid();
        renderModal();
        scheduleSave();
    }

    function createActionButton(label, action, index, modifierClass) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.index = String(index);
        if (modifierClass) {
            button.classList.add(modifierClass);
        }
        return button;
    }

    function renderModal() {
        modalBody.innerHTML = '';

        const addPanel = document.createElement('section');
        addPanel.className = 'subject-manager-section';

        const addTitle = document.createElement('h4');
        addTitle.className = 'manager-heading';
        addTitle.textContent = 'Add subject';

        const addForm = document.createElement('form');
        addForm.id = 'subject-add-form';
        addForm.className = 'subject-form';
        addForm.innerHTML = `
            <input class="subject-input" name="name" type="text" placeholder="Subject name" maxlength="80" required>
            <textarea class="subject-textarea" name="details" rows="3" placeholder="Subject details"></textarea>
            <div class="subject-form-actions">
                <button class="btn btn-primary btn-sm" type="submit">Add Subject</button>
            </div>
        `;

        addPanel.appendChild(addTitle);
        addPanel.appendChild(addForm);
        modalBody.appendChild(addPanel);

        const listPanel = document.createElement('section');
        listPanel.className = 'subject-manager-section';

        const listTitle = document.createElement('h4');
        listTitle.className = 'manager-heading';
        listTitle.textContent = 'Current subjects';
        listPanel.appendChild(listTitle);

        if (!state.subjects.length) {
            const emptyState = document.createElement('div');
            emptyState.className = 'manage-empty';
            emptyState.textContent = 'No subjects added yet.';
            listPanel.appendChild(emptyState);
            modalBody.appendChild(listPanel);
            return;
        }

        state.subjects.forEach((subject, index) => {
            const row = document.createElement('form');
            row.className = 'manage-row manage-row-form';
            row.dataset.index = String(index);

            const fields = document.createElement('div');
            fields.className = 'manage-fields';

            const nameInput = document.createElement('input');
            nameInput.className = 'subject-input';
            nameInput.name = 'name';
            nameInput.type = 'text';
            nameInput.required = true;
            nameInput.maxLength = 80;
            nameInput.value = subject.name;

            const detailsInput = document.createElement('textarea');
            detailsInput.className = 'subject-textarea';
            detailsInput.name = 'details';
            detailsInput.rows = 3;
            detailsInput.value = subject.details || '';

            const codeLabel = document.createElement('div');
            codeLabel.className = 'manage-code';
            codeLabel.textContent = subject.code;

            fields.appendChild(nameInput);
            fields.appendChild(detailsInput);
            fields.appendChild(codeLabel);

            const actions = document.createElement('div');
            actions.className = 'row-actions';
            actions.appendChild(createActionButton('Save', 'save', index, 'primary'));
            actions.appendChild(createActionButton('Delete', 'delete', index));

            row.appendChild(fields);
            row.appendChild(actions);
            listPanel.appendChild(row);
        });

        modalBody.appendChild(listPanel);
    }

    modalBody.addEventListener('submit', (event) => {
        event.preventDefault();

        if (event.target.id === 'subject-add-form') {
            const formData = new FormData(event.target);
            const added = addSubject(
                String(formData.get('name') || ''),
                String(formData.get('details') || '')
            );

            if (added) {
                event.target.reset();
            }

            return;
        }

        const row = event.target.closest('.manage-row-form');
        if (!row) {
            return;
        }

        const index = Number.parseInt(row.dataset.index || '-1', 10);
        const formData = new FormData(row);
        updateSubject(index, String(formData.get('name') || ''), String(formData.get('details') || ''));
    });

    modalBody.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const index = Number.parseInt(button.dataset.index || '-1', 10);
        if (button.dataset.action === 'save' && index >= 0) {
            const row = button.closest('.manage-row-form');
            if (!row) {
                return;
            }

            const formData = new FormData(row);
            updateSubject(index, String(formData.get('name') || ''), String(formData.get('details') || ''));
            return;
        }

        if (button.dataset.action === 'delete' && index >= 0 && state.subjects[index]) {
            const confirmed = window.confirm(`Delete "${state.subjects[index].name}"?`);
            if (confirmed) {
                deleteSubject(index);
            }
        }
    });

    settingsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMenu(menu.style.display !== 'block');
    });

    menu.addEventListener('click', (event) => {
        const action = event.target.getAttribute('data-action');
        toggleMenu(false);

        if (action === 'add') {
            openModal();
            const addInput = modalBody.querySelector('#subject-add-form input[name="name"]');
            if (addInput) {
                addInput.focus();
            }
        }

        if (action === 'manage') {
            openModal();
        }
    });

    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('click', () => {
        toggleMenu(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            toggleMenu(false);
            closeModal();
        }
    });

    async function loadSemesterState() {
        const data = await loadStudyData();
        const semester = data && Array.isArray(data.semesters)
            ? data.semesters.find((entry) => entry.id === semesterId)
            : null;
        const localBackup = getLocalBackup(semesterId);

        if (semester) {
            state.semesterName = semester.name || state.semesterName;
            state.semesterGPA = semester.semester_gpa || 0;
            state.subjects = Array.isArray(semester.subjects)
                ? semester.subjects.map((subject, index) => normalizeSubject(subject, index))
                : [];
        }

        if (localBackup && Array.isArray(localBackup.subjects)) {
            state.subjects = localBackup.subjects.map((subject, index) => normalizeSubject(subject, index));
        }

        updateHeader();
        renderSubjectGrid();
        renderModal();
    }

    loadSemesterState().catch((error) => {
        console.error('Failed to load semester data:', error);
        updateHeader();
        renderSubjectGrid();
        renderModal();
    });
})();

(function initSubjectPage() {
    const title = document.getElementById('subject-title');
    if (!title) {
        return;
    }

    const semesterId = getSemesterIdFromURL();
    const subjectId = getSubjectIdFromURL();
    const subjectIndex = Math.max(subjectId - 1, 0);
    const semesterLink = document.querySelector('.navbar-actions a[href="semester.html"]');
    const booksSection = document.getElementById('books-list');
    const booksSettingsButton = document.getElementById('books-settings');
    const booksMenu = document.getElementById('books-menu');
    const booksModal = document.getElementById('books-modal');
    const booksModalBody = document.getElementById('books-modal-body');
    const booksModalClose = document.getElementById('books-modal-close');
    const lecturesSection = document.getElementById('lectures-list');
    const lecturesSettingsButton = document.getElementById('lectures-settings');
    const lecturesMenu = document.getElementById('lectures-menu');
    const lecturesModal = document.getElementById('lectures-modal');
    const lecturesModalBody = document.getElementById('lectures-modal-body');
    const lecturesModalClose = document.getElementById('lectures-modal-close');
    const assignmentsSection = document.getElementById('assignments-list');
    const assignmentsSettingsButton = document.getElementById('assignments-settings');
    const assignmentsMenu = document.getElementById('assignments-menu');
    const assignmentsModal = document.getElementById('assignments-modal');
    const assignmentsModalBody = document.getElementById('assignments-modal-body');
    const assignmentsModalClose = document.getElementById('assignments-modal-close');
    const quizzesSection = document.getElementById('quizzes-list');
    const quizzesSettingsButton = document.getElementById('quizzes-settings');
    const quizzesMenu = document.getElementById('quizzes-menu');
    const quizzesModal = document.getElementById('quizzes-modal');
    const quizzesModalBody = document.getElementById('quizzes-modal-body');
    const quizzesModalClose = document.getElementById('quizzes-modal-close');
    let saveTimer = null;
    const state = {
        subjects: []
    };
    const managedCollections = [];
    const structuredCollections = [
        {
            key: 'assignments',
            noun: 'assignment',
            title: 'Assignments',
            emptyText: 'No assignments added yet. Add an assignment and attach resources from the menu.',
            section: assignmentsSection,
            menuButton: assignmentsSettingsButton,
            menu: assignmentsMenu,
            modal: assignmentsModal,
            modalBody: assignmentsModalBody,
            modalClose: assignmentsModalClose
        },
        {
            key: 'quizzes',
            noun: 'quiz',
            title: 'Quizzes',
            emptyText: 'No quizzes added yet. Add a quiz and attach resources from the menu.',
            section: quizzesSection,
            menuButton: quizzesSettingsButton,
            menu: quizzesMenu,
            modal: quizzesModal,
            modalBody: quizzesModalBody,
            modalClose: quizzesModalClose
        }
    ];

    if (semesterLink) {
        semesterLink.href = `semester.html?semester=${semesterId}`;
    }

    function persistLocalBackup() {
        localStorage.setItem(
            `${STORAGE_KEY_PREFIX}${semesterId}`,
            JSON.stringify({ subjects: state.subjects })
        );
    }

    async function saveSubjects() {
        const payload = {
            subjects: state.subjects.map((subject, index) => normalizeSubject(subject, index))
        };

        try {
            const response = await fetch(`/api/semesters/${semesterId}/subjects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Save failed with ${response.status}`);
            }

            localStorage.removeItem(`${STORAGE_KEY_PREFIX}${semesterId}`);
            showSaveToast('Subject updated');
        } catch (error) {
            console.warn('Save failed, using local backup instead', error);
            persistLocalBackup();
            showSaveToast('Saved locally');
        }
    }

    function scheduleSave() {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            saveSubjects();
        }, 500);
    }

    function getCurrentSubject() {
        if (!state.subjects[subjectIndex]) {
            state.subjects[subjectIndex] = normalizeSubject({
                name: `Subject ${subjectId}`,
                details: 'Subject details are not available yet.'
            }, subjectIndex);
        }

        return state.subjects[subjectIndex];
    }

    function setBadgeCount(sectionId, count) {
        const section = document.getElementById(sectionId);
        const badge = section ? section.querySelector('.badge') : null;
        if (badge) {
            badge.textContent = `${count} item${count === 1 ? '' : 's'}`;
        }
    }

    function renderList(sectionId, items, emptyText) {
        const section = document.getElementById(sectionId);
        const list = section ? section.querySelector('ul') : null;
        if (!section || !list) {
            return;
        }

        list.innerHTML = '';
        const safeItems = Array.isArray(items) ? items : [];
        setBadgeCount(sectionId, safeItems.length);

        if (!safeItems.length) {
            const li = document.createElement('li');
            li.textContent = emptyText;
            list.appendChild(li);
            return;
        }

        safeItems.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
    }

    function typeLabel(type) {
        if (type === 'pdf') {
            return 'PDF';
        }

        if (type === 'document') {
            return 'Document';
        }

        if (type === 'video') {
            return 'Video';
        }

        return 'Link';
    }

    function sourceLabel(source) {
        return source === 'file' ? 'PC file' : 'Link';
    }

    function lectureCountLabel(count) {
        return `${count} resource${count === 1 ? '' : 's'}`;
    }

    function getSubjectResourceMetrics(subject) {
        const safeSubject = normalizeSubject(subject, subjectIndex);
        const books = Array.isArray(safeSubject.books) ? safeSubject.books : [];
        const lectures = Array.isArray(safeSubject.lectures) ? safeSubject.lectures : [];
        const assignments = Array.isArray(safeSubject.assignments) ? safeSubject.assignments : [];
        const quizzes = Array.isArray(safeSubject.quizzes) ? safeSubject.quizzes : [];
        const linkedCollections = [...lectures, ...assignments, ...quizzes];

        const collectionResources = linkedCollections.reduce((totals, item) => {
            const resources = Array.isArray(item.resources) ? item.resources : [];
            totals.total += resources.length;
            totals.files += resources.filter((resource) => resource.source === 'file').length;
            totals.links += resources.filter((resource) => resource.source !== 'file').length;
            return totals;
        }, { total: 0, files: 0, links: 0 });

        const bookFiles = books.filter((book) => book.source === 'file').length;
        const bookLinks = books.filter((book) => book.source !== 'file').length;

        return {
            books: books.length,
            lectures: lectures.length,
            assignments: assignments.length,
            quizzes: quizzes.length,
            resourceCount: books.length + collectionResources.total,
            resourceFiles: bookFiles + collectionResources.files,
            resourceLinks: bookLinks + collectionResources.links,
            studyUnits: lectures.length + assignments.length + quizzes.length,
            creditHours: Number(safeSubject.credit_hours) || 0,
            contactHours: Number(safeSubject.contact_hours) || 0,
            finalMarks: Number(safeSubject.final_marks) || 0
        };
    }

    function toggleDropdown(menuElement, triggerElement, show) {
        if (!menuElement || !triggerElement) {
            return;
        }

        menuElement.style.display = show ? 'block' : 'none';
        triggerElement.setAttribute('aria-expanded', show ? 'true' : 'false');
        menuElement.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    function closeCollectionModal(config) {
        if (!config.modal) {
            return;
        }

        config.modal.style.display = 'none';
        config.modal.setAttribute('aria-hidden', 'true');
    }

    function openCollectionModal(config) {
        if (!config.modal) {
            return;
        }

        renderStructuredModal(config);
        config.modal.style.display = 'flex';
        config.modal.setAttribute('aria-hidden', 'false');
    }

    function closeAllCollectionMenus() {
        managedCollections.forEach((config) => {
            toggleDropdown(config.menu, config.menuButton, false);
        });
    }

    function closeAllCollectionModals() {
        managedCollections.forEach((config) => {
            closeCollectionModal(config);
        });
    }

    function closeAllStructuredMenus() {
        structuredCollections.forEach((config) => {
            toggleDropdown(config.menu, config.menuButton, false);
        });
    }

    function closeAllStructuredModals() {
        structuredCollections.forEach((config) => {
            closeCollectionModal(config);
        });
    }

    function renderStructuredSection(config) {
        if (!config.section) {
            return;
        }

        const list = config.section.querySelector('ul');
        if (!list) {
            return;
        }

        const subject = getCurrentSubject();
        const items = Array.isArray(subject[config.key]) ? subject[config.key] : [];
        list.innerHTML = '';

        if (!items.length) {
            const li = document.createElement('li');
            li.className = 'book-item-empty';
            li.textContent = config.emptyText;
            list.appendChild(li);
            return;
        }

        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'lecture-item';

            const titleElement = document.createElement('strong');
            titleElement.className = 'lecture-title';
            titleElement.textContent = item.title;

            const meta = document.createElement('span');
            meta.className = 'book-type';
            meta.textContent = lectureCountLabel(Array.isArray(item.resources) ? item.resources.length : 0);

            li.appendChild(titleElement);
            li.appendChild(meta);
            list.appendChild(li);
        });
    }

    function renderStructuredModal(config) {
        if (!config.modalBody) {
            return;
        }

        const subject = getCurrentSubject();
        const items = Array.isArray(subject[config.key]) ? subject[config.key] : [];

        config.modalBody.innerHTML = `
            <section class="subject-manager-section">
                <h4 class="manager-heading">Add ${config.noun}</h4>
                <form id="${config.key}-add-form" class="subject-form" aria-label="Add ${config.noun}">
                    <input class="subject-input" name="itemTitle" type="text" maxlength="120" placeholder="${config.noun.charAt(0).toUpperCase() + config.noun.slice(1)} title" required>
                    <div class="subject-form-actions">
                        <button class="btn btn-primary btn-sm" type="submit">Add ${config.noun.charAt(0).toUpperCase() + config.noun.slice(1)}</button>
                    </div>
                </form>
            </section>
            <section class="subject-manager-section">
                <h4 class="manager-heading">Add ${config.noun} resource</h4>
                <form id="${config.key}-resource-form" class="books-form" aria-label="Add ${config.noun} resource">
                    <select class="subject-input" name="itemIndex" ${items.length ? '' : 'disabled'}>
                        ${items.map((item, index) => `<option value="${index}">${item.title}</option>`).join('')}
                    </select>
                    <div class="books-source-row">
                        <label class="books-source-label" for="${config.key}-source-modal">Source</label>
                        <select class="subject-input" id="${config.key}-source-modal" name="source" aria-label="Resource source" ${items.length ? '' : 'disabled'}>
                            <option value="link">Web link</option>
                            <option value="file">File from PC</option>
                        </select>
                    </div>
                    <div class="books-form-grid lectures-form-grid">
                        <select class="subject-input" name="type" aria-label="Resource type" ${items.length ? '' : 'disabled'}>
                            <option value="pdf">PDF</option>
                            <option value="document">Document</option>
                            <option value="video">Video</option>
                            <option value="link">Link</option>
                        </select>
                        <input class="subject-input" name="title" type="text" maxlength="140" placeholder="Resource title" ${items.length ? 'required' : 'disabled'}>
                        <input class="subject-input" name="url" type="url" placeholder="https://example.com/resource" ${items.length ? 'required' : 'disabled'}>
                        <input class="subject-input books-field-hidden" name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.odt,.mp4,.mkv,.mov,.avi,application/pdf,video/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Upload file from your PC" ${items.length ? '' : 'disabled'}>
                    </div>
                    <div class="subject-form-actions">
                        <button class="btn btn-secondary btn-sm" type="submit" ${items.length ? '' : 'disabled'}>Add Resource</button>
                    </div>
                </form>
            </section>
            <section class="subject-manager-section">
                <h4 class="manager-heading">Current ${config.title.toLowerCase()}</h4>
                <div id="${config.key}-manage-list"></div>
            </section>
        `;

        const listContainer = config.modalBody.querySelector(`#${config.key}-manage-list`);
        if (!listContainer) {
            return;
        }

        if (!items.length) {
            listContainer.innerHTML = `<div class="manage-empty">No ${config.title.toLowerCase()} added yet.</div>`;
            return;
        }

        items.forEach((item, itemIndex) => {
            const row = document.createElement('div');
            row.className = 'manage-row';

            const info = document.createElement('div');
            info.className = 'manage-fields';

            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = item.title;

            const subtitle = document.createElement('div');
            subtitle.className = 'manage-code';
            subtitle.textContent = lectureCountLabel(Array.isArray(item.resources) ? item.resources.length : 0);

            info.appendChild(title);
            info.appendChild(subtitle);

            const actions = document.createElement('div');
            actions.className = 'row-actions';

            const removeItem = document.createElement('button');
            removeItem.type = 'button';
            removeItem.className = 'btn btn-danger btn-sm';
            removeItem.dataset.action = 'remove-structured-item';
            removeItem.dataset.collection = config.key;
            removeItem.dataset.itemIndex = String(itemIndex);
            removeItem.textContent = `Delete ${config.noun.charAt(0).toUpperCase() + config.noun.slice(1)}`;

            actions.appendChild(removeItem);
            row.appendChild(info);
            row.appendChild(actions);
            listContainer.appendChild(row);

            const resources = Array.isArray(item.resources) ? item.resources : [];
            resources.forEach((resource, resourceIndex) => {
                const resourceRow = document.createElement('div');
                resourceRow.className = 'manage-row';

                const resourceInfo = document.createElement('div');
                resourceInfo.className = 'manage-fields';

                const resourceTitle = document.createElement('div');
                resourceTitle.className = 'title';
                resourceTitle.textContent = resource.title;

                const resourceMeta = document.createElement('div');
                resourceMeta.className = 'manage-code';
                resourceMeta.textContent = `${typeLabel(resource.type)} | ${sourceLabel(resource.source)}`;

                resourceInfo.appendChild(resourceTitle);
                resourceInfo.appendChild(resourceMeta);

                const resourceActions = document.createElement('div');
                resourceActions.className = 'row-actions';

                const open = document.createElement('a');
                open.className = 'btn btn-secondary btn-sm';
                open.textContent = 'Open';
                open.href = resource.url;
                open.target = '_blank';
                open.rel = 'noopener noreferrer';
                if (resource.source === 'file' && resource.fileName) {
                    open.download = resource.fileName;
                }

                const removeResource = document.createElement('button');
                removeResource.type = 'button';
                removeResource.className = 'btn btn-danger btn-sm';
                removeResource.dataset.action = 'remove-structured-resource';
                removeResource.dataset.collection = config.key;
                removeResource.dataset.itemIndex = String(itemIndex);
                removeResource.dataset.resourceIndex = String(resourceIndex);
                removeResource.textContent = 'Delete';

                resourceActions.appendChild(open);
                resourceActions.appendChild(removeResource);
                resourceRow.appendChild(resourceInfo);
                resourceRow.appendChild(resourceActions);
                listContainer.appendChild(resourceRow);
            });
        });

        const resourceForm = config.modalBody.querySelector(`#${config.key}-resource-form`);
        if (resourceForm) {
            const sourceSelect = resourceForm.querySelector('select[name="source"]');
            const fileInput = resourceForm.querySelector('input[name="file"]');
            const titleInput = resourceForm.querySelector('input[name="title"]');

            applyLectureResourceSourceMode(resourceForm);

            if (sourceSelect) {
                sourceSelect.addEventListener('change', () => applyLectureResourceSourceMode(resourceForm));
            }

            if (fileInput && titleInput) {
                fileInput.addEventListener('change', () => {
                    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                    if (file && !titleInput.value.trim()) {
                        titleInput.value = file.name;
                    }
                });
            }
        }
    }

    function toggleLecturesMenu(show) {
        if (!lecturesMenu || !lecturesSettingsButton) {
            return;
        }

        lecturesMenu.style.display = show ? 'block' : 'none';
        lecturesSettingsButton.setAttribute('aria-expanded', show ? 'true' : 'false');
        lecturesMenu.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    function openLecturesModal() {
        if (!lecturesModal) {
            return;
        }

        renderLecturesModal();
        lecturesModal.style.display = 'flex';
        lecturesModal.setAttribute('aria-hidden', 'false');
    }

    function closeLecturesModal() {
        if (!lecturesModal) {
            return;
        }

        lecturesModal.style.display = 'none';
        lecturesModal.setAttribute('aria-hidden', 'true');
    }

    function applyLectureResourceSourceMode(formElement) {
        if (!formElement) {
            return;
        }

        const sourceSelect = formElement.querySelector('select[name="source"]');
        const urlInput = formElement.querySelector('input[name="url"]');
        const fileInput = formElement.querySelector('input[name="file"]');
        if (!sourceSelect || !urlInput || !fileInput) {
            return;
        }

        const mode = sourceSelect.value === 'file' ? 'file' : 'link';
        if (mode === 'file') {
            urlInput.classList.add('books-field-hidden');
            urlInput.required = false;
            urlInput.value = '';
            fileInput.classList.remove('books-field-hidden');
            fileInput.required = true;
        } else {
            fileInput.classList.add('books-field-hidden');
            fileInput.required = false;
            fileInput.value = '';
            urlInput.classList.remove('books-field-hidden');
            urlInput.required = true;
        }
    }

    function renderLectures(lectures) {
        if (!lecturesSection) {
            return;
        }

        const list = lecturesSection.querySelector('ul');
        if (!list) {
            return;
        }

        const safeLectures = Array.isArray(lectures) ? lectures : [];
        list.innerHTML = '';

        if (!safeLectures.length) {
            const li = document.createElement('li');
            li.className = 'book-item-empty';
            li.textContent = 'No lectures added yet. Add lectures and attach resources from the menu.';
            list.appendChild(li);
            return;
        }

        safeLectures.forEach((lecture) => {
            const li = document.createElement('li');
            li.className = 'lecture-item';

            const titleElement = document.createElement('strong');
            titleElement.className = 'lecture-title';
            titleElement.textContent = lecture.title;

            const meta = document.createElement('span');
            meta.className = 'book-type';
            meta.textContent = lectureCountLabel(Array.isArray(lecture.resources) ? lecture.resources.length : 0);

            li.appendChild(titleElement);
            li.appendChild(meta);
            list.appendChild(li);
        });
    }

    function renderLecturesModal() {
        if (!lecturesModalBody) {
            return;
        }

        const subject = getCurrentSubject();
        const safeLectures = Array.isArray(subject.lectures) ? subject.lectures : [];

        lecturesModalBody.innerHTML = `
            <section class="subject-manager-section">
                <h4 class="manager-heading">Add lecture</h4>
                <form id="lectures-add-form" class="subject-form" aria-label="Add lecture">
                    <input class="subject-input" name="lectureTitle" type="text" maxlength="120" placeholder="Lecture title" required>
                    <div class="subject-form-actions">
                        <button class="btn btn-primary btn-sm" type="submit">Add Lecture</button>
                    </div>
                </form>
            </section>
            <section class="subject-manager-section">
                <h4 class="manager-heading">Add lecture resource</h4>
                <form id="lectures-resource-form" class="books-form" aria-label="Add lecture resource">
                    <select class="subject-input" name="lectureIndex" ${safeLectures.length ? '' : 'disabled'}>
                        ${safeLectures.map((lecture, index) => `<option value="${index}">${lecture.title}</option>`).join('')}
                    </select>
                    <div class="books-source-row">
                        <label class="books-source-label" for="lectures-source-modal">Source</label>
                        <select class="subject-input" id="lectures-source-modal" name="source" aria-label="Resource source" ${safeLectures.length ? '' : 'disabled'}>
                            <option value="link">Web link</option>
                            <option value="file">File from PC</option>
                        </select>
                    </div>
                    <div class="books-form-grid lectures-form-grid">
                        <select class="subject-input" name="type" aria-label="Resource type" ${safeLectures.length ? '' : 'disabled'}>
                            <option value="pdf">PDF</option>
                            <option value="document">Document</option>
                            <option value="video">Video</option>
                            <option value="link">Link</option>
                        </select>
                        <input class="subject-input" name="title" type="text" maxlength="140" placeholder="Resource title" ${safeLectures.length ? 'required' : 'disabled'}>
                        <input class="subject-input" name="url" type="url" placeholder="https://example.com/resource" ${safeLectures.length ? 'required' : 'disabled'}>
                        <input class="subject-input books-field-hidden" name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.odt,.mp4,.mkv,.mov,.avi,application/pdf,video/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Upload file from your PC" ${safeLectures.length ? '' : 'disabled'}>
                    </div>
                    <div class="subject-form-actions">
                        <button class="btn btn-secondary btn-sm" type="submit" ${safeLectures.length ? '' : 'disabled'}>Add Resource</button>
                    </div>
                </form>
            </section>
            <section class="subject-manager-section">
                <h4 class="manager-heading">Current lectures</h4>
                <div id="lectures-manage-list"></div>
            </section>
        `;

        const listContainer = lecturesModalBody.querySelector('#lectures-manage-list');
        if (!listContainer) {
            return;
        }

        if (!safeLectures.length) {
            listContainer.innerHTML = '<div class="manage-empty">No lectures added yet.</div>';
            return;
        }

        safeLectures.forEach((lecture, lectureIndex) => {
            const row = document.createElement('div');
            row.className = 'manage-row';

            const info = document.createElement('div');
            info.className = 'manage-fields';

            const titleElement = document.createElement('div');
            titleElement.className = 'title';
            titleElement.textContent = lecture.title;

            const subtitle = document.createElement('div');
            subtitle.className = 'manage-code';
            const resourceCount = Array.isArray(lecture.resources) ? lecture.resources.length : 0;
            subtitle.textContent = lectureCountLabel(resourceCount);

            info.appendChild(titleElement);
            info.appendChild(subtitle);

            const actions = document.createElement('div');
            actions.className = 'row-actions';

            const removeLecture = document.createElement('button');
            removeLecture.type = 'button';
            removeLecture.className = 'btn btn-danger btn-sm';
            removeLecture.dataset.action = 'remove-lecture';
            removeLecture.dataset.lectureIndex = String(lectureIndex);
            removeLecture.textContent = 'Delete Lecture';

            actions.appendChild(removeLecture);
            row.appendChild(info);
            row.appendChild(actions);
            listContainer.appendChild(row);

            if (resourceCount > 0) {
                lecture.resources.forEach((resource, resourceIndex) => {
                    const resourceRow = document.createElement('div');
                    resourceRow.className = 'manage-row';

                    const resourceInfo = document.createElement('div');
                    resourceInfo.className = 'manage-fields';

                    const resourceTitle = document.createElement('div');
                    resourceTitle.className = 'title';
                    resourceTitle.textContent = resource.title;

                    const resourceMeta = document.createElement('div');
                    resourceMeta.className = 'manage-code';
                    resourceMeta.textContent = `${typeLabel(resource.type)} | ${sourceLabel(resource.source)}`;

                    resourceInfo.appendChild(resourceTitle);
                    resourceInfo.appendChild(resourceMeta);

                    const resourceActions = document.createElement('div');
                    resourceActions.className = 'row-actions';

                    const open = document.createElement('a');
                    open.className = 'btn btn-secondary btn-sm';
                    open.textContent = 'Open';
                    open.href = resource.url;
                    open.target = '_blank';
                    open.rel = 'noopener noreferrer';
                    if (resource.source === 'file' && resource.fileName) {
                        open.download = resource.fileName;
                    }

                    const removeResource = document.createElement('button');
                    removeResource.type = 'button';
                    removeResource.className = 'btn btn-danger btn-sm';
                    removeResource.dataset.action = 'remove-lecture-resource';
                    removeResource.dataset.lectureIndex = String(lectureIndex);
                    removeResource.dataset.resourceIndex = String(resourceIndex);
                    removeResource.textContent = 'Delete';

                    resourceActions.appendChild(open);
                    resourceActions.appendChild(removeResource);
                    resourceRow.appendChild(resourceInfo);
                    resourceRow.appendChild(resourceActions);
                    listContainer.appendChild(resourceRow);
                });
            }
        });

        const resourceForm = lecturesModalBody.querySelector('#lectures-resource-form');
        if (resourceForm) {
            const sourceSelect = resourceForm.querySelector('select[name="source"]');
            const fileInput = resourceForm.querySelector('input[name="file"]');
            const titleInput = resourceForm.querySelector('input[name="title"]');

            applyLectureResourceSourceMode(resourceForm);

            if (sourceSelect) {
                sourceSelect.addEventListener('change', () => applyLectureResourceSourceMode(resourceForm));
            }

            if (fileInput && titleInput) {
                fileInput.addEventListener('change', () => {
                    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                    if (file && !titleInput.value.trim()) {
                        titleInput.value = file.name;
                    }
                });
            }
        }
    }

    function toggleBooksMenu(show) {
        if (!booksMenu || !booksSettingsButton) {
            return;
        }

        booksMenu.style.display = show ? 'block' : 'none';
        booksSettingsButton.setAttribute('aria-expanded', show ? 'true' : 'false');
        booksMenu.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    function openBooksModal() {
        if (!booksModal) {
            return;
        }

        renderBooksModal();
        booksModal.style.display = 'flex';
        booksModal.setAttribute('aria-hidden', 'false');
    }

    function closeBooksModal() {
        if (!booksModal) {
            return;
        }

        booksModal.style.display = 'none';
        booksModal.setAttribute('aria-hidden', 'true');
    }

    function applyBooksSourceMode(formElement) {
        if (!formElement) {
            return;
        }

        const sourceSelect = formElement.querySelector('select[name="source"]');
        const urlInput = formElement.querySelector('input[name="url"]');
        const fileInput = formElement.querySelector('input[name="file"]');
        const typeInput = formElement.querySelector('select[name="type"]');
        if (!sourceSelect || !urlInput || !fileInput || !typeInput) {
            return;
        }

        const mode = sourceSelect.value === 'file' ? 'file' : 'link';
        if (mode === 'file') {
            urlInput.classList.add('books-field-hidden');
            urlInput.required = false;
            urlInput.value = '';
            fileInput.classList.remove('books-field-hidden');
            fileInput.required = true;
            if (typeInput.value === 'link') {
                typeInput.value = 'pdf';
            }
        } else {
            fileInput.classList.add('books-field-hidden');
            fileInput.required = false;
            fileInput.value = '';
            urlInput.classList.remove('books-field-hidden');
            urlInput.required = true;
        }
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    function renderBooks(books) {
        if (!booksSection) {
            return;
        }

        const list = booksSection.querySelector('ul');
        const badge = booksSection.querySelector('.badge');
        if (!list) {
            return;
        }

        const safeBooks = Array.isArray(books) ? books : [];
        if (badge) {
            badge.textContent = `${safeBooks.length} item${safeBooks.length === 1 ? '' : 's'}`;
        }

        list.innerHTML = '';
        if (!safeBooks.length) {
            const li = document.createElement('li');
            li.className = 'book-item-empty';
            li.textContent = 'No resources added yet. Add PDF, document, or link above.';
            list.appendChild(li);
            return;
        }

        safeBooks.forEach((book, index) => {
            const li = document.createElement('li');
            li.className = 'book-item';

            const link = document.createElement('a');
            link.className = 'book-link';
            link.href = book.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = book.title;

            const meta = document.createElement('span');
            meta.className = 'book-type';
            meta.textContent = `${typeLabel(book.type)} | ${sourceLabel(book.source)}`;

            if (book.source === 'file' && book.fileName) {
                link.download = book.fileName;
            }

            li.appendChild(link);
            li.appendChild(meta);
            list.appendChild(li);
        });
    }

    function renderBooksModal() {
        if (!booksModalBody) {
            return;
        }

        const subject = getCurrentSubject();
        const safeBooks = Array.isArray(subject.books) ? subject.books : [];

        booksModalBody.innerHTML = `
            <section class="subject-manager-section">
                <h4 class="manager-heading">Add resource</h4>
                <form id="books-add-form" class="books-form" aria-label="Add a learning resource">
                    <div class="books-source-row">
                        <label class="books-source-label" for="books-source-modal">Source</label>
                        <select class="subject-input" id="books-source-modal" name="source" aria-label="Resource source">
                            <option value="link">Web link</option>
                            <option value="file">File from PC</option>
                        </select>
                    </div>
                    <div class="books-form-grid">
                        <select class="subject-input" name="type" aria-label="Resource type">
                            <option value="pdf">PDF</option>
                            <option value="document">Document</option>
                            <option value="link">Link</option>
                        </select>
                        <input class="subject-input" name="title" type="text" maxlength="120" placeholder="Resource title" required>
                        <input class="subject-input" name="url" type="url" placeholder="https://example.com/resource" required>
                        <input class="subject-input books-field-hidden" name="file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Upload file from your PC">
                    </div>
                    <div class="subject-form-actions">
                        <button class="btn btn-primary btn-sm" type="submit">Add Resource</button>
                    </div>
                </form>
            </section>
            <section class="subject-manager-section">
                <h4 class="manager-heading">Current resources</h4>
                <div id="books-manage-list"></div>
            </section>
        `;

        const listContainer = booksModalBody.querySelector('#books-manage-list');
        if (!listContainer) {
            return;
        }

        if (!safeBooks.length) {
            listContainer.innerHTML = '<div class="manage-empty">No resources added yet.</div>';
        } else {
            safeBooks.forEach((book, index) => {
                const row = document.createElement('div');
                row.className = 'manage-row';

                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = book.title;

                const subtitle = document.createElement('div');
                subtitle.className = 'manage-code';
                subtitle.textContent = `${typeLabel(book.type)} | ${sourceLabel(book.source)}`;

                const info = document.createElement('div');
                info.className = 'manage-fields';
                info.appendChild(title);
                info.appendChild(subtitle);

                const actions = document.createElement('div');
                actions.className = 'row-actions';

                const open = document.createElement('a');
                open.className = 'btn btn-secondary btn-sm';
                open.textContent = 'Open';
                open.href = book.url;
                open.target = '_blank';
                open.rel = 'noopener noreferrer';
                if (book.source === 'file' && book.fileName) {
                    open.download = book.fileName;
                }

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'btn btn-danger btn-sm';
                remove.dataset.action = 'remove-book';
                remove.dataset.index = String(index);
                remove.textContent = 'Delete';

                actions.appendChild(open);
                actions.appendChild(remove);
                row.appendChild(info);
                row.appendChild(actions);
                listContainer.appendChild(row);
            });
        }

        const addForm = booksModalBody.querySelector('#books-add-form');
        if (addForm) {
            const sourceSelect = addForm.querySelector('select[name="source"]');
            const fileInput = addForm.querySelector('input[name="file"]');
            const titleInput = addForm.querySelector('input[name="title"]');

            applyBooksSourceMode(addForm);

            if (sourceSelect) {
                sourceSelect.addEventListener('change', () => applyBooksSourceMode(addForm));
            }

            if (fileInput && titleInput) {
                fileInput.addEventListener('change', () => {
                    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                    if (file && !titleInput.value.trim()) {
                        titleInput.value = file.name;
                    }
                });
            }
        }
    }

    function renderSubject(subject) {
        const safeSubject = normalizeSubject(subject, subjectId - 1);
        const metrics = getSubjectResourceMetrics(safeSubject);
        const alertTitle = document.querySelector('.alert-title');
        const alertBody = document.querySelector('.alert-body');
        const heroTitle = document.getElementById('subject-hero-title');
        const heroNote = document.getElementById('subject-hero-note');
        const resourceCount = document.getElementById('subject-resource-count');
        const studyUnitCount = document.getElementById('subject-unit-count');
        const finalScore = document.getElementById('subject-final-score');
        const codeBadge = document.getElementById('subject-code-badge');
        const creditHours = document.getElementById('subject-credit-hours');
        const contactHours = document.getElementById('subject-contact-hours');
        const resourceFiles = document.getElementById('subject-resource-files');
        const resourceLinks = document.getElementById('subject-resource-links');
        const lecturesTotal = document.getElementById('subject-lectures-total');
        const assignmentsTotal = document.getElementById('subject-assignments-total');
        const quizzesTotal = document.getElementById('subject-quizzes-total');
        const insightSummary = document.getElementById('subject-insight-summary');
        const progressSummary = document.getElementById('subject-progress-summary');
        const marksCard = document.getElementById('final-marks');
        const marksValue = document.getElementById('subject-marks-value');
        const marksFill = document.getElementById('subject-marks-fill');
        const marksBadge = marksCard ? marksCard.querySelector('.badge') : null;

        title.textContent = safeSubject.name;
        if (heroTitle) {
            heroTitle.textContent = safeSubject.name;
        }

        document.title = `StudyHub — ${safeSubject.name}`;

        if (alertTitle) {
            alertTitle.textContent = safeSubject.name;
        }

        if (alertBody) {
            alertBody.textContent = safeSubject.details || 'View and manage all subject content below.';
        }

        if (heroNote) {
            heroNote.textContent = safeSubject.details || 'View and manage all subject content below.';
        }

        if (resourceCount) {
            resourceCount.textContent = String(metrics.resourceCount);
        }

        if (studyUnitCount) {
            studyUnitCount.textContent = String(metrics.studyUnits);
        }

        if (finalScore) {
            finalScore.textContent = String(metrics.finalMarks);
        }

        if (codeBadge) {
            codeBadge.textContent = safeSubject.code;
        }

        if (creditHours) {
            creditHours.textContent = String(metrics.creditHours);
        }

        if (contactHours) {
            contactHours.textContent = String(metrics.contactHours);
        }

        if (resourceFiles) {
            resourceFiles.textContent = String(metrics.resourceFiles);
        }

        if (resourceLinks) {
            resourceLinks.textContent = String(metrics.resourceLinks);
        }

        if (lecturesTotal) {
            lecturesTotal.textContent = String(metrics.lectures);
        }

        if (assignmentsTotal) {
            assignmentsTotal.textContent = String(metrics.assignments);
        }

        if (quizzesTotal) {
            quizzesTotal.textContent = String(metrics.quizzes);
        }

        if (insightSummary) {
            insightSummary.textContent = metrics.resourceCount
                ? `${metrics.resourceCount} total resources are currently mapped across ${metrics.studyUnits} study units.`
                : 'Subject metrics will appear here as content is added.';
        }

        if (progressSummary) {
            progressSummary.textContent = metrics.studyUnits
                ? `${formatCount(metrics.lectures, 'lecture')}, ${formatCount(metrics.assignments, 'assignment')}, and ${formatCount(metrics.quizzes, 'quiz', 'quizzes')} are active in this subject.`
                : 'Use this subject workspace to build a complete academic trail.';
        }

        renderBooks(safeSubject.books);
        renderLectures(safeSubject.lectures);
        structuredCollections.forEach((config) => {
            renderStructuredSection(config);
        });

        if (marksValue) {
            marksValue.innerHTML = `${metrics.finalMarks} <span>/ 100</span>`;
        }

        if (marksFill) {
            const normalizedMarks = Math.max(0, Math.min(metrics.finalMarks, 100));
            marksFill.style.width = `${normalizedMarks}%`;
        }

        if (marksBadge) {
            marksBadge.textContent = metrics.finalMarks >= 85
                ? 'Excellent'
                : metrics.finalMarks >= 60
                    ? 'Recorded'
                    : metrics.finalMarks > 0
                        ? 'Needs Attention'
                        : 'Pending';
            marksBadge.className = `badge ${metrics.finalMarks >= 85 ? 'badge-green' : metrics.finalMarks >= 60 ? 'badge-blue' : metrics.finalMarks > 0 ? 'badge-red' : 'badge-slate'}`;
        }
    }

    if (booksModalBody) {
        booksModalBody.addEventListener('submit', async (event) => {
            event.preventDefault();

            const form = event.target.closest('form#books-add-form');
            if (!form) {
                return;
            }

            const formData = new FormData(form);
            const source = String(formData.get('source') || 'link').trim().toLowerCase() === 'file' ? 'file' : 'link';
            const type = String(formData.get('type') || 'link').trim().toLowerCase();
            const safeType = type === 'pdf' || type === 'document' || type === 'link' ? type : 'link';
            let titleValue = String(formData.get('title') || '').trim();
            let urlValue = '';
            let fileName = '';

            if (source === 'file') {
                const file = formData.get('file');
                if (!(file instanceof File) || !file.name || file.size <= 0) {
                    return;
                }

                fileName = file.name;
                if (!titleValue) {
                    titleValue = file.name;
                }

                try {
                    urlValue = await readFileAsDataURL(file);
                } catch (error) {
                    console.error(error);
                    return;
                }
            } else {
                urlValue = String(formData.get('url') || '').trim();
            }

            if (!titleValue || !urlValue) {
                return;
            }

            const subject = getCurrentSubject();
            if (!Array.isArray(subject.books)) {
                subject.books = [];
            }

            subject.books.push({
                source,
                type: safeType,
                title: titleValue,
                url: urlValue,
                fileName
            });

            renderSubject(subject);
            renderBooksModal();
            scheduleSave();
        });
    }

    if (booksModalBody) {
        booksModalBody.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="remove-book"]');
            if (!button) {
                return;
            }

            const index = Number.parseInt(button.dataset.index || '-1', 10);
            if (index < 0) {
                return;
            }

            const subject = getCurrentSubject();
            if (!Array.isArray(subject.books) || !subject.books[index]) {
                return;
            }

            subject.books.splice(index, 1);
            renderSubject(subject);
            renderBooksModal();
            scheduleSave();
        });
    }

    if (lecturesModalBody) {
        lecturesModalBody.addEventListener('submit', async (event) => {
            event.preventDefault();

            const lectureForm = event.target.closest('form#lectures-add-form');
            if (lectureForm) {
                const formData = new FormData(lectureForm);
                const lectureTitle = String(formData.get('lectureTitle') || '').trim();
                if (!lectureTitle) {
                    return;
                }

                const subject = getCurrentSubject();
                if (!Array.isArray(subject.lectures)) {
                    subject.lectures = [];
                }

                subject.lectures.push({
                    title: lectureTitle,
                    resources: []
                });

                renderSubject(subject);
                renderLecturesModal();
                scheduleSave();
                return;
            }

            const resourceForm = event.target.closest('form#lectures-resource-form');
            if (!resourceForm) {
                return;
            }

            const formData = new FormData(resourceForm);
            const lectureIndex = Number.parseInt(String(formData.get('lectureIndex') || '-1'), 10);
            const source = String(formData.get('source') || 'link').trim().toLowerCase() === 'file' ? 'file' : 'link';
            const type = String(formData.get('type') || 'link').trim().toLowerCase();
            const safeType = type === 'pdf' || type === 'document' || type === 'video' || type === 'link' ? type : 'link';
            let titleValue = String(formData.get('title') || '').trim();
            let urlValue = '';
            let fileName = '';

            const subject = getCurrentSubject();
            if (!Array.isArray(subject.lectures) || !subject.lectures[lectureIndex]) {
                return;
            }

            if (source === 'file') {
                const file = formData.get('file');
                if (!(file instanceof File) || !file.name || file.size <= 0) {
                    return;
                }

                fileName = file.name;
                if (!titleValue) {
                    titleValue = file.name;
                }

                try {
                    urlValue = await readFileAsDataURL(file);
                } catch (error) {
                    console.error(error);
                    return;
                }
            } else {
                urlValue = String(formData.get('url') || '').trim();
            }

            if (!titleValue || !urlValue) {
                return;
            }

            if (!Array.isArray(subject.lectures[lectureIndex].resources)) {
                subject.lectures[lectureIndex].resources = [];
            }

            subject.lectures[lectureIndex].resources.push({
                source,
                type: safeType,
                title: titleValue,
                url: urlValue,
                fileName
            });

            renderSubject(subject);
            renderLecturesModal();
            scheduleSave();
        });
    }

    if (lecturesModalBody) {
        lecturesModalBody.addEventListener('click', (event) => {
            const removeLecture = event.target.closest('button[data-action="remove-lecture"]');
            if (removeLecture) {
                const lectureIndex = Number.parseInt(removeLecture.dataset.lectureIndex || '-1', 10);
                if (lectureIndex < 0) {
                    return;
                }

                const subject = getCurrentSubject();
                if (!Array.isArray(subject.lectures) || !subject.lectures[lectureIndex]) {
                    return;
                }

                subject.lectures.splice(lectureIndex, 1);
                renderSubject(subject);
                renderLecturesModal();
                scheduleSave();
                return;
            }

            const removeResource = event.target.closest('button[data-action="remove-lecture-resource"]');
            if (!removeResource) {
                return;
            }

            const lectureIndex = Number.parseInt(removeResource.dataset.lectureIndex || '-1', 10);
            const resourceIndex = Number.parseInt(removeResource.dataset.resourceIndex || '-1', 10);
            if (lectureIndex < 0 || resourceIndex < 0) {
                return;
            }

            const subject = getCurrentSubject();
            if (!Array.isArray(subject.lectures) || !subject.lectures[lectureIndex]) {
                return;
            }

            const resources = subject.lectures[lectureIndex].resources;
            if (!Array.isArray(resources) || !resources[resourceIndex]) {
                return;
            }

            resources.splice(resourceIndex, 1);
            renderSubject(subject);
            renderLecturesModal();
            scheduleSave();
        });
    }

    if (booksSettingsButton && booksMenu) {
        booksSettingsButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleLecturesMenu(false);
            closeAllCollectionMenus();
            closeAllStructuredMenus();
            toggleBooksMenu(booksMenu.style.display !== 'block');
        });

        booksMenu.addEventListener('click', (event) => {
            const action = event.target.getAttribute('data-action');
            toggleBooksMenu(false);
            if (action === 'add' || action === 'manage') {
                openBooksModal();
                if (action === 'add' && booksModalBody) {
                    const titleInput = booksModalBody.querySelector('input[name="title"]');
                    if (titleInput) {
                        titleInput.focus();
                    }
                }
            }
        });
    }

    if (booksModalClose) {
        booksModalClose.addEventListener('click', closeBooksModal);
    }

    if (booksModal) {
        booksModal.addEventListener('click', (event) => {
            if (event.target === booksModal) {
                closeBooksModal();
            }
        });
    }

    if (lecturesSettingsButton && lecturesMenu) {
        lecturesSettingsButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const shouldOpen = lecturesMenu.style.display !== 'block';
            toggleBooksMenu(false);
            closeAllCollectionMenus();
            closeAllStructuredMenus();
            toggleLecturesMenu(shouldOpen);
        });

        lecturesMenu.addEventListener('click', (event) => {
            const action = event.target.getAttribute('data-action');
            toggleLecturesMenu(false);
            if (action === 'add' || action === 'manage') {
                openLecturesModal();
                if (action === 'add' && lecturesModalBody) {
                    const input = lecturesModalBody.querySelector('input[name="lectureTitle"]');
                    if (input) {
                        input.focus();
                    }
                }
            }
        });
    }

    if (lecturesModalClose) {
        lecturesModalClose.addEventListener('click', closeLecturesModal);
    }

    if (lecturesModal) {
        lecturesModal.addEventListener('click', (event) => {
            if (event.target === lecturesModal) {
                closeLecturesModal();
            }
        });
    }

    structuredCollections.forEach((config) => {
        if (!config.menuButton || !config.menu) {
            return;
        }

        config.menuButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const shouldOpen = config.menu.style.display !== 'block';
            toggleBooksMenu(false);
            toggleLecturesMenu(false);
            closeAllCollectionMenus();
            closeAllStructuredMenus();
            toggleDropdown(config.menu, config.menuButton, shouldOpen);
        });

        config.menu.addEventListener('click', (event) => {
            const action = event.target.getAttribute('data-action');
            toggleDropdown(config.menu, config.menuButton, false);
            if (action === 'add' || action === 'manage') {
                openCollectionModal(config);
                if (action === 'add' && config.modalBody) {
                    const input = config.modalBody.querySelector('input[name="itemTitle"]');
                    if (input) {
                        input.focus();
                    }
                }
            }
        });
    });

    structuredCollections.forEach((config) => {
        if (config.modalClose) {
            config.modalClose.addEventListener('click', () => closeCollectionModal(config));
        }

        if (config.modal) {
            config.modal.addEventListener('click', (event) => {
                if (event.target === config.modal) {
                    closeCollectionModal(config);
                }
            });
        }

        if (!config.modalBody) {
            return;
        }

        config.modalBody.addEventListener('submit', async (event) => {
            event.preventDefault();

            const addForm = event.target.closest(`form#${config.key}-add-form`);
            if (addForm) {
                const formData = new FormData(addForm);
                const itemTitle = String(formData.get('itemTitle') || '').trim();
                if (!itemTitle) {
                    return;
                }

                const subject = getCurrentSubject();
                if (!Array.isArray(subject[config.key])) {
                    subject[config.key] = [];
                }

                subject[config.key].push({ title: itemTitle, resources: [] });
                renderSubject(subject);
                renderStructuredModal(config);
                scheduleSave();
                return;
            }

            const resourceForm = event.target.closest(`form#${config.key}-resource-form`);
            if (!resourceForm) {
                return;
            }

            const formData = new FormData(resourceForm);
            const itemIndex = Number.parseInt(String(formData.get('itemIndex') || '-1'), 10);
            const source = String(formData.get('source') || 'link').trim().toLowerCase() === 'file' ? 'file' : 'link';
            const type = String(formData.get('type') || 'link').trim().toLowerCase();
            const safeType = type === 'pdf' || type === 'document' || type === 'video' || type === 'link' ? type : 'link';
            let titleValue = String(formData.get('title') || '').trim();
            let urlValue = '';
            let fileName = '';

            const subject = getCurrentSubject();
            if (!Array.isArray(subject[config.key]) || !subject[config.key][itemIndex]) {
                return;
            }

            if (source === 'file') {
                const file = formData.get('file');
                if (!(file instanceof File) || !file.name || file.size <= 0) {
                    return;
                }

                fileName = file.name;
                if (!titleValue) {
                    titleValue = file.name;
                }

                try {
                    urlValue = await readFileAsDataURL(file);
                } catch (error) {
                    console.error(error);
                    return;
                }
            } else {
                urlValue = String(formData.get('url') || '').trim();
            }

            if (!titleValue || !urlValue) {
                return;
            }

            if (!Array.isArray(subject[config.key][itemIndex].resources)) {
                subject[config.key][itemIndex].resources = [];
            }

            subject[config.key][itemIndex].resources.push({
                source,
                type: safeType,
                title: titleValue,
                url: urlValue,
                fileName
            });

            renderSubject(subject);
            renderStructuredModal(config);
            scheduleSave();
        });

        config.modalBody.addEventListener('click', (event) => {
            const removeItem = event.target.closest('button[data-action="remove-structured-item"]');
            if (removeItem && removeItem.dataset.collection === config.key) {
                const itemIndex = Number.parseInt(removeItem.dataset.itemIndex || '-1', 10);
                if (itemIndex < 0) {
                    return;
                }

                const subject = getCurrentSubject();
                if (!Array.isArray(subject[config.key]) || !subject[config.key][itemIndex]) {
                    return;
                }

                subject[config.key].splice(itemIndex, 1);
                renderSubject(subject);
                renderStructuredModal(config);
                scheduleSave();
                return;
            }

            const removeResource = event.target.closest('button[data-action="remove-structured-resource"]');
            if (!removeResource || removeResource.dataset.collection !== config.key) {
                return;
            }

            const itemIndex = Number.parseInt(removeResource.dataset.itemIndex || '-1', 10);
            const resourceIndex = Number.parseInt(removeResource.dataset.resourceIndex || '-1', 10);
            if (itemIndex < 0 || resourceIndex < 0) {
                return;
            }

            const subject = getCurrentSubject();
            if (!Array.isArray(subject[config.key]) || !subject[config.key][itemIndex]) {
                return;
            }

            const resources = subject[config.key][itemIndex].resources;
            if (!Array.isArray(resources) || !resources[resourceIndex]) {
                return;
            }

            resources.splice(resourceIndex, 1);
            renderSubject(subject);
            renderStructuredModal(config);
            scheduleSave();
        });
    });

    document.addEventListener('click', () => {
        toggleBooksMenu(false);
        toggleLecturesMenu(false);
        closeAllCollectionMenus();
        closeAllStructuredMenus();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            toggleBooksMenu(false);
            closeBooksModal();
            toggleLecturesMenu(false);
            closeLecturesModal();
            closeAllCollectionMenus();
            closeAllCollectionModals();
            closeAllStructuredMenus();
            closeAllStructuredModals();
        }
    });

    async function loadSubject() {
        const data = await loadStudyData();
        const semester = data && Array.isArray(data.semesters)
            ? data.semesters.find((entry) => entry.id === semesterId)
            : null;
        const backup = getLocalBackup(semesterId);
        const subjects = backup && Array.isArray(backup.subjects)
            ? backup.subjects
            : semester && Array.isArray(semester.subjects)
                ? semester.subjects
                : [];
        state.subjects = subjects.map((entry, index) => normalizeSubject(entry, index));

        const subject = state.subjects[subjectIndex];

        if (subject) {
            renderSubject(subject);
            return;
        }

        const fallbackSubject = getCurrentSubject();
        renderSubject(fallbackSubject);
    }

    loadSubject().catch((error) => {
        console.error('Failed to load subject page data:', error);
    });
})();

