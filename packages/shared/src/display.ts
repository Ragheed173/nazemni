const generatedLectureTitle = /^(?:Backlogged Lecture \d+|(?:Study )?Lecture \d+: Backlogged Lecture \d+)$/;

export const displayLectureTitle = (title: string, genericLabel: string) =>
  generatedLectureTitle.test(title) ? genericLabel : title;
