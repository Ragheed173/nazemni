import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const ar = {
  translation: {
    brand: 'نظمني',
    auth: {
      login: 'تسجيل الدخول', username: 'اسم المستخدم', password: 'كلمة المرور',
      signIn: 'دخول', signingIn: 'جارٍ الدخول…', logout: 'تسجيل الخروج',
      description: 'أدخل بياناتك للوصول إلى مساحة الدراسة الشخصية.',
      invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
      tooManyAttempts: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.',
      register: 'إنشاء حساب', createAccount: 'إنشاء الحساب', email: 'البريد الإلكتروني',
      confirmPassword: 'تأكيد كلمة المرور', inviteCode: 'رمز الدعوة',
      passwordMismatch: 'كلمتا المرور غير متطابقتين.', registrationFailed: 'تعذر إنشاء الحساب بهذه البيانات.',
      registrationClosed: 'التسجيل مغلق حاليًا.', haveAccount: 'لديك حساب؟ سجل الدخول',
    },
    landing: { title: 'نظّم دراستك ببساطة', description: 'نظّم موادك، محاضراتك، واجباتك، وامتحاناتك في مكان واحد.' },
    nav: {
      dashboard: 'الرئيسية', dailyPlan: 'خطة اليوم', courses: 'المواد', tasks: 'المهام',
      lectures: 'المحاضرات', assignments: 'الواجبات', projects: 'المشاريع', exams: 'الامتحانات',
      grades: 'العلامات', weakTopics: 'نقاط الضعف', backlog: 'التراكم',
      weeklyReview: 'مراجعة الأسبوع', semester: 'إدارة الفصل', settings: 'الإعدادات', profile: 'الحساب', admin: 'الإدارة', ai: 'المساعد الذكي',
    },
    common: {
      add: 'إضافة', save: 'حفظ', cancel: 'إلغاء', edit: 'تعديل', delete: 'حذف',
      close: 'إغلاق', loading: 'جارٍ التحميل…', error: 'تعذر تحميل البيانات.',
      retry: 'إعادة المحاولة', noData: 'لا توجد بيانات بعد.', course: 'المادة', status: 'الحالة',
      date: 'التاريخ', deadline: 'الموعد النهائي', title: 'العنوان', notes: 'ملاحظات',
      actions: 'إجراءات', progress: 'التقدم', type: 'النوع', optional: 'اختياري',
      success: 'تم الحفظ بنجاح', deleted: 'تم الحذف', confirmDelete: 'هل تريد حذف هذا العنصر؟',
      yesDelete: 'نعم، احذف', all: 'الكل', language: 'اللغة', today: 'اليوم',
      minutes: 'دقيقة', view: 'عرض', score: 'النتيجة', reason: 'لماذا الآن؟',
      emptyHint: 'أضف أول عنصر للبدء.', online: 'عن بُعد', onCampus: 'في الجامعة', inPerson: 'وجاهية',
      yes: 'نعم', no: 'لا',
    },
    dashboard: {
      title: 'الرئيسية', greeting: 'الثلاثاء، 15 أيلول', todayPlan: 'خطة اليوم',
      upcoming: 'القادم', attention: 'مواد تحتاج انتباه', backlog: 'التراكم',
      weeklyProgress: 'تقدم الأسبوع', schedule: 'محاضرات اليوم', focus: 'وضع التركيز',
      focusActive: 'وضع التركيز مفعّل', noFocus: 'لا يوجد حدث عاجل هذا الأسبوع.',
      noUpcoming: 'لا توجد مواعيد قريبة مسجلة.', noAttention: 'كل المواد مستقرة حاليًا.',
      planEmpty: 'لا توجد مهام مسجلة. أضف محاضرة أو مهمة لبدء التخطيط.',
      noSemester: 'لا يوجد فصل دراسي حالي.', noSemesterHint: 'ابدأ بإنشاء فصل وإضافة موادك.', createSemester: 'إنشاء فصل',
    },
    plan: {
      title: 'خطة اليوم', subtitle: 'أولويات عملية محسوبة من المواعيد والتراكم وصعوبة المواد.',
      critical: 'ضروري اليوم', important: 'مهم', optional: 'إذا بقي مجال',
      checkout: 'إنهاء اليوم', checkoutTitle: 'المراجعة اليومية السريعة',
      stoppedAt: 'أين توقفت؟', misunderstood: 'مفهوم لم أفهمه', selfRating: 'تقييمي لليوم',
      completed: 'تم', inProgress: 'قيد التنفيذ', deferred: 'مؤجل',
      noTasks: 'لا توجد مهام في هذه الفئة.', markComplete: 'تحديد كمكتمل',
      defer: 'تأجيل', start: 'بدء', generated: 'تم تحديث الخطة الآن',
    },
    courses: {
      title: 'المواد', subtitle: '{{count}} مواد نشطة، {{credits}} ساعة معتمدة.',
      difficulty: 'الصعوبة', credits: 'الساعات', target: 'الهدف', retake: 'إعادة',
      lectureProgress: 'تقدم المحاضرات', currentGrade: 'المستوى الحالي',
      weightsIncomplete: 'أوزان العلامات غير مكتملة.', lastStudy: 'آخر دراسة',
      overview: 'نظرة عامة', history: 'السجل', schedule: 'الجدول', assessmentStructure: 'نظام التقييم',
      status: { ON_TRACK: 'على المسار', NEEDS_ATTENTION: 'تحتاج انتباه', AT_RISK: 'معرّضة للخطر' },
    },
    entities: {
      lectures: { title: 'المحاضرات', add: 'إضافة محاضرة', backloggedAdd: 'إضافة محاضرة متراكمة', number: 'رقم المحاضرة', lectureDate: 'تاريخ المحاضرة', duration: 'مدة المحاضرة', durationPlaceholder: 'مثال: 60 دقيقة', deliveryMode: 'نوع المحاضرة', deliveryModes: { IN_PERSON: 'وجاهية', ONLINE: 'إلكترونية' }, attended: 'هل حضرت المحاضرة؟', attendance: { true: 'حضرتها', false: 'ما حضرتها' }, reviewToggle: 'نعم، أحتاج مراجعة', understanding: 'الفهم من 10', needsReview: 'تحتاج مراجعة', state: 'الحالة' },
      tasks: { title: 'المهام', add: 'إضافة مهمة', description: 'الوصف', dueAt: 'تاريخ الاستحقاق', effort: 'الجهد المتوقع', priority: 'الأولوية' },
      assignments: { title: 'الواجبات', add: 'إضافة واجب', officialDeadline: 'الموعد الرسمي', internalDeadline: 'الموعد الداخلي', weight: 'الوزن', progress: 'التقدم' },
      projects: { title: 'المشاريع', add: 'إضافة مشروع', officialDeadline: 'الموعد الرسمي', internalDeadline: 'الموعد الداخلي', weight: 'الوزن', milestones: 'المراحل' },
      exams: { title: 'الامتحانات', add: 'إضافة امتحان', examDate: 'تاريخ الامتحان', preparation: 'الاستعداد', confidence: 'الثقة من 10', weight: 'الوزن' },
      grades: { title: 'العلامات', add: 'إضافة علامة', score: 'العلامة', maximum: 'من', percentage: 'النسبة', weight: 'الوزن', incomplete: 'أوزان التقييم غير مكتملة؛ لا يتم افتراضها.' },
      weakTopics: { title: 'نقاط الضعف', add: 'إضافة نقطة ضعف', topic: 'الموضوع', severity: 'الشدّة', resolved: 'محسوم', resolve: 'تمكّنت منها' },
    },
    backlog: {
      title: 'التراكم', subtitle: 'العناصر الأخطر أولًا مع سبب واضح لترتيبها.',
      risk: 'مستوى الخطر', age: 'العمر', safe: 'لا يوجد تراكم حاليًا.',
    },
    weekly: {
      title: 'مراجعة الأسبوع', score: 'النتيجة الأسبوعية', completion: 'إنجاز المهام',
      coverage: 'تغطية المواد', backlogControl: 'ضبط التراكم', reviews: 'المراجعة',
      assessments: 'التقييمات', keyRisks: 'المخاطر الحالية', nextWeek: 'أولوية الأسبوع القادم',
      covered: 'تمت التغطية', notCovered: 'لم تُغطَّ', tasks: 'المهام',
    },
    settings: {
      title: 'الإعدادات', planning: 'إعدادات التخطيط', weeklyDay: 'يوم المراجعة الأسبوعية',
      target: 'هدف الفصل', retakeBonus: 'دفعة أولوية الإعادة', firstReview: 'المراجعة الأولى بعد (ساعة)', timezone: 'المنطقة الزمنية',
      focusManual: 'وضع التركيز اليدوي', auto: 'تلقائي', enabled: 'مفعّل', disabled: 'معطّل',
      saturday: 'السبت', description: 'إعدادات قليلة تؤثر مباشرة في طريقة التخطيط.',
    },
    semester: {
      title: 'إدارة الفصل', description: 'عدّل الفصل والمواد المسجلة والجدول ونظام التقييم من مكان واحد.',
      currentSemester: 'الفصل الحالي', noCurrent: 'لا يوجد فصل حالي مفعّل.', name: 'اسم الفصل',
      academicYear: 'العام الأكاديمي', term: 'الفصل', startDate: 'تاريخ البداية', endDate: 'تاريخ النهاية',
      registeredCourses: 'المواد المسجلة', inactiveCourses: 'المواد غير النشطة', addCourse: 'إضافة مادة',
      editEnrollment: 'تعديل تسجيل المادة', existingCourse: 'اختيار مادة موجودة', newCourse: 'إنشاء مادة جديدة',
      courseCode: 'رمز المادة', nameAr: 'الاسم بالعربية', nameEn: 'الاسم بالإنجليزية',
      instructor: 'المدرس', section: 'الشعبة', previousGrade: 'العلامة السابقة', replacementEffect: 'تأثير استبدال العلامة',
      drop: 'إسقاط', restore: 'إعادة تفعيل', confirmDrop: 'إسقاط المادة من الفصل الحالي؟ سيبقى سجلها محفوظًا.',
      noActiveCourses: 'لا توجد مواد نشطة في هذا الفصل.', courseCount: 'مواد', creditCount: 'ساعة',
      addSchedule: 'إضافة موعد', addAssessment: 'إضافة تقييم', day: 'اليوم', startTime: 'البداية', endTime: 'النهاية',
      room: 'القاعة / المكان', assessmentName: 'اسم التقييم', weight: 'الوزن', enabled: 'مفعّل',
      days: { 0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت' },
    },
    onboarding: { title: 'مرحبًا بك في نظمني', description: 'أنشئ فصلك الحالي، ثم أضف أول مادة من إدارة الفصل.', create: 'إنشاء الفصل والمتابعة', skip: 'لاحقًا' },
    profile: { title: 'الحساب', account: 'معلومات الحساب', displayName: 'الاسم الظاهر', createdAt: 'تاريخ إنشاء الحساب', changePassword: 'تغيير كلمة المرور', currentPassword: 'كلمة المرور الحالية', newPassword: 'كلمة المرور الجديدة', passwordChanged: 'تم تغيير كلمة المرور', logoutAll: 'تسجيل الخروج من جميع الأجهزة' },
    admin: { title: 'الإدارة', registrationMode: 'وضع التسجيل', totalUsers: 'كل المستخدمين', activeUsers: 'نشطون', disabledUsers: 'معطلون', invites: 'رموز الدعوة', maxUses: 'عدد الاستخدامات', createInvite: 'إنشاء رمز', codeCreated: 'تم إنشاء رمز الدعوة', copyOnce: 'انسخ هذا الرمز الآن؛ لن يظهر كاملًا مرة أخرى:', code: 'الرمز', uses: 'الاستخدامات', revoke: 'إلغاء', users: 'المستخدمون', disable: 'تعطيل', enable: 'تفعيل' },
    ai: { title: 'المساعد الذكي', subtitle: 'إدارة دراستك باللغة الطبيعية اعتمادًا على بيانات نظمني.', unavailable: 'المساعد الذكي غير متاح حاليًا.', newConversation: 'محادثة جديدة', conversations: 'المحادثات', noConversations: 'لا توجد محادثات بعد.', emptyTitle: 'كيف أساعدك في دراستك؟', emptyHint: 'اسأل عن خطة اليوم أو التراكم، أو أضف مهمة دراسية.', you: 'أنت', assistant: 'نظمني', thinking: 'جارٍ تجهيز الرد…', message: 'رسالتك', placeholder: 'مثال: شو لازم أدرس اليوم؟', send: 'إرسال', deleteConversation: 'حذف المحادثة', deleteConfirm: 'حذف هذه المحادثة؟', error: 'تعذر الوصول إلى المساعد حاليًا. حاول مرة أخرى بعد قليل.', rateLimited: 'وصلت إلى حد الطلبات. حاول لاحقًا.', providerBusy: 'المساعد مشغول حاليًا بسبب حد الاستخدام المؤقت. جرّب مرة ثانية بعد أقل من دقيقة.', operations: 'تشغيل المساعد', requestsToday: 'طلبات اليوم', requestsMonth: 'طلبات الشهر', inputTokens: 'رموز الإدخال اليوم', outputTokens: 'رموز الإخراج اليوم', averageInput: 'متوسط رموز الإدخال', averageOutput: 'متوسط رموز الإخراج', rateLimits: 'أحداث حدود الاستخدام', errors: 'أخطاء المزود' },
    states: {
      TODO: 'لم تبدأ', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'تم', DEFERRED: 'مؤجل',
      TAKEN_NOT_STUDIED: 'أُخذت ولم تُدرس', STUDIED: 'دُرست', NEEDS_REVIEW: 'تحتاج مراجعة', MASTERED: 'متقنة',
      NOT_STARTED: 'لم يبدأ', READY_TO_SUBMIT: 'جاهز للتسليم', SUBMITTED: 'مُسلّم', GRADED: 'مُقيّم',
      BLOCKED: 'متوقف', READY: 'جاهز', LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية',
      CRITICAL: 'ضروري اليوم', IMPORTANT: 'مهم', OPTIONAL: 'إذا بقي مجال',
      QUIZ: 'اختبارات قصيرة', ASSIGNMENT: 'واجبات', PROJECT: 'مشروع', MIDTERM: 'امتحان نصفي', FINAL: 'امتحان نهائي', PARTICIPATION: 'مشاركة', OTHER: 'أخرى',
      ACTIVE: 'نشطة', DROPPED: 'مسقطة', WITHDRAWN: 'منسحب منها',
    },
  },
};

const en = {
  translation: {
    brand: 'Nazemni',
    auth: {
      login: 'Sign in', username: 'Username', password: 'Password',
      signIn: 'Sign in', signingIn: 'Signing in…', logout: 'Sign out',
      description: 'Enter your credentials to access your personal study space.',
      invalidCredentials: 'The username or password is incorrect.',
      tooManyAttempts: 'Too many attempts. Try again in a little while.',
      register: 'Create account', createAccount: 'Create account', email: 'Email',
      confirmPassword: 'Confirm password', inviteCode: 'Invite code',
      passwordMismatch: 'Passwords do not match.', registrationFailed: 'Unable to create an account with these details.',
      registrationClosed: 'Registration is currently closed.', haveAccount: 'Already have an account? Sign in',
    },
    landing: { title: 'Organize your studies simply', description: 'Organize your courses, lectures, assignments, and exams in one place.' },
    nav: {
      dashboard: 'Dashboard', dailyPlan: 'Daily plan', courses: 'Courses', tasks: 'Tasks',
      lectures: 'Lectures', assignments: 'Assignments', projects: 'Projects', exams: 'Exams',
      grades: 'Grades', weakTopics: 'Weak topics', backlog: 'Backlog',
      weeklyReview: 'Weekly review', semester: 'Semester management', settings: 'Settings', profile: 'Account', admin: 'Admin', ai: 'AI Assistant',
    },
    common: {
      add: 'Add', save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete',
      close: 'Close', loading: 'Loading…', error: 'Could not load data.', retry: 'Try again',
      noData: 'No data yet.', course: 'Course', status: 'Status', date: 'Date', deadline: 'Deadline',
      title: 'Title', notes: 'Notes', actions: 'Actions', progress: 'Progress', type: 'Type',
      optional: 'Optional', success: 'Saved successfully', deleted: 'Deleted',
      confirmDelete: 'Delete this item?', yesDelete: 'Yes, delete', all: 'All', language: 'Language',
      today: 'Today', minutes: 'minutes', view: 'View', score: 'Score', reason: 'Why now?',
      emptyHint: 'Add the first item to begin.', online: 'Online', onCampus: 'On campus', inPerson: 'In-person',
      yes: 'Yes', no: 'No',
    },
    dashboard: {
      title: 'Dashboard', greeting: 'Tuesday, September 15', todayPlan: 'Today’s plan',
      upcoming: 'Upcoming', attention: 'Courses needing attention', backlog: 'Backlog',
      weeklyProgress: 'Weekly progress', schedule: 'Today’s lectures', focus: 'Focus mode',
      focusActive: 'Focus mode is active', noFocus: 'No urgent event this week.',
      noUpcoming: 'No upcoming dates recorded.', noAttention: 'All courses are stable.',
      planEmpty: 'No tasks recorded. Add a lecture or task to start planning.',
      noSemester: 'There is no current semester.', noSemesterHint: 'Start by creating a semester and adding your courses.', createSemester: 'Create semester',
    },
    plan: {
      title: 'Daily plan', subtitle: 'Practical priorities based on deadlines, backlog, and course difficulty.',
      critical: 'Critical today', important: 'Important', optional: 'If there is room',
      checkout: 'Check out', checkoutTitle: 'Quick daily check-out', stoppedAt: 'Where did you stop?',
      misunderstood: 'A concept I did not understand', selfRating: 'My rating for today',
      completed: 'Completed', inProgress: 'In progress', deferred: 'Deferred',
      noTasks: 'No tasks in this group.', markComplete: 'Mark complete', defer: 'Defer',
      start: 'Start', generated: 'Plan updated now',
    },
    courses: {
      title: 'Courses', subtitle: '{{count}} active courses, {{credits}} credits.',
      difficulty: 'Difficulty', credits: 'Credits', target: 'Target', retake: 'Retake',
      lectureProgress: 'Lecture progress', currentGrade: 'Current standing',
      weightsIncomplete: 'Grading weights are incomplete.', lastStudy: 'Last studied',
      overview: 'Overview', history: 'History', schedule: 'Schedule', assessmentStructure: 'Assessment structure',
      status: { ON_TRACK: 'On track', NEEDS_ATTENTION: 'Needs attention', AT_RISK: 'At risk' },
    },
    entities: {
      lectures: { title: 'Lectures', add: 'Add lecture', backloggedAdd: 'Add Backlogged Lecture', number: 'Lecture number', lectureDate: 'Lecture Date', duration: 'Duration', durationPlaceholder: 'Example: 60 minutes', deliveryMode: 'Delivery mode', deliveryModes: { IN_PERSON: 'In-person', ONLINE: 'Online' }, attended: 'Did you attend?', attendance: { true: 'Attended', false: 'Did not attend' }, reviewToggle: 'Yes, needs review', understanding: 'Understanding / 10', needsReview: 'Needs review', state: 'State' },
      tasks: { title: 'Tasks', add: 'Add task', description: 'Description', dueAt: 'Due date', effort: 'Estimated effort', priority: 'Priority' },
      assignments: { title: 'Assignments', add: 'Add assignment', officialDeadline: 'Official deadline', internalDeadline: 'Internal target', weight: 'Weight', progress: 'Progress' },
      projects: { title: 'Projects', add: 'Add project', officialDeadline: 'Official deadline', internalDeadline: 'Internal target', weight: 'Weight', milestones: 'Milestones' },
      exams: { title: 'Exams', add: 'Add exam', examDate: 'Exam date', preparation: 'Preparation', confidence: 'Confidence / 10', weight: 'Weight' },
      grades: { title: 'Grades', add: 'Add grade', score: 'Score', maximum: 'Out of', percentage: 'Percentage', weight: 'Weight', incomplete: 'Assessment weights are incomplete; none are invented.' },
      weakTopics: { title: 'Weak topics', add: 'Add weak topic', topic: 'Topic', severity: 'Severity', resolved: 'Resolved', resolve: 'Mark resolved' },
    },
    backlog: {
      title: 'Backlog', subtitle: 'Most dangerous items first, with clear reasons.',
      risk: 'Risk', age: 'Age', safe: 'There is no backlog right now.',
    },
    weekly: {
      title: 'Weekly review', score: 'Weekly score', completion: 'Task completion',
      coverage: 'Course coverage', backlogControl: 'Backlog control', reviews: 'Reviews',
      assessments: 'Assessments', keyRisks: 'Current risks', nextWeek: 'Next week priorities',
      covered: 'Covered', notCovered: 'Not covered', tasks: 'Tasks',
    },
    settings: {
      title: 'Settings', planning: 'Planning settings', weeklyDay: 'Weekly review day',
      target: 'Semester target', retakeBonus: 'Retake priority boost',
      firstReview: 'First review after (hours)', timezone: 'Time zone', focusManual: 'Manual focus mode',
      auto: 'Automatic', enabled: 'Enabled', disabled: 'Disabled', saturday: 'Saturday',
      description: 'A small set of settings that directly affect planning.',
    },
    semester: {
      title: 'Semester Management', description: 'Manage the current semester, enrollment, schedule, and assessments in one place.',
      currentSemester: 'Current semester', noCurrent: 'No current semester is active.', name: 'Semester name',
      academicYear: 'Academic year', term: 'Term', startDate: 'Start date', endDate: 'End date',
      registeredCourses: 'Registered courses', inactiveCourses: 'Inactive courses', addCourse: 'Add course',
      editEnrollment: 'Edit course enrollment', existingCourse: 'Select an existing course', newCourse: 'Create a new course',
      courseCode: 'Course code', nameAr: 'Arabic name', nameEn: 'English name',
      instructor: 'Instructor', section: 'Section', previousGrade: 'Previous grade', replacementEffect: 'Grade replacement effect',
      drop: 'Drop', restore: 'Restore', confirmDrop: 'Drop this course from the current semester? Its history will be preserved.',
      noActiveCourses: 'There are no active courses in this semester.', courseCount: 'courses', creditCount: 'credits',
      addSchedule: 'Add time', addAssessment: 'Add assessment', day: 'Day', startTime: 'Start', endTime: 'End',
      room: 'Room / location', assessmentName: 'Assessment name', weight: 'Weight', enabled: 'Enabled',
      days: { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' },
    },
    onboarding: { title: 'Welcome to Nazemni', description: 'Create your current semester, then add your first course in Semester Management.', create: 'Create semester and continue', skip: 'Later' },
    profile: { title: 'Account', account: 'Account details', displayName: 'Display name', createdAt: 'Account created', changePassword: 'Change password', currentPassword: 'Current password', newPassword: 'New password', passwordChanged: 'Password changed', logoutAll: 'Sign out all devices' },
    admin: { title: 'Administration', registrationMode: 'Registration mode', totalUsers: 'Total users', activeUsers: 'Active', disabledUsers: 'Disabled', invites: 'Invite codes', maxUses: 'Maximum uses', createInvite: 'Create invite', codeCreated: 'Invite code created', copyOnce: 'Copy this code now; it will not be shown in full again:', code: 'Code', uses: 'Uses', revoke: 'Revoke', users: 'Users', disable: 'Disable', enable: 'Enable' },
    ai: { title: 'AI Assistant', subtitle: 'Manage your studies in natural language using your Nazemni data.', unavailable: 'The AI assistant is currently unavailable.', newConversation: 'New conversation', conversations: 'Conversations', noConversations: 'No conversations yet.', emptyTitle: 'How can I help with your studies?', emptyHint: 'Ask about today’s plan or backlog, or add a study task.', you: 'You', assistant: 'Nazemni', thinking: 'Preparing a response…', message: 'Your message', placeholder: 'Example: What should I study today?', send: 'Send', deleteConversation: 'Delete conversation', deleteConfirm: 'Delete this conversation?', error: 'The assistant is unavailable right now. Please try again shortly.', rateLimited: 'You reached the request limit. Try again later.', providerBusy: 'The assistant is temporarily busy because of its usage limit. Try again in less than a minute.', operations: 'AI operations', requestsToday: 'Requests today', requestsMonth: 'Requests this month', inputTokens: 'Input tokens today', outputTokens: 'Output tokens today', averageInput: 'Average input tokens', averageOutput: 'Average output tokens', rateLimits: 'Rate-limit events', errors: 'Provider errors' },
    states: {
      TODO: 'Not started', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', DEFERRED: 'Deferred',
      TAKEN_NOT_STUDIED: 'Taken, not studied', STUDIED: 'Studied', NEEDS_REVIEW: 'Needs review', MASTERED: 'Mastered',
      NOT_STARTED: 'Not started', READY_TO_SUBMIT: 'Ready to submit', SUBMITTED: 'Submitted', GRADED: 'Graded',
      BLOCKED: 'Blocked', READY: 'Ready', LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High',
      CRITICAL: 'Critical today', IMPORTANT: 'Important', OPTIONAL: 'If there is room',
      QUIZ: 'Quizzes', ASSIGNMENT: 'Assignments', PROJECT: 'Project', MIDTERM: 'Midterm', FINAL: 'Final', PARTICIPATION: 'Participation', OTHER: 'Other',
      ACTIVE: 'Active', DROPPED: 'Dropped', WITHDRAWN: 'Withdrawn',
    },
  },
};

const saved = localStorage.getItem('nazemni-language');
const language = saved === 'en' ? 'en' : 'ar';
void i18n.use(initReactI18next).init({
  resources: { ar, en },
  lng: language,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = language;
document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

export function setLanguage(language: 'ar' | 'en') {
  localStorage.setItem('nazemni-language', language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  void i18n.changeLanguage(language);
}

export default i18n;
