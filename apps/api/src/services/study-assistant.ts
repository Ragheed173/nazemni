export interface StudyAssistantService {
  generateDailyPlan(): Promise<unknown>;
  generateWeeklyReview(): Promise<unknown>;
  parseNaturalLanguageUpdate(input: string): Promise<unknown>;
  recordGradeFromChat(input: unknown): Promise<unknown>;
  addAssignmentFromChat(input: unknown): Promise<unknown>;
  createStudyTasksFromConversation(input: string): Promise<unknown>;
}

// V1 deliberately has no implementation. Planning is deterministic and does not require an AI service.
