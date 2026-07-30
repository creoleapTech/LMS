const WORDS = [
  "blue", "star", "sun", "moon", "sky", "fire", "lion", "tiger", "bear", "hawk",
  "eagle", "swift", "spark", "flash", "light", "cloud", "storm", "river", "ocean", "shield",
  "brave", "happy", "smart", "super", "magic", "orbit", "planet", "comet", "rocket", "pixel",
  "craft", "frost", "flame", "pulse", "wave", "breeze", "hero", "solar", "lunar"
];

export function generateStudentPassword(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900); // 3-digit number (100–999)
  return `${word}${num}`;
}
