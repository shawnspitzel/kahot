export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string, rate = 1) {
  if (!canSpeak || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}
