export type LessonTaskKind = "explain" | "correct" | "reading" | "scenario";

export interface LessonTask {
  id: string;
  kind: LessonTaskKind;
  skill: string;
  title: string;
  instruction: string;
  content: string;
  responseShape: string;
  level: number;
}

const TASKS: LessonTask[] = [
  {
    id: "l1-explain-picture",
    kind: "explain",
    skill: "explanation",
    title: "Look and find",
    instruction: "Read the short text scene, give one simple example, then present the challenge for the child to pick the correct sentence.",
    content: "A red ball is next to a blue box.",
    responseShape: "The child picks what they see with This is, I see, or a simple location sentence.",
    level: 1,
  },
  {
    id: "l1-correct-recast",
    kind: "correct",
    skill: "self-correction",
    title: "Try it another way",
    instruction: "Invite the child to fix the sentence. Recast naturally without saying it is wrong.",
    content: "The sentence is: I like dog.",
    responseShape: "The child selects I like dogs or I like a dog.",
    level: 1,
  },
  {
    id: "l1-sentence-builder",
    kind: "reading",
    skill: "word ordering",
    title: "Word Order Fun",
    instruction: "Present jumbled words and invite the child to build the complete sentence.",
    content: "cat / sleepy / The / is",
    responseShape: "The child puts the words in order.",
    level: 1,
  },
  {
    id: "l1-fill-blank",
    kind: "explain",
    skill: "sentence completion",
    title: "Finish the sentence",
    instruction: "Show the sentence with one blank and ask the child to choose a word that completes it, then say the whole sentence.",
    content: "I can ___. Choose: run, jump, or draw.",
    responseShape: "The child completes and says one I can sentence.",
    level: 1,
  },
  {
    id: "l1-scenario-sharing",
    kind: "scenario",
    skill: "understanding a situation",
    title: "What would you do?",
    instruction: "Describe the situation. Ask what the child would do and accept a kind choice.",
    content: "A friend has no crayon. You have two crayons.",
    responseShape: "The child selects a simple action such as I can share.",
    level: 1,
  },

  {
    id: "l2-explain-reason",
    kind: "explain",
    skill: "explaining a reason",
    title: "Explain why",
    instruction: "Give the situation and model one reason. Ask the child to explain why using because.",
    content: "The ground is wet because it rained.",
    responseShape: "The child gives a relevant because sentence.",
    level: 2,
  },
  {
    id: "l2-correct-recast",
    kind: "correct",
    skill: "self-correction",
    title: "Build the sentence again",
    instruction: "Respond to the meaning, recast the sentence, and ask the child to try once more with the correct form.",
    content: "A rabbit says: Yesterday I go park.",
    responseShape: "The child tries a past sentence such as Yesterday the rabbit went to the park.",
    level: 2,
  },
  {
    id: "l2-reading-picnic",
    kind: "reading",
    skill: "reading comprehension",
    title: "Read for details",
    instruction: "Read the passage in short parts. Ask who, where, and what questions about details in it.",
    content: "Mina went to the park with her brother. They saw a small dog. The dog was under a bench. Mina gave it some water.",
    responseShape: "The child answers literal who, where, or what questions from the passage.",
    level: 2,
  },
  {
    id: "l2-scenario-lost",
    kind: "scenario",
    skill: "understanding a situation",
    title: "Think about the next step",
    instruction: "Describe the situation and ask what the character should do first. Ask for one reason.",
    content: "A bear cannot find its bag before it leaves. The bear's grown-up is nearby.",
    responseShape: "The child suggests what the bear should do and explains why.",
    level: 2,
  },
  {
    id: "l3-explain-evidence",
    kind: "explain",
    skill: "explaining with evidence",
    title: "Explain your thinking",
    instruction: "Ask the child to make an idea and explain which detail helped them think that way.",
    content: "The sky is dark. People are carrying umbrellas. It may rain soon.",
    responseShape: "The child gives a prediction and a because reason linked to a detail.",
    level: 3,
  },
  {
    id: "l3-correct-recast",
    kind: "correct",
    skill: "self-correction",
    title: "Make the story clear",
    instruction: "Recast one sentence naturally, then ask the child to retell that part with a sequence word.",
    content: "A fox says: Then he eat the apple.",
    responseShape: "The child tries Then he ate the apple or another clear past-tense retell.",
    level: 3,
  },
  {
    id: "l3-reading-prediction",
    kind: "reading",
    skill: "reading comprehension",
    title: "Read and predict",
    instruction: "Read the story aloud. Ask one literal question and one prediction question, asking for a reason.",
    content: "Leo planted a seed. He gave it water every day. A tiny green leaf appeared. Leo put the pot near the sunny window.",
    responseShape: "The child answers a detail question and predicts what may happen next with a reason.",
    level: 3,
  },
  {
    id: "l3-scenario-kind-choice",
    kind: "scenario",
    skill: "understanding a situation",
    title: "Choose a helpful response",
    instruction: "Ask what the child would do, what another person might feel, and why the choice would help.",
    content: "A new child is sitting alone while everyone else is playing.",
    responseShape: "The child suggests a polite invitation and gives a feeling or because reason.",
    level: 3,
  },
  {
    id: "l3-story-little-cloud",
    kind: "reading",
    skill: "story comprehension",
    title: "Short story",
    instruction: "Tell the short story exactly. Ask one simple question about what happened, then invite the child to answer in a complete sentence.",
    content: "A little cloud wanted to help the flowers. It made a small rain shower. The flowers stood up tall and thanked the cloud.",
    responseShape: "The child answers what the cloud did or why the flowers stood up.",
    level: 3,
  },
  {
    id: "l3-drive-story",
    kind: "reading",
    skill: "story comprehension",
    title: "Drive and discover",
    instruction: "Take the child on an imaginary drive by reading the story aloud in short parts. Ask what they noticed, what happened next, and one why question.",
    content: "We drive past a green hill and a quiet lake. A red kite is stuck in a tree. We stop safely, and a friendly ranger helps the kite fly free.",
    responseShape: "The child answers detail, sequence, prediction, or reason questions about the story.",
    level: 3,
  },
  {
    id: "l3-joke-banana",
    kind: "reading",
    skill: "listening and response",
    title: "Tiny joke",
    instruction: "Tell the joke exactly, then ask one short comprehension question and return to the current sentence practice.",
    content: "Why did the banana go to the doctor? Because it was not peeling well.",
    responseShape: "The child says what happened in the joke, then completes the current sentence task.",
    level: 3,
  },
];

export function taskFor(level: number, turnCount: number): LessonTask {
  const choices = TASKS.filter(
    (task) => task.level === level && (level !== 3 || task.kind === "reading")
  );
  return choices[turnCount % choices.length];
}
