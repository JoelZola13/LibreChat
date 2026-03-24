/**
 * Utility functions for personalized greetings
 */

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

/**
 * Get the current time of day based on the hour
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "morning";
  } else if (hour >= 12 && hour < 17) {
    return "afternoon";
  } else if (hour >= 17 && hour < 21) {
    return "evening";
  } else {
    return "night";
  }
}

/**
 * Get a greeting based on time of day
 */
export function getGreeting(timeOfDay?: TimeOfDay): string {
  const time = timeOfDay || getTimeOfDay();

  switch (time) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    case "evening":
      return "Good evening";
    case "night":
      return "Welcome back";
  }
}

/**
 * Get a personalized greeting with the user's name
 */
export function getPersonalizedGreeting(
  userName?: string | null,
  timeOfDay?: TimeOfDay
): string {
  const greeting = getGreeting(timeOfDay);

  if (userName) {
    // Extract first name if full name is provided
    const firstName = userName.split(" ")[0];
    return `${greeting}, ${firstName}!`;
  }

  return `${greeting}!`;
}

/**
 * Get a motivational message based on time and learning context
 */
export function getMotivationalMessage(
  coursesInProgress?: number,
  streakDays?: number
): string {
  const timeOfDay = getTimeOfDay();

  // Streak-based messages
  if (streakDays && streakDays >= 7) {
    return `Amazing! You're on a ${streakDays}-day streak. Keep it up!`;
  }

  // Course-based messages
  if (coursesInProgress && coursesInProgress > 0) {
    const messages = [
      "Continue your learning journey. You're making great progress!",
      "Pick up where you left off. Every lesson counts!",
      "Ready to learn something new today?",
      "Your next lesson awaits. Let's dive in!",
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Time-based messages
  switch (timeOfDay) {
    case "morning":
      return "Start your day with a new lesson. Morning learning sticks!";
    case "afternoon":
      return "Perfect time for a quick learning session.";
    case "evening":
      return "Wind down with some learning before the day ends.";
    case "night":
      return "A little late-night learning never hurt anyone!";
  }
}

/**
 * Get learning streak encouragement
 */
export function getStreakMessage(streakDays: number): string {
  if (streakDays === 0) {
    return "Start your streak today!";
  } else if (streakDays === 1) {
    return "Great start! Keep going tomorrow.";
  } else if (streakDays < 7) {
    return `${streakDays} days strong! Almost at a week.`;
  } else if (streakDays < 30) {
    return `${streakDays} days! You're on fire!`;
  } else {
    return `Incredible ${streakDays}-day streak! You're unstoppable!`;
  }
}
