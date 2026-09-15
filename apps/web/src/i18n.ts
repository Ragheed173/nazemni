import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const ar = {
  translation: {
    brand: 'نظمني',
    nav: {
      dashboard: 'الرئيسية', dailyPlan: 'خطة اليوم', courses: 'المواد', tasks: 'المهام',
      lectures: 'المحاضرات', assignments: 'الواجبات', projects: 'المشاريع', exams: 'الامتحانات',
      grades: 'العلامات', weakTopics: 'نقاط الضعف', backlog: 'التراكم',
      weeklyReview: 'مراجعة الأسبوع', settings: 'الإعدادات',
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
      emptyHint: 'أضف أول عنصر للبدء.', online: 'عن بُعد', onCampus: 'في الجامعة',
    },
    dashboard: {
      title: 'الرئيسية', greeting: 'الثلاثاء، 15 أيلول', todayPlan: 'خطة اليوم',
      upcoming: 'القادم', attention: 'مواد تحتاج انتباه', backlog: 'التراكم',
      weeklyProgress: 'تقدم الأسبوع', schedule: 'محاضرات اليوم', focus: 'وضع التركيز',
      focusActive: 'وضع التركيز مفعّل', noFocus: 'لا يوجد حدث عاجل هذا الأسبوع.',
      noUpcoming: 'لا توجد مواعيد قريبة مسجلة.', noAttention: 'كل المواد مستقرة حاليًا.',
      planEmpty: 'لا توجد مهام مسجلة. أضف محاضرة أو مهمة لبدء التخطيط.',
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
      title: 'المواد', subtitle: 'ست مواد، 18 ساعة معتمدة، والهدف B+.',
      difficulty: 'الصعوبة', credits: 'الساعات', target: 'الهدف', retake: 'إعادة',
      lectureProgress: 'تقدم المحاضرات', currentGrade: 'المستوى الحالي',
      weightsIncomplete: 'أوزان العلامات غير مكتملة.', lastStudy: 'آخر دراسة',
      overview: 'نظرة عامة', history: 'السجل', schedule: 'الجدول',
      status: { ON_TRACK: 'على المسار', NEEDS_ATTENTION: 'تحتاج انتباه', AT_RISK: 'معرّضة للخطر' },
    },
    entities: {
      lectures: { title: 'المحاضرات', add: 'إضافة محاضرة', number: 'رقم المحاضرة', lectureDate: 'تاريخ المحاضرة', understanding: 'الفهم من 10', needsReview: 'تحتاج مراجعة', state: 'الحالة' },
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
      target: 'هدف الفصل', retakeBonus: 'دفعة أولوية الإعادة', firstReview: 'المراجعة الأولى بعد (ساعة)',
      focusManual: 'وضع التركيز اليدوي', auto: 'تلقائي', enabled: 'مفعّل', disabled: 'معطّل',
      saturday: 'السبت', description: 'إعدادات قليلة تؤثر مباشرة في طريقة التخطيط.',
    },
    states: {
      TODO: 'لم تبدأ', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'تم', DEFERRED: 'مؤجل',
      TAKEN_NOT_STUDIED: 'أُخذت ولم تُدرس', STUDIED: 'دُرست', NEEDS_REVIEW: 'تحتاج مراجعة', MASTERED: 'متقنة',
      NOT_STARTED: 'لم يبدأ', READY_TO_SUBMIT: 'جاهز للتسليم', SUBMITTED: 'مُسلّم', GRADED: 'مُقيّم',
      BLOCKED: 'متوقف', READY: 'جاهز', LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية',
      CRITICAL: 'ضروري اليوم', IMPORTANT: 'مهم', OPTIONAL: 'إذا بقي مجال',
      QUIZ: 'Quiz', MIDTERM: 'Midterm', FINAL: 'Final',
    },
  },
};

const en = {
  translation: {
    brand: 'Nazemni',
    nav: {
      dashboard: 'Dashboard', dailyPlan: 'Daily plan', courses: 'Courses', tasks: 'Tasks',
      lectures: 'Lectures', assignments: 'Assignments', projects: 'Projects', exams: 'Exams',
      grades: 'Grades', weakTopics: 'Weak topics', backlog: 'Backlog',
      weeklyReview: 'Weekly review', settings: 'Settings',
    },
    common: {
      add: 'Add', save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete',
      close: 'Close', loading: 'Loading…', error: 'Could not load data.', retry: 'Try again',
      noData: 'No data yet.', course: 'Course', status: 'Status', date: 'Date', deadline: 'Deadline',
      title: 'Title', notes: 'Notes', actions: 'Actions', progress: 'Progress', type: 'Type',
      optional: 'Optional', success: 'Saved successfully', deleted: 'Deleted',
      confirmDelete: 'Delete this item?', yesDelete: 'Yes, delete', all: 'All', language: 'Language',
      today: 'Today', minutes: 'minutes', view: 'View', score: 'Score', reason: 'Why now?',
      emptyHint: 'Add the first item to begin.', online: 'Online', onCampus: 'On campus',
    },
    dashboard: {
      title: 'Dashboard', greeting: 'Tuesday, September 15', todayPlan: 'Today’s plan',
      upcoming: 'Upcoming', attention: 'Courses needing attention', backlog: 'Backlog',
      weeklyProgress: 'Weekly progress', schedule: 'Today’s lectures', focus: 'Focus mode',
      focusActive: 'Focus mode is active', noFocus: 'No urgent event this week.',
      noUpcoming: 'No upcoming dates recorded.', noAttention: 'All courses are stable.',
      planEmpty: 'No tasks recorded. Add a lecture or task to start planning.',
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
      title: 'Courses', subtitle: 'Six courses, 18 credits, target B+.',
      difficulty: 'Difficulty', credits: 'Credits', target: 'Target', retake: 'Retake',
      lectureProgress: 'Lecture progress', currentGrade: 'Current standing',
      weightsIncomplete: 'Grading weights are incomplete.', lastStudy: 'Last studied',
      overview: 'Overview', history: 'History', schedule: 'Schedule',
      status: { ON_TRACK: 'On track', NEEDS_ATTENTION: 'Needs attention', AT_RISK: 'At risk' },
    },
    entities: {
      lectures: { title: 'Lectures', add: 'Add lecture', number: 'Lecture number', lectureDate: 'Lecture date', understanding: 'Understanding / 10', needsReview: 'Needs review', state: 'State' },
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
      firstReview: 'First review after (hours)', focusManual: 'Manual focus mode',
      auto: 'Automatic', enabled: 'Enabled', disabled: 'Disabled', saturday: 'Saturday',
      description: 'A small set of settings that directly affect planning.',
    },
    states: {
      TODO: 'Not started', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', DEFERRED: 'Deferred',
      TAKEN_NOT_STUDIED: 'Taken, not studied', STUDIED: 'Studied', NEEDS_REVIEW: 'Needs review', MASTERED: 'Mastered',
      NOT_STARTED: 'Not started', READY_TO_SUBMIT: 'Ready to submit', SUBMITTED: 'Submitted', GRADED: 'Graded',
      BLOCKED: 'Blocked', READY: 'Ready', LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High',
      CRITICAL: 'Critical today', IMPORTANT: 'Important', OPTIONAL: 'If there is room',
      QUIZ: 'Quiz', MIDTERM: 'Midterm', FINAL: 'Final',
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
