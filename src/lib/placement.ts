export interface PlacementItem {
  id: string;
  level: number;
  prompt: string;
  expectedPattern?: string;
}

export const PLACEMENT_ITEMS: PlacementItem[] = [
  // L1 Items (1-4): Simple identity, actions, likes, objects
  { id: "placement-l1-can", level: 1, prompt: "Tell me one thing you can do, using the words: I can.", expectedPattern: "I can" },
  { id: "placement-l1-this-is", level: 1, prompt: "Look around you. Name something you see using: This is a...", expectedPattern: "This is" },
  { id: "placement-l1-like", level: 1, prompt: "What fruit or snack do you like? Tell me with: I like...", expectedPattern: "I like" },
  { id: "placement-l1-feel", level: 1, prompt: "How are you feeling today? Tell me with: I am...", expectedPattern: "I am" },

  // L2 Items (5-7): Location, past tense, current actions
  { id: "placement-l2-place", level: 2, prompt: "Where is your book or toy? Tell me using in, on, under, or next to.", expectedPattern: "It is" },
  { id: "placement-l2-past", level: 2, prompt: "What did you do yesterday? Tell me one thing you did.", expectedPattern: "Yesterday" },
  { id: "placement-l2-doing", level: 2, prompt: "What are you doing right now in our lesson? Tell me with: I am...", expectedPattern: "I am" },

  // L3 Items (8-10): Giving reasons, sequence, comparison
  { id: "placement-l3-because", level: 3, prompt: "Why do you like your favorite game or toy? Give me a reason using the word because.", expectedPattern: "because" },
  { id: "placement-l3-sequence", level: 3, prompt: "What is your morning routine? Tell me two things using: First..., then...", expectedPattern: "First" },
  { id: "placement-l3-polite", level: 3, prompt: "If you need a pencil or water, how do you ask politely with please?", expectedPattern: "please" },
];

export function levelFromPlacement(score: number): number {
  if (score >= 8) return 3;
  if (score >= 5) return 2;
  return 1;
}

